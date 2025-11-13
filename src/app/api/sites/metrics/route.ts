import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Calculate date range based on days parameter
 */
function getDateRange(days: number): { startDate: string; endDate: string } {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  if (days === 1) {
    // 今天
    const today = new Date();
    const dateStr = formatDate(today);
    return { startDate: dateStr, endDate: dateStr };
  } else if (days === 2) {
    // 昨天
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);
    return { startDate: dateStr, endDate: dateStr };
  } else {
    // 最近N天（不包括昨天和今天，等待数据完整）
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // 截至前天（数据更完整）

    const startDate = new Date(endDate); // 从endDate开始往回推
    startDate.setDate(startDate.getDate() - days + 1); // 往前推N-1天（包含endDate这一天）

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const daysParam = searchParams.get('days');
    const siteIdsParam = searchParams.get('siteIds');
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');
    const sortFieldParam = (searchParams.get('sortField') || '').toLowerCase();
    const sortOrderParam = (searchParams.get('sortOrder') || '').toLowerCase(); // 'asc' | 'desc'

    // 支持两种调用方式：
    // 1. 指定具体的站点: ?days=7&siteIds=id1,id2,id3
    // 2. 获取某一页的所有站点: ?days=7&page=1&pageSize=20
    let siteIds: string[] = [];
    let startDate: string;
    let endDate: string;

    const days = daysParam ? parseInt(daysParam) : 7;
    const dateRange = getDateRange(days);
    startDate = dateRange.startDate;
    endDate = dateRange.endDate;

    // 获取站点 IDs
    if (siteIdsParam) {
      // 方式1：直接指定站点IDs
      siteIds = siteIdsParam.split(',').map((id) => id.trim());
    } else if (pageParam && pageSizeParam) {
      // 方式2：根据分页参数获取站点
      const page = parseInt(pageParam);
      const pageSize = parseInt(pageSizeParam);
      const skip = (page - 1) * pageSize;

      const sites = await prisma.site.findMany({
        where: {
          deletedAt: null,
        },
        select: {
          id: true,
        },
        skip,
        take: pageSize,
      });

      siteIds = sites.map((s) => s.id);
    } else {
      return NextResponse.json(
        { success: false, error: 'Either siteIds or both page and pageSize are required' },
        { status: 400 }
      );
    }

    if (siteIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {},
      });
    }

    console.log(`[Batch Metrics API] Fetching metrics for ${siteIds.length} sites, range: ${startDate} to ${endDate}`);

    // Parse date strings
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    // Fetch all traffic and GSC data for all sites in parallel
    const [allTrafficData, allGscData, allSources, allBacklinkSubmissions, latestEvaluations] = await Promise.all([
      prisma.trafficData.findMany({
        where: {
          siteId: { in: siteIds },
          date: {
            gte: start,
            lte: end,
          },
        },
        select: {
          siteId: true,
          date: true,
          pv: true,
          uv: true,
          sessions: true,
          activeUsers: true,
          newUsers: true,
          events: true,
          bounceRate: true,
          averageSessionDuration: true,
          metricsData: true,
          conversionRate: true,
        },
      }),
      prisma.searchConsoleData.findMany({
        where: {
          siteId: { in: siteIds },
          date: {
            gte: start,
            lte: end,
          },
        },
        select: {
          siteId: true,
          date: true,
          totalClicks: true,
          totalImpressions: true,
          avgCtr: true,
          avgPosition: true,
        },
      }),
      prisma.trafficSource.findMany({
        where: {
          traffic: {
            siteId: { in: siteIds },
            date: { gte: start, lte: end },
          },
        },
        select: {
          source: true,
          traffic: { select: { siteId: true } },
        },
      }),
      prisma.backlinkSubmission.groupBy({
        by: ['siteId'],
        where: {
          siteId: { in: siteIds },
        },
        _count: {
          id: true,
        },
      }),
      prisma.evaluation.findMany({
        where: { siteId: { in: siteIds } },
        orderBy: [{ siteId: 'asc' }, { date: 'desc' }],
        select: {
          siteId: true,
          date: true,
          marketScore: true,
          qualityScore: true,
          seoScore: true,
          trafficScore: true,
          revenueScore: true,
          overallScore: true,
        },
      }),
    ]);

    console.log(`[Batch Metrics API] Fetched ${allTrafficData.length} traffic records and ${allGscData.length} GSC records`);

    // Group data by siteId
    const metricsMap = new Map<string, any>();

    // Initialize metrics for each site
    for (const siteId of siteIds) {
      metricsMap.set(siteId, {
        traffic: {
          totalPv: 0,
          totalUv: 0,
          totalSessions: 0,
          totalActiveUsers: 0,
          totalNewUsers: 0,
          totalEvents: 0,
          avgBounceRate: 0,
          avgSessionDuration: 0,
          conversionRate: 0,
          recordCount: 0,
        },
        gsc: {
          totalClicks: 0,
          totalImpressions: 0,
          avgCtr: 0,
          avgPosition: 0,
          recordCount: 0,
        },
      });
    }

    // Process traffic data
    const trafficBysite = new Map<string, any[]>();
    allTrafficData.forEach((item) => {
      if (!trafficBysite.has(item.siteId)) {
        trafficBysite.set(item.siteId, []);
      }
      trafficBysite.get(item.siteId)!.push(item);
    });

    // Calculate traffic metrics per site
    for (const [siteId, trafficRecords] of trafficBysite.entries()) {
      const totalPv = trafficRecords.reduce((sum, item) => sum + item.pv, 0);
      const totalUv = trafficRecords.reduce((sum, item) => sum + item.uv, 0);
      const totalSessions = trafficRecords.reduce((sum, item) => sum + item.sessions, 0);
      const totalActiveUsers = trafficRecords.reduce((sum, item) => sum + item.activeUsers, 0);
      const totalNewUsers = trafficRecords.reduce((sum, item) => sum + item.newUsers, 0);
      const totalEvents = trafficRecords.reduce((sum, item) => sum + item.events, 0);
      const avgBounceRate =
        trafficRecords.length > 0
          ? trafficRecords.reduce((sum, item) => sum + (item.bounceRate?.toNumber() || 0), 0) /
            trafficRecords.length
          : 0;
      // 从 GA 数据中直接获取平均会话时长，然后计算平均值
      const avgSessionDuration =
        trafficRecords.length > 0
          ? trafficRecords.reduce((sum, item) => {
              // 优先从 averageSessionDuration 字段获取（这是GA的真正平均会话时长）
              const duration = item.averageSessionDuration?.toNumber() || 0;
              return sum + duration;
            }, 0) / trafficRecords.length
          : 0;
      const conversionRate =
        trafficRecords.length > 0
          ? trafficRecords.reduce((sum, item) => sum + (item.conversionRate?.toNumber() || 0), 0) /
            trafficRecords.length
          : 0;

      const metrics = metricsMap.get(siteId)!;
      metrics.traffic = {
        totalPv,
        totalUv,
        totalSessions,
        totalActiveUsers,
        totalNewUsers,
        totalEvents,
        avgBounceRate: parseFloat(avgBounceRate.toFixed(2)),
        avgSessionDuration: parseFloat(avgSessionDuration.toFixed(2)),
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        recordCount: trafficRecords.length,
      };
    }

    // Process GSC data
    const gscBySite = new Map<string, any[]>();
    allGscData.forEach((item) => {
      if (!gscBySite.has(item.siteId)) {
        gscBySite.set(item.siteId, []);
      }
      gscBySite.get(item.siteId)!.push(item);
    });

    // Calculate GSC metrics per site
    for (const [siteId, gscRecords] of gscBySite.entries()) {
      const totalClicks = gscRecords.reduce((sum, record) => sum + record.totalClicks, 0);
      const totalImpressions = gscRecords.reduce((sum, record) => sum + record.totalImpressions, 0);
      const avgCtr =
        gscRecords.length > 0
          ? gscRecords.reduce((sum, record) => sum + (Number(record.avgCtr) || 0), 0) / gscRecords.length
          : 0;
      const avgPosition =
        gscRecords.length > 0
          ? gscRecords.reduce((sum, record) => sum + (Number(record.avgPosition) || 0), 0) / gscRecords.length
          : 0;

      const metrics = metricsMap.get(siteId)!;
      metrics.gsc = {
        totalClicks,
        totalImpressions,
        avgCtr: parseFloat(avgCtr.toFixed(2)),
        avgPosition: parseFloat(avgPosition.toFixed(2)),
        recordCount: gscRecords.length,
      };
    }

    // Get actual backlink submission count from database
    const backlinkCountBySite = new Map<string, number>();
    for (const record of allBacklinkSubmissions) {
      backlinkCountBySite.set(record.siteId, record._count.id);
    }
    for (const siteId of siteIds) {
      const metrics = metricsMap.get(siteId)!;
      metrics.backlinksCount = backlinkCountBySite.get(siteId) || 0; // actual backlink submissions count
    }

    const latestBySite = new Map<string, any>();
    for (const ev of latestEvaluations) {
      if (!latestBySite.has(ev.siteId)) {
        latestBySite.set(ev.siteId, ev);
      }
    }
    for (const siteId of siteIds) {
      const ev = latestBySite.get(siteId);
      const metrics = metricsMap.get(siteId)!;
      metrics.evaluation = ev
        ? {
            market: ev.marketScore ?? null,
            quality: ev.qualityScore ?? null,
            seo: ev.seoScore ?? null,
            traffic: ev.trafficScore ?? null,
            revenue: ev.revenueScore ?? null,
            composite: ev.overallScore ? Number(ev.overallScore) : null,
            date: ev.date,
          }
        : metrics.evaluation;
    }

    for (const siteId of siteIds) {
      const m = metricsMap.get(siteId)!;
      const pv = Number(m?.traffic?.totalPv ?? 0);
      const uv = Number(m?.traffic?.totalUv ?? 0);
      const sessions = Number(m?.traffic?.totalSessions ?? 0);
      const au = Number(m?.traffic?.totalActiveUsers ?? 0);
      const newUsers = Number(m?.traffic?.totalNewUsers ?? 0);
      const events = Number(m?.traffic?.totalEvents ?? 0);
      const bounceRate = Number(m?.traffic?.avgBounceRate ?? 0);
      const avgSessionDuration = Number(m?.traffic?.avgSessionDuration ?? 0);
      const conversionRate = Number(m?.traffic?.conversionRate ?? 0);
      const clicks = Number(m?.gsc?.totalClicks ?? 0);
      const impr = Number(m?.gsc?.totalImpressions ?? 0);
      const ctr = Number(m?.gsc?.avgCtr ?? 0);
      const avgPos = Number(m?.gsc?.avgPosition ?? 100);

      const norm = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));
      const inv = (v: number) => Math.max(0, Math.min(100, 100 - v));
      const posScore = Math.max(0, Math.min(100, 100 - ((avgPos / 100) * 100)));

      const trafficScore = Math.round(
        norm(pv, 1_000_000) * 0.35 +
        norm(sessions, 500_000) * 0.25 +
        norm(au, 500_000) * 0.2 +
        norm(avgSessionDuration, 300) * 0.2
      );

      const qualityScore = Math.round(
        norm(avgSessionDuration, 300) * 0.5 +
        inv(Math.min(100, bounceRate)) * 0.5
      );

      const seoScore = Math.round(
        norm(clicks, 50_000) * 0.4 +
        norm(impr, 2_000_000) * 0.2 +
        Math.max(0, Math.min(100, ctr)) * 0.2 +
        posScore * 0.2
      );

      const marketScore = Math.round(
        norm(newUsers, 100_000) * 0.6 +
        norm(events, 1_000_000) * 0.4
      );

      const revenueScore = Math.round(
        Math.max(0, Math.min(100, conversionRate))
      );

      const composite = Math.round(
        (trafficScore + qualityScore + seoScore + marketScore + revenueScore) / 5
      );

      m.evaluation = m.evaluation && m.evaluation.composite != null
        ? m.evaluation
        : {
            market: marketScore,
            quality: qualityScore,
            seo: seoScore,
            traffic: trafficScore,
            revenue: revenueScore,
            composite,
            date: null,
          };
    }

    // Convert map to object for response
    const metricsData: Record<string, any> = {};
    for (const [siteId, metrics] of metricsMap.entries()) {
      metricsData[siteId] = metrics;
    }

    // Optional server-side order by sortField
    const sortableKeys = new Set(['pv','uv','au','sessions','clicks','impr','ctr','avgpos','backlinks','score']);
    let order: string[] | undefined = undefined;
    if (sortFieldParam && sortableKeys.has(sortFieldParam)) {
      const getVal = (siteId: string) => {
        const m = metricsMap.get(siteId);
        if (!m) return null;
        switch (sortFieldParam) {
          case 'pv': return m.traffic?.totalPv ?? null;
          case 'uv': return m.traffic?.totalUv ?? null;
          case 'au': return m.traffic?.totalActiveUsers ?? null;
          case 'sessions': return m.traffic?.totalSessions ?? null;
          case 'clicks': return m.gsc?.totalClicks ?? null;
          case 'impr': return m.gsc?.totalImpressions ?? null;
          case 'ctr': return Number(m.gsc?.avgCtr ?? 0);
          case 'avgpos': return Number(m.gsc?.avgPosition ?? 0);
          case 'backlinks': return Number(m.backlinksCount ?? 0);
          case 'score': return Number(m.evaluation?.composite ?? 0) || null;
          default: return null;
        }
      };
      const ids = [...metricsMap.keys()];
      ids.sort((a, b) => {
        const av = getVal(a);
        const bv = getVal(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortOrderParam === 'asc' ? av - bv : bv - av;
        }
        const as = String(av);
        const bs = String(bv);
        return sortOrderParam === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
      });
      order = ids;
    }

    return NextResponse.json({
      success: true,
      data: {
        dateRange: {
          startDate,
          endDate,
        },
        metrics: metricsData,
        order,
      },
    });
  } catch (error: any) {
    console.error('[Batch Metrics API] Error:', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}
