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
    // 最近7天或30天（不包括昨天和今天，等待数据完整）
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // 截至前天（数据更完整）

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days - 1); // 往前推N+1天（因为endDate已经往前推2天）

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const daysParam = searchParams.get('days');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 支持两种调用方式：
    // 1. ?days=7 - 自动计算日期范围
    // 2. ?startDate=2025-10-27&endDate=2025-11-02 - 指定日期范围
    let startDate: string;
    let endDate: string;

    if (daysParam) {
      const days = parseInt(daysParam);
      const dateRange = getDateRange(days);
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    } else if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      return NextResponse.json(
        { success: false, error: 'Either days or both startDate and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`[Metrics API] Fetching metrics for site ${id}, range: ${startDate} to ${endDate}`);

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 }
      );
    }

    // Parse date strings
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    // Fetch traffic data and GSC data in parallel
    const [trafficData, gscData] = await Promise.all([
      prisma.trafficData.findMany({
        where: {
          siteId: id,
          date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: {
          date: 'asc',
        },
      }),
      prisma.searchConsoleData.findMany({
        where: {
          siteId: id,
          date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: {
          date: 'asc',
        },
      }),
    ]);

    console.log(`[Metrics API] Traffic records: ${trafficData.length}, GSC records: ${gscData.length}`);

    // Calculate traffic totals
    const totalPv = trafficData.reduce((sum, item) => sum + item.pv, 0);
    const totalUv = trafficData.reduce((sum, item) => sum + item.uv, 0);
    const totalSessions = trafficData.reduce((sum, item) => sum + item.sessions, 0);
    const totalActiveUsers = trafficData.reduce((sum, item) => sum + item.activeUsers, 0);
    const totalNewUsers = trafficData.reduce((sum, item) => sum + item.newUsers, 0);
    const totalEvents = trafficData.reduce((sum, item) => sum + item.events, 0);
    const avgBounceRate = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.bounceRate?.toNumber() || 0), 0) / trafficData.length
      : 0;
    const avgSessionDuration = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.averageSessionDuration?.toNumber() || 0), 0) /
        trafficData.length
      : 0;
    const conversionRate = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.conversionRate?.toNumber() || 0), 0) /
        trafficData.length
      : 0;

    // Calculate GSC totals
    const totalClicks = gscData.reduce((sum, record) => sum + record.totalClicks, 0);
    const totalImpressions = gscData.reduce((sum, record) => sum + record.totalImpressions, 0);
    const avgCtr =
      gscData.length > 0
        ? gscData.reduce((sum, record) => sum + (Number(record.avgCtr) || 0), 0) / gscData.length
        : 0;
    const avgPosition =
      gscData.length > 0
        ? gscData.reduce((sum, record) => sum + (Number(record.avgPosition) || 0), 0) / gscData.length
        : 0;

    // Prepare daily data for charts (merged traffic and GSC)
    const dailyDataMap = new Map<string, any>();

    // Add traffic data
    trafficData.forEach((item) => {
      const dateStr = item.date.toISOString().split('T')[0];
      dailyDataMap.set(dateStr, {
        date: dateStr,
        traffic: {
          pv: item.pv,
          uv: item.uv,
          sessions: item.sessions,
          activeUsers: item.activeUsers,
          newUsers: item.newUsers,
          events: item.events,
          bounceRate: item.bounceRate?.toNumber() || 0,
          sessionDuration: item.averageSessionDuration?.toNumber() || 0,
          conversionRate: item.conversionRate?.toNumber() || 0,
        },
      });
    });

    // Add GSC data
    gscData.forEach((item) => {
      const dateStr = item.date.toISOString().split('T')[0];
      const existing = dailyDataMap.get(dateStr) || { date: dateStr };
      existing.gsc = {
        clicks: item.totalClicks,
        impressions: item.totalImpressions,
        ctr: item.avgCtr || 0,
        position: item.avgPosition || 0,
      };
      dailyDataMap.set(dateStr, existing);
    });

    const dailyData = Array.from(dailyDataMap.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      success: true,
      data: {
        dateRange: {
          startDate,
          endDate,
        },
        traffic: {
          totalPv,
          totalUv,
          totalSessions,
          totalActiveUsers,
          totalNewUsers,
          totalEvents,
          avgBounceRate: parseFloat(avgBounceRate.toFixed(2)),
          avgSessionDuration: parseFloat(avgSessionDuration.toFixed(2)),
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          recordCount: trafficData.length,
        },
        gsc: {
          totalClicks,
          totalImpressions,
          avgCtr: parseFloat(avgCtr.toFixed(2)),
          avgPosition: parseFloat(avgPosition.toFixed(2)),
          recordCount: gscData.length,
        },
        dailyData,
      },
    });
  } catch (error: any) {
    console.error('[Metrics API] Error:', {
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
