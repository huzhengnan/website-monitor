import { prisma } from '@/lib/prisma';
import { getSearchConsoleRestService } from './google-search-console-rest.service';
import { updateSiteEvaluation } from './evaluation.service';

/**
 * Sync GSC data for a specific site and date range
 */
export async function syncGSCDataForSite(
  siteId: string,
  domain: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; syncedDays: number; error?: string }> {
  try {
    console.log(`[GSC Sync] Starting sync for site ${siteId}, domain ${domain}, range ${startDate} to ${endDate}`);

    // Get GSC service
    const gscService = getSearchConsoleRestService();
    if (!gscService) {
      return { success: false, syncedDays: 0, error: 'GSC service not initialized' };
    }

    // Fetch daily data from Google Search Console
    const dailyData = await (gscService as any).getSearchDataDaily(domain, startDate, endDate);

    if (!dailyData || dailyData.length === 0) {
      console.log(`[GSC Sync] No GSC data found for date range ${startDate} to ${endDate}`);
      return { success: true, syncedDays: 0 };
    }

    console.log(`[GSC Sync] Fetched ${dailyData.length} days of GSC data`);

    // Sync each day's data to the database
    let syncedDays = 0;
    for (const day of dailyData) {
      try {
        const date = new Date(day.date + 'T00:00:00Z');

        // Upsert the record
        await prisma.searchConsoleData.upsert({
          where: { siteId_date: { siteId, date } },
          update: {
            totalClicks: day.clicks || 0,
            totalImpressions: day.impressions || 0,
            avgCtr: day.ctr ? parseFloat(day.ctr.toString()) : null,
            avgPosition: day.position ? parseFloat(day.position.toString()) : null,
            topQueries: day.topQueries ? JSON.parse(JSON.stringify(day.topQueries)) : null,
            topPages: day.topPages ? JSON.parse(JSON.stringify(day.topPages)) : null,
            topDevices: day.topDevices ? JSON.parse(JSON.stringify(day.topDevices)) : null,
          },
          create: {
            siteId,
            date,
            totalClicks: day.clicks || 0,
            totalImpressions: day.impressions || 0,
            avgCtr: day.ctr ? parseFloat(day.ctr.toString()) : null,
            avgPosition: day.position ? parseFloat(day.position.toString()) : null,
            topQueries: day.topQueries ? JSON.parse(JSON.stringify(day.topQueries)) : null,
            topPages: day.topPages ? JSON.parse(JSON.stringify(day.topPages)) : null,
            topDevices: day.topDevices ? JSON.parse(JSON.stringify(day.topDevices)) : null,
          },
        });

        syncedDays++;
      } catch (err) {
        console.error(`[GSC Sync] Failed to sync data for ${day.date}:`, err);
        // Continue with next day
      }
    }

    console.log(`[GSC Sync] ✓ Successfully synced ${syncedDays} days of GSC data for site ${siteId}`);

    // 同步完成后更新网站评分
    console.log(`[GSC Sync] Updating evaluation for site ${siteId}...`);
    await updateSiteEvaluation(siteId);

    return { success: true, syncedDays };
  } catch (error: any) {
    console.error('[GSC Sync] Error syncing GSC data:', error);
    return {
      success: false,
      syncedDays: 0,
      error: error.message || 'Failed to sync GSC data',
    };
  }
}

/**
 * Sync GSC data for all sites with Google Search Console configured
 */
export async function syncAllGSCData(days: number = 90): Promise<{ success: boolean; totalSyncedDays: number; error?: string }> {
  try {
    console.log(`[GSC Sync] Starting sync for all sites, last ${days} days`);

    // Get all sites with domain
    const sites = await prisma.site.findMany({
      where: {
        domain: { not: '' },
        deletedAt: null,
      },
    });

    console.log(`[GSC Sync] Found ${sites.length} sites to sync`);

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    let totalSyncedDays = 0;

    for (const site of sites) {
      const result = await syncGSCDataForSite(site.id, site.domain!, start, end);
      if (result.success) {
        totalSyncedDays += result.syncedDays;
      }
    }

    console.log(`[GSC Sync] ✓ Synced ${totalSyncedDays} days total across ${sites.length} sites`);

    return { success: true, totalSyncedDays };
  } catch (error: any) {
    console.error('[GSC Sync] Error syncing GSC data:', error);
    return {
      success: false,
      totalSyncedDays: 0,
      error: error.message || 'Failed to sync GSC data',
    };
  }
}
