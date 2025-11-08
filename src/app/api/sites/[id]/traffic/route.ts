import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    // Parse date strings (YYYY-MM-DD)
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    // Query traffic data for the given date range
    const trafficData = await prisma.trafficData.findMany({
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
    });

    console.log(`[Traffic API] Site ${id}, Date Range: ${startDate} to ${endDate}, Records Found: ${trafficData.length}`);

    // Calculate totals for all metrics
    const totalPv = trafficData.reduce((sum, item) => sum + item.pv, 0);
    const totalUv = trafficData.reduce((sum, item) => sum + item.uv, 0);
    const totalSessions = trafficData.reduce((sum, item) => sum + item.sessions, 0);
    const totalActiveUsers = trafficData.reduce((sum, item) => sum + item.activeUsers, 0);
    const totalNewUsers = trafficData.reduce((sum, item) => sum + item.newUsers, 0);
    const totalEvents = trafficData.reduce((sum, item) => sum + item.events, 0);
    const avgBounceRate = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.bounceRate?.toNumber() || 0), 0) / trafficData.length
      : 0;
    const avgEngagementRate = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.engagementRate?.toNumber() || 0), 0) / trafficData.length
      : 0;
    const totalEngagedSessions = trafficData.reduce((sum, item) => sum + (item.engagedSessions || 0), 0);
    const avgSessionDuration = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.averageSessionDuration?.toNumber() || 0), 0) / trafficData.length
      : 0;

    // Format daily data with all metrics
    const dailyData = trafficData.map((item) => ({
      date: item.date.toISOString().split('T')[0],
      pv: item.pv,
      uv: item.uv,
      sessions: item.sessions,
      activeUsers: item.activeUsers,
      newUsers: item.newUsers,
      events: item.events,
      bounceRate: item.bounceRate?.toNumber() || 0,
      engagementRate: item.engagementRate?.toNumber() || 0,
      engagedSessions: item.engagedSessions || 0,
      averageSessionDuration: item.averageSessionDuration?.toNumber() || 0,
      metricsData: item.metricsData || {},
    }));

    return NextResponse.json(
      {
        success: true,
        data: {
          totalPv,
          totalUv,
          totalSessions,
          totalActiveUsers,
          totalNewUsers,
          totalEvents,
          avgBounceRate,
          avgEngagementRate,
          totalEngagedSessions,
          avgSessionDuration,
          dailyData,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Traffic API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch traffic data',
      },
      { status: 500 }
    );
  }
}
