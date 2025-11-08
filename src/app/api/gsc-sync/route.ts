import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSearchConsoleRestService } from '@/lib/services/google-search-console-rest.service';

interface SyncResult {
  siteId: string;
  domain: string;
  success: boolean;
  clicks?: number;
  impressions?: number;
  error?: string;
  message?: string;
}

/**
 * Calculate date range based on days parameter
 * 与 /api/sites/[id]/gsc-data 保持一致逻辑
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

    const startDate = new Date(endDate); // 从endDate开始往回推
    startDate.setDate(startDate.getDate() - days + 1); // 往前推N-1天（包含endDate这一天）

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { days, siteId, startDate: customStartDate, endDate: customEndDate } = body;

    console.log(`[GSC Sync API] Starting sync, days=${days}, siteId=${siteId || 'all'}, customDates=${customStartDate ? `${customStartDate}-${customEndDate}` : 'none'}`);

    let sites;

    if (siteId) {
      // Sync single site
      const site = await prisma.site.findUnique({
        where: { id: siteId },
        select: {
          id: true,
          domain: true,
          name: true,
        },
      });

      if (!site) {
        return NextResponse.json(
          {
            success: false,
            error: `Site with ID ${siteId} not found`,
          },
          { status: 404 }
        );
      }

      sites = [site];
      console.log(`[GSC Sync API] Syncing single site: ${site.domain}`);
    } else {
      // Sync all active sites
      sites = await prisma.site.findMany({
        where: {
          deletedAt: null,
          status: 'online',
        },
        select: {
          id: true,
          domain: true,
          name: true,
        },
      });

      console.log(`[GSC Sync API] Found ${sites.length} active sites`);

      if (sites.length === 0) {
        return NextResponse.json(
          {
            success: true,
            data: {
              total: 0,
              successful: 0,
              failed: 0,
              dateRange: { startDate: '', endDate: '' },
              results: [],
            },
          },
          { status: 200 }
        );
      }
    }

    // Use custom dates if provided, otherwise use days parameter
    let startDate: string, endDate: string;
    if (customStartDate && customEndDate) {
      startDate = customStartDate;
      endDate = customEndDate;
      console.log(`[GSC Sync API] Using custom date range: ${startDate} to ${endDate}`);
    } else if (days) {
      const range = getDateRange(days);
      startDate = range.startDate;
      endDate = range.endDate;
      console.log(`[GSC Sync API] Using preset date range (${days} days): ${startDate} to ${endDate}`);
    } else {
      throw new Error('Either days or custom date range must be provided');
    }

    const service = getSearchConsoleRestService();
    const results: SyncResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Sync each site
    for (const site of sites) {
      try {
        console.log(`[GSC Sync API] Syncing site: ${site.domain}`);

        // Fetch daily GSC data
        const dailyData = await service.getSearchDataDaily(site.domain, startDate, endDate);
        console.log(`[GSC Sync API] Received ${dailyData.length} days of data for ${site.domain}`);

        let totalSyncedClicks = 0;
        let totalSyncedImpressions = 0;

        // Store each day's data separately
        for (const day of dailyData) {
          // Keep date in UTC format: YYYY-MM-DD becomes YYYY-MM-DDTHH:mm:ssZ
          const dayDate = new Date(day.date + 'T00:00:00Z');

          const record = await prisma.searchConsoleData.upsert({
            where: {
              siteId_date: {
                siteId: site.id,
                date: dayDate,
              },
            },
            update: {
              totalClicks: day.clicks,
              totalImpressions: day.impressions,
              avgCtr: day.ctr,
              avgPosition: day.position,
              updatedAt: new Date(),
            },
            create: {
              siteId: site.id,
              date: dayDate,
              totalClicks: day.clicks,
              totalImpressions: day.impressions,
              avgCtr: day.ctr,
              avgPosition: day.position,
              topQueries: [],
              topPages: [],
              topDevices: [],
            },
          });

          totalSyncedClicks += day.clicks;
          totalSyncedImpressions += day.impressions;
        }

        results.push({
          siteId: site.id,
          domain: site.domain,
          success: true,
          clicks: totalSyncedClicks,
          impressions: totalSyncedImpressions,
          message: `Synced ${dailyData.length} days: ${totalSyncedClicks} clicks and ${totalSyncedImpressions} impressions`,
        });

        successCount++;
        console.log(`[GSC Sync API] ✓ Synced ${site.domain}: ${dailyData.length} days, ${totalSyncedClicks} clicks, ${totalSyncedImpressions} impressions`);
      } catch (error: any) {
        failureCount++;
        const errorMessage = error.message || 'Unknown error';
        results.push({
          siteId: site.id,
          domain: site.domain,
          success: false,
          error: errorMessage,
        });
        console.error(`[GSC Sync API] ✗ Failed to sync ${site.domain}:`, errorMessage);
      }
    }

    console.log(`[GSC Sync API] Sync completed: ${successCount} successful, ${failureCount} failed`);

    return NextResponse.json(
      {
        success: true,
        data: {
          total: sites.length,
          successful: successCount,
          failed: failureCount,
          dateRange: { startDate, endDate },
          results,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[GSC Sync API] Error:', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync GSC data',
      },
      { status: 500 }
    );
  }
}
