import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import * as jwt from 'jsonwebtoken';

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

export interface GAMetricsResponse {
  pv: number;
  uv: number;
  sessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  userEngagementDuration?: number;
  conversionRate?: number;
  date: string;
  activeUsers?: number;
  newUsers?: number;
  events?: number;
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

export class GoogleAnalyticsRestClient {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private credentials: GACredentials | null = null;
  private propertyId: string;

  constructor(propertyId: string, credentials: GACredentials) {
    this.propertyId = propertyId;
    this.credentials = credentials;

    // Setup proxy
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    let proxyUrl = httpsProxy || httpProxy;

    // Fallback to default proxy
    if (!proxyUrl) {
      proxyUrl = 'http://localhost:7890';
    }

    console.log('[GA REST API] Using proxy:', proxyUrl);

    const axiosConfig: any = {
      timeout: 60000,
    };

    try {
      const httpsAgent = new HttpsProxyAgent(proxyUrl);
      const httpAgent = new HttpProxyAgent(proxyUrl);
      axiosConfig.httpAgent = httpAgent;
      axiosConfig.httpsAgent = httpsAgent;
      console.log('[GA REST API] ✓ Proxy agents configured');
    } catch (error: any) {
      console.error('[GA REST API] Failed to create proxy agents:', error.message);
      throw error;
    }

    this.client = axios.create(axiosConfig);
    console.log('[GA REST API] Client initialized');
  }

  /**
   * Get OAuth 2.0 access token using Service Account
   */
  private async getAccessToken(): Promise<string> {
    if (!this.credentials) {
      throw new Error('Service account credentials not available');
    }

    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('[GA REST API] Getting access token...');

      // Create JWT claim set
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: this.credentials.client_email,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: this.credentials.token_uri,
        exp: now + 3600,
        iat: now,
      };

      console.log('[GA REST API] Signing JWT...');
      const token = jwt.sign(claim, this.credentials.private_key, {
        algorithm: 'RS256' as any,
        header: {
          typ: 'JWT',
        },
      } as any);
      console.log('[GA REST API] ✓ JWT signed');

      console.log('[GA REST API] Exchanging JWT for access token...');
      const response = await this.client.post(this.credentials.token_uri, {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      });

      this.accessToken = response.data.access_token || null;
      this.tokenExpiry = now + (response.data.expires_in - 60);

