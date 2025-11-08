import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { google } from 'googleapis';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Google Analytics Data API 客户端配置
 * 支持 Service Account 认证方式和代理配置
 */

// 获取代理配置
function getProxyAgent() {
  const proxyUrl = process.env.PROXY_URL || 'http://localhost:7890';
  if (process.env.USE_PROXY === 'true' || process.env.PROXY_URL) {
    console.log(`[GA Client] 使用代理: ${proxyUrl}`);
    return new HttpsProxyAgent(proxyUrl);
  }
  return undefined;
}

export interface GACredentials {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

export interface GAPropertyConfig {
  propertyId: string;
  credentials: GACredentials;
}

export interface GAMetricsResponse {
  pv: number;           // 页面浏览量
  uv: number;           // 活跃用户
  sessions: number;     // 会话数
  bounceRate: number;   // 跳出率
  avgSessionDuration: number;  // 平均会话时长
  conversionRate?: number;
  date: string;
}

export interface GASourceBreakdown {
  source: string;
  users: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
}

export interface GADeviceBreakdown {
  device: string;
  users: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
}

export interface GAPageBreakdown {
  pagePath: string;
  pageTitle?: string;
  pageviews: number;
  users: number;
  bounceRate: number;
  avgTimeOnPage?: number;
}

export class GoogleAnalyticsClient {
  private analyticsDataClient: BetaAnalyticsDataClient;
  private propertyId: string;
  private credentials: GACredentials;

  constructor(config: GAPropertyConfig) {
    this.propertyId = config.propertyId;
    this.credentials = config.credentials;

    // 获取代理配置
    const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://localhost:7890';
    const agent = getProxyAgent() || new HttpsProxyAgent(proxyUrl);

    console.log(`[GA Client] 初始化客户端 - Property: ${this.propertyId}, 代理: ${proxyUrl}`);

    // 初始化 Google Analytics Data API 客户端
    // 通过 fallback 参数配置代理支持
    this.analyticsDataClient = new BetaAnalyticsDataClient({
      credentials: config.credentials as any,
      fallback: true,
      grpc: {
        // 配置 gRPC 使用代理
        'grpc.ssl_target_name_override': '',
      },
    } as any);

    // 为 axios 请求配置代理
    const https = require('https');
    https.globalAgent = agent;
  }

  /**
   * 获取指定日期范围的基础指标
   */
  async getMetrics(
    startDate: string,
    endDate: string
  ): Promise<GAMetricsResponse[]> {
    try {
      const request = {
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: [
          { name: 'activeUsers' },      // 活跃用户
          { name: 'sessions' },          // 会话
          { name: 'screenPageViews' },   // 页面浏览
          { name: 'bounceRate' },        // 跳出率
          { name: 'userEngagementDuration' }, // 用户参与时长
        ],
        dimensions: [{ name: 'date' }],
        orderBys: [
          {
            dimension: { name: 'date' },
            desc: false,
          },
        ],
      };

      const response = await (this.analyticsDataClient as any).runReport(request);
      return this.parseMetricsResponse(response);
    } catch (error) {
      console.error('Failed to fetch GA metrics:', error);
      throw error;
    }
  }

