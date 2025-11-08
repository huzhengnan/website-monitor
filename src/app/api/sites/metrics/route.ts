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
    const [allTrafficData, allGscData] = await Promise.all([
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
      const avgSessionDuration =
        trafficRecords.length > 0
          ? trafficRecords.reduce((sum, item) => sum + (item.averageSessionDuration?.toNumber() || 0), 0) /
            trafficRecords.length
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

    // Convert map to object for response
    const metricsData: Record<string, any> = {};
    for (const [siteId, metrics] of metricsMap.entries()) {
      metricsData[siteId] = metrics;
    }

    return NextResponse.json({
      success: true,
      data: {
        dateRange: {
          startDate,
          endDate,
        },
        metrics: metricsData,
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