      console.log('[GA REST API] ✓ Got access token');
      return this.accessToken || '';
    } catch (error: any) {
      console.error('[GA REST API] Failed to get access token:', {
        status: error.response?.status,
        message: error.message,
        data: error.response?.data,
      });
      throw error;
    }
  }

  /**
   * Get metrics data from Google Analytics 4
   */
  async getMetrics(startDate: string, endDate: string): Promise<GAMetricsResponse[]> {
    try {
      const accessToken = await this.getAccessToken();

      console.log(`[GA REST API] Fetching metrics for property ${this.propertyId}`);
      console.log(`[GA REST API] Date range: ${startDate} to ${endDate}`);

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + this.propertyId + ':runReport';

      console.log('[GA REST API] Making request to:', url);

      const response = await this.client.post(
        url,
        {
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
            { name: 'userEngagementDuration' },
            { name: 'newUsers' },
            { name: 'eventCount' },
            { name: 'averageSessionDuration' },
          ],
          dimensions: [{ name: 'date' }],
          orderBys: [
            {
              dimension: { name: 'date' },
              desc: false,
            },
          ],
        },
        { headers }
      );

      console.log('[GA REST API] ✓ Got response, parsing metrics...');

      const results: GAMetricsResponse[] = [];

      if (response.data.rows) {
        for (const row of response.data.rows) {
          const date = row.dimensionValues[0].value;
          results.push({
            date,
            activeUsers: parseInt(row.metricValues[0].value, 10) || 0,
            sessions: parseInt(row.metricValues[1].value, 10) || 0,
            pv: parseInt(row.metricValues[2].value, 10) || 0,
            bounceRate: parseFloat(row.metricValues[3].value) || 0,
            userEngagementDuration: parseFloat(row.metricValues[4].value) || 0,
            newUsers: parseInt(row.metricValues[5].value, 10) || 0,
            events: parseInt(row.metricValues[6].value, 10) || 0,
            avgSessionDuration: parseFloat(row.metricValues[7].value) || 0,
            uv: parseInt(row.metricValues[5].value, 10) || 0, // Map newUsers to uv
          });
        }
      }

      console.log(`[GA REST API] ✓ Parsed ${results.length} days of metrics`);
      return results;
    } catch (error: any) {
      console.error('[GA REST API] Error fetching metrics:', {
        propertyId: this.propertyId,
        startDate,
        endDate,
        status: error.response?.status,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Get list of GA4 properties
   */
  async getProperties(): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();

      console.log('[GA REST API] Fetching GA4 properties...');

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const url = `https://analyticsadmin.googleapis.com/v1beta/accounts/-/properties`;

      const response = await this.client.get(url, { headers });

      const properties = response.data.properties || [];
      console.log(`[GA REST API] ✓ Found ${properties.length} properties`);
      return properties;
    } catch (error: any) {
      console.error('[GA REST API] Error fetching properties:', {
        message: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Get traffic source breakdown
   */
  async getSourceBreakdown(
    startDate: string,
    endDate: string
  ): Promise<GASourceBreakdown[]> {
    try {
      const accessToken = await this.getAccessToken();

      console.log('[GA REST API] Fetching source breakdown...');

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + this.propertyId + ':runReport';

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

      const response = await this.client.post(
        url,
        {
          dateRanges: [{ startDate, endDate }],
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
        },
        { headers }
      );

      const results: GASourceBreakdown[] = [];

      if (response.data.rows) {
        for (const row of response.data.rows) {
          const source = row.dimensionValues[0].value;
          const normalizedSource = sourceMap[source.toLowerCase()] || 'other';

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

      console.log(`[GA REST API] ✓ Found ${results.length} sources`);
      return results;
    } catch (error: any) {
      console.error('[GA REST API] Error fetching source breakdown:', {
        message: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Get device breakdown
   */
  async getDeviceBreakdown(
    startDate: string,
    endDate: string
  ): Promise<GADeviceBreakdown[]> {
    try {
      const accessToken = await this.getAccessToken();

      console.log('[GA REST API] Fetching device breakdown...');

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + this.propertyId + ':runReport';

      const response = await this.client.post(
        url,
        {
          dateRanges: [{ startDate, endDate }],
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
        },
        { headers }
      );

      const results: GADeviceBreakdown[] = [];

      if (response.data.rows) {
        for (const row of response.data.rows) {
          results.push({
            device: row.dimensionValues[0].value,
            users: parseInt(row.metricValues[0].value, 10) || 0,
            sessions: parseInt(row.metricValues[1].value, 10) || 0,
            pageviews: parseInt(row.metricValues[2].value, 10) || 0,
            bounceRate: parseFloat(row.metricValues[3].value) || 0,
          });
        }
      }

      console.log(`[GA REST API] ✓ Found ${results.length} devices`);
      return results;
    } catch (error: any) {
      console.error('[GA REST API] Error fetching device breakdown:', {
        message: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Get page breakdown
   */
  async getPageBreakdown(
    startDate: string,
    endDate: string,
    limit: number = 50
  ): Promise<GAPageBreakdown[]> {
    try {
      const accessToken = await this.getAccessToken();

      console.log('[GA REST API] Fetching page breakdown...');

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + this.propertyId + ':runReport';

      const response = await this.client.post(
        url,
        {
          dateRanges: [{ startDate, endDate }],
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
        },
        { headers }
      );

      const results: GAPageBreakdown[] = [];

      if (response.data.rows) {
        for (const row of response.data.rows) {
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

      console.log(`[GA REST API] ✓ Found ${results.length} pages`);
      return results;
    } catch (error: any) {
      console.error('[GA REST API] Error fetching page breakdown:', {
        message: error.message,
        status: error.response?.status,
      });
      throw error;
    }
  }

  /**
   * Get raw session sources (un-normalized), distinct list
   */
  async getSessionSources(startDate: string, endDate: string): Promise<string[]> {
    const accessToken = await this.getAccessToken();
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };
    const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + this.propertyId + ':runReport';
    const response = await this.client.post(
      url,
      {
        dateRanges: [{ startDate, endDate }],
        metrics: [ { name: 'sessions' } ],
        dimensions: [{ name: 'sessionSource' }],
        orderBys: [ { metric: { name: 'sessions' }, desc: true } ],
        limit: 10000,
      },
      { headers }
    );
    const set = new Set<string>();
    if (response.data?.rows) {
      for (const row of response.data.rows) {
        const src = (row.dimensionValues?.[0]?.value || '').toString().toLowerCase();
        if (src) set.add(src);
      }
    }
    return Array.from(set);
  }
}

/**
 * Create GA client instance
 */
export function createGARestClient(propertyId: string, credentials: GACredentials): GoogleAnalyticsRestClient {
  return new GoogleAnalyticsRestClient(propertyId, credentials);
}
