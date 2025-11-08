import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Calculate date range based on days parameter
 * 与前端 loadTrafficData 逻辑保持一致
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const days = request.nextUrl.searchParams.get('days');
    const daysNum = days ? parseInt(days) : 1;

    console.log(`[GSC Data API] Fetching GSC data for site ${id}, days=${daysNum}`);

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

    const { startDate, endDate } = getDateRange(daysNum);

    // Fetch GSC data for the date range
    const gscDataRecords = await prisma.searchConsoleData.findMany({
      where: {
        siteId: id,
        date: {
          gte: new Date(startDate + "T00:00:00Z"),
          lte: new Date(endDate + "T23:59:59Z"),
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Aggregate data
    const totalClicks = gscDataRecords.reduce((sum, record) => sum + record.totalClicks, 0);
    const totalImpressions = gscDataRecords.reduce(
      (sum, record) => sum + record.totalImpressions,
      0
    );
    const avgCtr =
      gscDataRecords.length > 0
        ? gscDataRecords.reduce((sum, record) => sum + (Number(record.avgCtr) || 0), 0) /
          gscDataRecords.length
        : 0;
    const avgPosition =
      gscDataRecords.length > 0
        ? gscDataRecords.reduce((sum, record) => sum + (Number(record.avgPosition) || 0), 0) /
          gscDataRecords.length
        : 0;

    // Daily data for trend chart
    const dailyData = gscDataRecords.map((record) => ({
      date: record.date.toISOString().split('T')[0],
      clicks: record.totalClicks,
      impressions: record.totalImpressions,
      ctr: record.avgCtr || 0,
      position: record.avgPosition || 0,
    }));

    console.log(`[GSC Data API] ✓ Fetched ${gscDataRecords.length} GSC records for site ${id}`);

    return NextResponse.json({
      success: true,
      data: {
        totalClicks,
        totalImpressions,
        avgCtr: parseFloat(avgCtr.toFixed(2)),
        avgPosition: parseFloat(avgPosition.toFixed(2)),
        dailyData,
        recordCount: gscDataRecords.length,
      },
    });
  } catch (error: any) {
    console.error('[GSC Data API] Error:', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch GSC data',
      },
      { status: 500 }
    );
  }
}