  /**
   * 获取流量来源分析
   */
  async getSourceBreakdown(
    startDate: string,
    endDate: string
  ): Promise<GASourceBreakdown[]> {
    try {
      const sourceMap: { [key: string]: string } = {
        'google': 'organic',
        'direct': 'direct',
        'facebook': 'social',
        'instagram': 'social',
        'twitter': 'social',
        'linkedin': 'social',
        'pinterest': 'social',
        'reddit': 'social',
        'youtube': 'social',
        '(referral)': 'referral',
        '(other)': 'other',
      };

      const request = {
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
        ],
        dimensions: [{ name: 'sessionSource' }],
        orderBys: [
          {
            metric: { name: 'activeUsers' },
            desc: true,
          },
        ],
      };

      const response = await (this.analyticsDataClient as any).runReport(request);
      const results: GASourceBreakdown[] = [];

      if (response[0].rows) {
        for (const row of response[0].rows) {
          const source = row.dimensionValues[0].value;
          const normalizedSource = sourceMap[source.toLowerCase()] || 'other';

          // 合并相同来源的数据
          const existing = results.find((r) => r.source === normalizedSource);
          if (existing) {
            existing.users += parseInt(row.metricValues[0].value, 10) || 0;
            existing.sessions += parseInt(row.metricValues[1].value, 10) || 0;
            existing.pageviews += parseInt(row.metricValues[2].value, 10) || 0;
          } else {
            results.push({
              source: normalizedSource,
              users: parseInt(row.metricValues[0].value, 10) || 0,
              sessions: parseInt(row.metricValues[1].value, 10) || 0,
              pageviews: parseInt(row.metricValues[2].value, 10) || 0,
              bounceRate: parseFloat(row.metricValues[3].value) || 0,
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to fetch GA source breakdown:', error);
      throw error;
    }
  }

  /**
   * 获取设备类型分析
   */
  async getDeviceBreakdown(
    startDate: string,
    endDate: string
  ): Promise<GADeviceBreakdown[]> {
    try {
      const request = {
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
        ],
        dimensions: [{ name: 'deviceCategory' }],
        orderBys: [
          {
            metric: { name: 'activeUsers' },
            desc: true,
          },
        ],
      };

      const response = await (this.analyticsDataClient as any).runReport(request);
      const results: GADeviceBreakdown[] = [];

      if (response[0].rows) {
        for (const row of response[0].rows) {
          results.push({
            device: row.dimensionValues[0].value,
            users: parseInt(row.metricValues[0].value, 10) || 0,
            sessions: parseInt(row.metricValues[1].value, 10) || 0,
            pageviews: parseInt(row.metricValues[2].value, 10) || 0,
            bounceRate: parseFloat(row.metricValues[3].value) || 0,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to fetch GA device breakdown:', error);
      throw error;
    }
  }

  /**
   * 获取页面级别的数据
   */
  async getPageBreakdown(
    startDate: string,
    endDate: string,
    limit: number = 50
  ): Promise<GAPageBreakdown[]> {
    try {
      const request = {
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate,
            endDate,
          },
        ],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'activeUsers' },
          { name: 'bounceRate' },
          { name: 'userEngagementDuration' },
        ],
        dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
        orderBys: [
          {
            metric: { name: 'screenPageViews' },
            desc: true,
          },
        ],
        limit,
      };

      const response = await (this.analyticsDataClient as any).runReport(request);
      const results: GAPageBreakdown[] = [];

      if (response[0].rows) {
        for (const row of response[0].rows) {
          results.push({
            pagePath: row.dimensionValues[0].value,
            pageTitle: row.dimensionValues[1]?.value || undefined,
            pageviews: parseInt(row.metricValues[0].value, 10) || 0,
            users: parseInt(row.metricValues[1].value, 10) || 0,
            bounceRate: parseFloat(row.metricValues[2].value) || 0,
            avgTimeOnPage: parseFloat(row.metricValues[3].value) || undefined,
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to fetch GA page breakdown:', error);
      throw error;
    }
  }

  /**
   * 解析基础指标响应
   */
  private parseMetricsResponse(response: any[]): GAMetricsResponse[] {
    const results: GAMetricsResponse[] = [];

    if (response[0].rows) {
      for (const row of response[0].rows) {
        const date = row.dimensionValues[0].value;
        results.push({
          date,
          uv: parseInt(row.metricValues[0].value, 10) || 0,
          sessions: parseInt(row.metricValues[1].value, 10) || 0,
          pv: parseInt(row.metricValues[2].value, 10) || 0,
          bounceRate: parseFloat(row.metricValues[3].value) || 0,
          avgSessionDuration: parseFloat(row.metricValues[4].value) || 0,
        });
      }
    }

    return results;
  }
}

/**
 * 创建 GA 客户端实例
 */
export function createGAClient(config: GAPropertyConfig): GoogleAnalyticsClient {
  return new GoogleAnalyticsClient(config);
}
