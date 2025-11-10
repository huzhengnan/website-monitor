import { prisma } from '@/lib/prisma';
import {
  GoogleAnalyticsRestClient,
  GACredentials,
  GAMetricsResponse,
} from './google-analytics-rest.service';
import { updateSyncStatus } from './connector.service';
import { getTrafficData, createTrafficData, updateTrafficData } from './traffic.service';


/**
 * 计算日期范围的前一天（用于增量同步）
 */
function getDateRange(days: number = 30): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

/**
 * 同步 Google Analytics 数据
 */
export async function syncGoogleAnalytics(
  connectorId: string,
  days: number = 30
): Promise<{ success: boolean; syncedDays: number; error?: string }> {
  try {
    // 获取连接器信息
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      include: { site: true },
    });

    if (!connector) {
      throw new Error('Connector not found');
    }

    if (connector.type !== 'GoogleAnalytics') {
      throw new Error('Connector is not a Google Analytics connector');
    }

    if (!connector.credentials) {
      throw new Error('Connector credentials are missing');
    }

    // 初始化 GA 客户端
    const credentials = connector.credentials as any as GACredentials;
    const propertyId = (connector.credentials as any).propertyId;

    if (!propertyId) {
      throw new Error('Property ID is missing in connector credentials');
    }

    const gaClient = new GoogleAnalyticsRestClient(propertyId, credentials);

    // 获取日期范围
    const dateRange = getDateRange(days);

    // 获取基础指标
    const metrics = await gaClient.getMetrics(dateRange.startDate, dateRange.endDate);

    // 获取流量来源数据
    const sources = await gaClient.getSourceBreakdown(
      dateRange.startDate,
      dateRange.endDate
    );

    // 获取设备数据
    const devices = await gaClient.getDeviceBreakdown(
      dateRange.startDate,
      dateRange.endDate
    );

    // 获取页面数据
    const pages = await gaClient.getPageBreakdown(dateRange.startDate, dateRange.endDate, 100);

    // 保存数据到数据库
    let syncedDays = 0;
    const siteName = connector.site!.name;

    for (const metric of metrics) {
      try {
        const date = new Date(metric.date);

        // 检查是否已存在该日期的数据
        const existing = await getTrafficData(connector.site!.id, metric.date);

        if (existing) {
          // 更新现有数据
          await updateTrafficData(existing.id, {
            pv: metric.pv,
            uv: metric.uv,
            sessions: metric.sessions,
            bounceRate: metric.bounceRate,
            avgTimeOnPage: metric.avgSessionDuration,
          });
          console.log(`[GA Sync] ✏️ Updated: ${siteName}-${metric.date} - PV: ${metric.pv}, UV: ${metric.uv}, Sessions: ${metric.sessions}`);
        } else {
          // 创建新数据记录
          const sourceData = sources.map((source) => ({
            source: source.source,
            sessions: source.sessions,
            pageviews: source.pageviews,
            bounceRate: source.bounceRate,
          }));

          const deviceData = devices.map((device) => ({
            device: device.device,
            sessions: device.sessions,
            pageviews: device.pageviews,
            bounceRate: device.bounceRate,
          }));

          const pageData = pages.map((page) => ({
            url: page.pagePath,
            title: page.pageTitle,
            pageviews: page.pageviews,
            users: page.users,
            bounceRate: page.bounceRate,
          }));

          const dataKey = `${siteName}-${metric.date}`;
          await createTrafficData({
            siteId: connector.site!.id,
            date: metric.date,
            pv: metric.pv,
            uv: metric.uv,
            sessions: metric.sessions,
            bounceRate: metric.bounceRate,
            avgTimeOnPage: metric.avgSessionDuration,
            sources: sourceData,
            devices: deviceData,
            pages: pageData,
            key: dataKey,
          });
          console.log(`[GA Sync] ✅ Created: ${dataKey} - PV: ${metric.pv}, UV: ${metric.uv}, Sessions: ${metric.sessions}`);
        }

        syncedDays++;
      } catch (error) {
        console.error(`[GA Sync] ❌ Failed: ${siteName} (${metric.date}) -`, error instanceof Error ? error.message : error);
      }
    }

    // 更新同步状态
    await updateSyncStatus(connectorId, 'active');

    return {
      success: true,
      syncedDays,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('GA sync error:', errorMessage);

    // 更新错误状态
    await updateSyncStatus(connectorId, 'error', errorMessage);

    return {
      success: false,
      syncedDays: 0,
      error: errorMessage,
    };
  }
}

