import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

export interface SearchConsoleMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  query?: string;
  page?: string;
  device?: string;
  country?: string;
}

export interface SearchConsoleData {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  topQueries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topPages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  topDevices: Array<{
    device: string;
    clicks: number;
    impressions: number;
    ctr: number;
  }>;
}

export class GoogleSearchConsoleService {
  private webmasters: any;

  constructor() {
    try {
      // Try to find the service account key file
      const keyPaths = [
        path.join(process.cwd(), 'google-cloud-acount.json'), // Note: typo in filename
        path.join(process.cwd(), 'google-cloud-account.json'),
        process.env.GOOGLE_CLOUD_ACCOUNT_JSON || '',
      ];

      let keyData = null;
      let keyPath = '';

      for (const p of keyPaths) {
        if (p && fs.existsSync(p)) {
          keyData = JSON.parse(fs.readFileSync(p, 'utf-8'));
          keyPath = p;
          break;
        }
      }

      if (!keyData) {
        console.warn('[Google Search Console] Service account key not found. Some features will be disabled.');
        return;
      }

      // ⚠️ IMPORTANT: Do NOT use proxy for Google Search Console
      // Proxy can interfere with OAuth2 authentication and cause 403 permission errors
      // Even if HTTP_PROXY/HTTPS_PROXY is set globally, we disable it for googleapis
      const https = require('https');
      const http = require('http');

      // Clear global agents to prevent proxy interference
      // googleapis will create its own agents without proxy
      delete process.env.HTTP_PROXY;
      delete process.env.HTTPS_PROXY;
      delete process.env.http_proxy;
      delete process.env.https_proxy;

      console.log('[Google Search Console] Proxy disabled for GSC (OAuth2 requires direct connection)');

      const authOptions: any = {
        credentials: keyData,
        scopes: [
          'https://www.googleapis.com/auth/webmasters',
          'https://www.googleapis.com/auth/webmasters.readonly',
        ],
      };

      const auth = new google.auth.GoogleAuth(authOptions);

      this.webmasters = google.webmasters({
        version: 'v3',
        auth,
      });

      console.log('[Google Search Console] Service initialized successfully');
    } catch (error) {
      console.error('[Google Search Console] Failed to initialize service:', error);
    }
  }

  async getSearchData(
    siteUrl: string,
    startDate: string,
    endDate: string,
    dimension: 'query' | 'page' | 'device' = 'query',
    rowLimit: number = 1000
  ): Promise<SearchConsoleMetrics[]> {
    if (!this.webmasters) {
      throw new Error('Google Search Console service not initialized');
    }

    try {
      const normalizedUrl = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';

      console.log(
        `[Google Search Console] Fetching ${dimension} data for ${normalizedUrl} (${startDate} to ${endDate})`
      );

      const response = await this.webmasters.searchanalytics.query({
        siteUrl: normalizedUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: [dimension],
          rowLimit,
        },
      });

      const rows = response.data.rows || [];

      return rows.map((row: any) => ({
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
        position: row.position ? parseFloat(row.position.toFixed(1)) : 0,
        query: row.keys?.[0],
        page: row.keys?.[0],
        device: row.keys?.[0],
      }));
    } catch (error: any) {
      console.error('[Google Search Console] Error fetching data:', {
        siteUrl,
        startDate,
        endDate,
        dimension,
        error: error.message,
      });
      throw error;
    }
  }

  async getDailyData(
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<any[]> {
    if (!this.webmasters) {
      throw new Error('Google Search Console service not initialized');
    }

    try {
      const normalizedUrl = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';

      const response = await this.webmasters.searchanalytics.query({
        siteUrl: normalizedUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['date'],
          rowLimit: 500,
        },
      });

      return response.data.rows || [];
    } catch (error: any) {
      console.error('[Google Search Console] Error fetching daily data:', error.message);
      throw error;
    }
  }

  async getSearchDataSummary(
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<SearchConsoleData> {
    if (!this.webmasters) {
      throw new Error('Google Search Console service not initialized');
    }

    try {
      const normalizedUrl = siteUrl.endsWith('/') ? siteUrl : siteUrl + '/';

      console.log(
        `[Google Search Console] Fetching summary for ${normalizedUrl} (${startDate} to ${endDate})`
      );

      // 获取总体数据
      const overallResponse = await this.webmasters.searchanalytics.query({
        siteUrl: normalizedUrl,
        requestBody: {
          startDate,
          endDate,
          rowLimit: 1,
        },
      });

      const totalRow = overallResponse.data.rows?.[0];
      const totalClicks = totalRow?.clicks || 0;
      const totalImpressions = totalRow?.impressions || 0;
      const avgCtr = totalRow?.ctr ? parseFloat((totalRow.ctr * 100).toFixed(2)) : 0;
      const avgPosition = totalRow?.position ? parseFloat(totalRow.position.toFixed(1)) : 0;

      console.log(`[Google Search Console] Overall metrics - Clicks: ${totalClicks}, Impressions: ${totalImpressions}`);

      // 获取热门关键词
      const queriesResponse = await this.webmasters.searchanalytics.query({
        siteUrl: normalizedUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: 10,
        },
      });

      const topQueries = (queriesResponse.data.rows || []).map((row: any) => ({
        query: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
        position: row.position ? parseFloat(row.position.toFixed(1)) : 0,
      }));

      console.log(`[Google Search Console] Top queries found: ${topQueries.length}`);

      // 获取热门页面
      const pagesResponse = await this.webmasters.searchanalytics.query({
        siteUrl: normalizedUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: 10,
        },
      });

      const topPages = (pagesResponse.data.rows || []).map((row: any) => ({
        page: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
        position: row.position ? parseFloat(row.position.toFixed(1)) : 0,
      }));

      console.log(`[Google Search Console] Top pages found: ${topPages.length}`);

      // 获取设备数据
      const devicesResponse = await this.webmasters.searchanalytics.query({
        siteUrl: normalizedUrl,
        requestBody: {
          startDate,
          endDate,
          dimensions: ['device'],
          rowLimit: 10,
        },
      });

      const topDevices = (devicesResponse.data.rows || []).map((row: any) => ({
        device: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
      }));

      return {
        totalClicks,
        totalImpressions,
        avgCtr,
        avgPosition,
        topQueries,
        topPages,
        topDevices,
      };
    } catch (error: any) {
      console.error('[Google Search Console] Error fetching summary:', {
        siteUrl,
        startDate,
        endDate,
        error: error.message,
        status: error.status || error.code,
        cause: error.cause?.message,
      });

      // 更详细的权限错误信息
      if (error.status === 403 || error.code === 403) {
        console.error('[Google Search Console] Permission Error Details:', {
          message: error.message,
          cause: error.cause?.message,
          errors: error.errors,
        });
      }

      throw error;
    }
  }
}

// 导出单例
let searchConsoleService: GoogleSearchConsoleService | null = null;

export function getSearchConsoleService(): GoogleSearchConsoleService {
  if (!searchConsoleService) {
    searchConsoleService = new GoogleSearchConsoleService();
  }
  return searchConsoleService;
}