/**
 * 批量同步所有 GA 连接器
 */
export async function syncAllGoogleAnalytics(days: number = 30): Promise<
  Array<{
    connectorId: string;
    siteId: string;
    siteName: string;
    success: boolean;
    syncedDays?: number;
    error?: string;
  }>
> {
  // 获取所有活跃的 GA 连接器
  const connectors = await prisma.connector.findMany({
    where: {
      type: 'GoogleAnalytics',
      status: 'active',
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const results = [];

  for (const connector of connectors) {
    try {
      const result = await syncGoogleAnalytics(connector.id, days);
      results.push({
        connectorId: connector.id,
        siteId: connector.site!.id,
        siteName: connector.site!.name,
        success: result.success,
        syncedDays: result.syncedDays,
        error: result.error,
      });
    } catch (error) {
      results.push({
        connectorId: connector.id,
        siteId: connector.site!.id,
        siteName: connector.site!.name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

/**
 * 一次性同步特定时间段的数据
 */
export async function syncGADateRange(
  connectorId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; syncedDays: number; error?: string }> {
  try {
    // 获取连接器信息
    const connector = await prisma.connector.findUnique({
      where: { id: connectorId },
      include: { site: true },
    });

    if (!connector) {
      throw new Error('Connector not found');
    }

    if (connector.type !== 'GoogleAnalytics') {
      throw new Error('Connector is not a Google Analytics connector');
    }

    if (!connector.credentials) {
      throw new Error('Connector credentials are missing');
    }

    // 初始化 GA 客户端
    const credentials = connector.credentials as any as GACredentials;
    const propertyId = (connector.credentials as any).propertyId;

    if (!propertyId) {
      throw new Error('Property ID is missing in connector credentials');
    }

    const gaClient = new GoogleAnalyticsRestClient(propertyId, credentials);

    // 获取数据
    const metrics = await gaClient.getMetrics(startDate, endDate);
    const sources = await gaClient.getSourceBreakdown(startDate, endDate);
    const devices = await gaClient.getDeviceBreakdown(startDate, endDate);
    const pages = await gaClient.getPageBreakdown(startDate, endDate, 100);

    // 保存数据
    let syncedDays = 0;
    const siteName = connector.site!.name;

    for (const metric of metrics) {
      try {
        const existing = await getTrafficData(connector.site!.id, metric.date);

        const sourceData = sources.map((source) => ({
          source: source.source,
          sessions: source.sessions,
          pageviews: source.pageviews,
          bounceRate: source.bounceRate,
        }));

        const deviceData = devices.map((device) => ({
          device: device.device,
          sessions: device.sessions,
          pageviews: device.pageviews,
          bounceRate: device.bounceRate,
        }));

        const pageData = pages.map((page) => ({
          url: page.pagePath,
          title: page.pageTitle,
          pageviews: page.pageviews,
          users: page.users,
          bounceRate: page.bounceRate,
        }));

        if (existing) {
          await updateTrafficData(existing.id, {
            pv: metric.pv,
            uv: metric.uv,
            sessions: metric.sessions,
            bounceRate: metric.bounceRate,
            avgTimeOnPage: metric.avgSessionDuration,
          });
          console.log(`[GA Sync] ✏️ Updated: ${siteName}-${metric.date} - PV: ${metric.pv}, UV: ${metric.uv}, Sessions: ${metric.sessions}`);
        } else {
          const dataKey = `${siteName}-${metric.date}`;
          await createTrafficData({
            siteId: connector.site!.id,
            date: metric.date,
            pv: metric.pv,
            uv: metric.uv,
            sessions: metric.sessions,
            bounceRate: metric.bounceRate,
            avgTimeOnPage: metric.avgSessionDuration,
            sources: sourceData,
            devices: deviceData,
            pages: pageData,
            key: dataKey,
          });
          console.log(`[GA Sync] ✅ Created: ${dataKey} - PV: ${metric.pv}, UV: ${metric.uv}, Sessions: ${metric.sessions}`);
        }

        syncedDays++;
      } catch (error) {
        console.error(`[GA Sync] ❌ Failed: ${siteName} (${metric.date}) -`, error instanceof Error ? error.message : error);
      }
    }

    // 更新同步状态
    await updateSyncStatus(connectorId, 'active');

    return {
      success: true,
      syncedDays,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('GA date range sync error:', errorMessage);

    await updateSyncStatus(connectorId, 'error', errorMessage);

    return {
      success: false,
      syncedDays: 0,
      error: errorMessage,
    };
  }
}
