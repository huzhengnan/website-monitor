import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import * as jwt from 'jsonwebtoken';

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

export class GoogleSearchConsoleRestService {
  private client!: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private credentials: any;
  private fallbackCredentials: any = null; // Secondary service account for fallback
  private currentCredentials: any = null; // Track which credentials are currently being used

  constructor() {
    try {
      // Load primary service account (website-analytics)
      const primaryPaths = [
        path.join(process.cwd(), 'google-cloud-acount.json'), // Note: typo in filename (website-analytics)
        path.join(process.cwd(), 'google-cloud-account.json'),
        process.env.GOOGLE_CLOUD_ACCOUNT_JSON || '',
      ];

      let primaryKeyData = null;
      for (const p of primaryPaths) {
        if (p && fs.existsSync(p)) {
          primaryKeyData = JSON.parse(fs.readFileSync(p, 'utf-8'));
          console.log(`[Google Search Console REST] Loaded primary credentials: ${primaryKeyData.client_email}`);
          break;
        }
      }

      // Load fallback service account (gsc-mcp-server)
      const fallbackPaths = [
        path.join(process.cwd(), 'gsc-mcp-service-account.json'), // MCP service account as fallback
      ];

      let fallbackKeyData = null;
      for (const p of fallbackPaths) {
        if (p && fs.existsSync(p)) {
          fallbackKeyData = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (fallbackKeyData.client_email !== primaryKeyData?.client_email) {
            console.log(`[Google Search Console REST] Loaded fallback credentials: ${fallbackKeyData.client_email}`);
            break;
          }
        }
      }

      // Use primary if available, otherwise fallback
      this.credentials = primaryKeyData || fallbackKeyData;
      this.fallbackCredentials = fallbackKeyData;
      this.currentCredentials = this.credentials;

      if (!this.credentials) {
        console.warn('[Google Search Console REST] Service account key not found.');
        return;
      }

      // Setup proxy if configured - try multiple ways to get proxy URL
      const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
      const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
      const allEnvKeys = Object.keys(process.env);
      const proxyEnvKey = allEnvKeys.find(k => k.toUpperCase().includes('PROXY'));

      let proxyUrl = httpsProxy || httpProxy;

      // Debug: log all environment keys
      console.log('[Google Search Console REST] All env proxy-related keys:', {
        allProxyKeys: allEnvKeys.filter(k => k.toLowerCase().includes('proxy')),
      });

      console.log('[Google Search Console REST] Proxy config (attempt 1):', {
        HTTP_PROXY: process.env.HTTP_PROXY,
        http_proxy: process.env.http_proxy,
        HTTPS_PROXY: process.env.HTTPS_PROXY,
        https_proxy: process.env.https_proxy,
        detectedProxyUrl: proxyUrl,
      });

      // Fallback: hardcode localhost:7890 if no proxy found
      if (!proxyUrl) {
        console.log('[Google Search Console REST] No proxy env vars found, using default localhost:7890');
        proxyUrl = 'http://localhost:7890';
      }

      console.log('[Google Search Console REST] Final proxy URL:', proxyUrl);

      const axiosConfig: any = {
        timeout: 60000, // Increase timeout for proxy
      };

      // Always use proxy for GSC
      console.log('[Google Search Console REST] Configuring proxy:', proxyUrl);
      try {
        const httpsAgent = new HttpsProxyAgent(proxyUrl);
        const httpAgent = new HttpProxyAgent(proxyUrl);
        axiosConfig.httpAgent = httpAgent;
        axiosConfig.httpsAgent = httpsAgent;
        console.log('[Google Search Console REST] ✓ Proxy agents configured successfully');
        console.log('[Google Search Console REST] Using proxy URL:', proxyUrl);
      } catch (error: any) {
        console.error('[Google Search Console REST] Failed to create proxy agents:', error.message);
        throw error;
      }

      this.client = axios.create(axiosConfig);
      console.log('[Google Search Console REST] Axios client created with config:', {
        timeout: axiosConfig.timeout,
        hasHttpAgent: !!axiosConfig.httpAgent,
        hasHttpsAgent: !!axiosConfig.httpsAgent,
      });

      console.log('[Google Search Console REST] Service initialized successfully');
    } catch (error) {
      console.error('[Google Search Console REST] Failed to initialize service:', error);
    }
  }

  /**
   * Get list of accessible sites from GSC
   */
  private async getAccessibleSites(): Promise<string[]> {
    try {
      const accessToken = await this.getAccessToken();

      console.log('[Google Search Console REST] Fetching accessible sites...');

      const response = await this.client.get(
        'https://www.googleapis.com/webmasters/v3/sites',
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const sites = response.data.siteEntry || [];
      const siteUrls = sites.map((site: any) => site.siteUrl);
      console.log(`[Google Search Console REST] ✓ Found ${siteUrls.length} accessible sites`);
      return siteUrls;
    } catch (error) {
      console.error('[Google Search Console REST] Failed to fetch accessible sites:', error);
      return [];
    }
  }

  /**
   * Find matching site URL format from accessible sites
   */
  private async findMatchingSiteUrl(domain: string): Promise<string | null> {
    const sites = await this.getAccessibleSites();
    const normalizedDomain = domain.toLowerCase().replace('www.', '');

    for (const site of sites) {
      let siteDomain = site.toLowerCase();

      // Extract domain from sc-domain: format
      if (siteDomain.includes('sc-domain:')) {
        siteDomain = siteDomain.split('sc-domain:')[1];
      } else {
        // Extract domain from https:// format
        siteDomain = siteDomain.split('://')[1] || siteDomain;
      }

      siteDomain = siteDomain.replace('www.', '').replace(/\/$/, '');

      if (siteDomain === normalizedDomain) {
        console.log(`[Google Search Console REST] ✓ Matched site format: ${site}`);
        return site;
      }
    }

    return null;
  }

  /**
   * Get OAuth 2.0 access token using Service Account
   */
  private async getAccessToken(useCredentials: any = null): Promise<string> {
    const creds = useCredentials || this.currentCredentials;

    if (!creds) {
      throw new Error('Service account credentials not available');
    }

    // Only use cache if using the same credentials
    if (useCredentials === null && this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      console.log('[Google Search Console REST] Getting access token...');
      console.log('[Google Search Console REST] Service account:', creds.client_email);

      // Create JWT claim set
      const now = Math.floor(Date.now() / 1000);
      const claim = {
        iss: creds.client_email,
        scope: 'https://www.googleapis.com/auth/webmasters https://www.googleapis.com/auth/webmasters.readonly',
        aud: creds.token_uri,
        exp: now + 3600,
        iat: now,
      };

      console.log('[Google Search Console REST] Signing JWT...');
      // Sign JWT with private key
      const token = jwt.sign(claim, creds.private_key, {
        algorithm: 'RS256' as any,
        header: {
          typ: 'JWT',
        },
      } as any);
      console.log('[Google Search Console REST] ✓ JWT signed successfully');

      // Exchange JWT for access token
      console.log('[Google Search Console REST] Exchanging JWT for access token...');
      console.log('[Google Search Console REST] Token URI:', creds.token_uri);
      const response = await this.client.post(creds.token_uri, {
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      });
      console.log('[Google Search Console REST] ✓ Got token response');

      // Only cache if using primary credentials
      if (useCredentials === null) {
        this.accessToken = response.data.access_token || null;
        this.tokenExpiry = now + (response.data.expires_in - 60); // 60 second buffer
      }

      console.log('[Google Search Console REST] Got access token successfully');
      return response.data.access_token || '';
    } catch (error: any) {
      console.error('[Google Search Console REST] Failed to get access token:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Get search analytics data from Google Search Console
   * Supports fallback to secondary service account if primary doesn't have permission
   */
  async getSearchDataSummary(
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<SearchConsoleData> {
    if (!this.credentials) {
      throw new Error('Google Search Console service not initialized');
    }

    try {
      return await this.fetchSearchData(siteUrl, startDate, endDate, this.credentials);
    } catch (error: any) {
      // If primary service account fails with 403 and fallback exists, try fallback
      if (error.response?.status === 403 && this.fallbackCredentials) {
        console.log('[Google Search Console REST] Primary service account denied, trying fallback...');
        try {
          return await this.fetchSearchData(siteUrl, startDate, endDate, this.fallbackCredentials);
        } catch (fallbackError) {
          console.error('[Google Search Console REST] Fallback service account also failed');
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  /**
   * Internal method to fetch search data with specific credentials
   */
  private async fetchSearchData(
    siteUrl: string,
    startDate: string,
    endDate: string,
    credentials: any
  ): Promise<SearchConsoleData> {
    try {
      const accessToken = await this.getAccessToken(credentials);

      // Extract domain from the provided URL
      const urlObj = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
      const domain = urlObj.hostname;

      console.log(`[Google Search Console REST] Looking for matching site format for domain: ${domain}`);

      // Find the correct site URL format from accessible sites
      const matchedSiteUrl = await this.findMatchingSiteUrl(domain);
      const finalSiteUrl = matchedSiteUrl || `sc-domain:${domain}`;

      const encodedSiteUrl = encodeURIComponent(finalSiteUrl);

      console.log(`[Google Search Console REST] Fetching summary for ${finalSiteUrl}`);

      // Create request headers with auth token
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      // Get overall data
      console.log('[Google Search Console REST] Fetching overall metrics...');
      const overallUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;
      console.log('[Google Search Console REST] Request URL:', overallUrl);
      const overallResponse = await this.client.post(
        overallUrl,
        {
          startDate,
          endDate,
          rowLimit: 1,
        },
        { headers }
      );
      console.log('[Google Search Console REST] ✓ Overall metrics received');

      const totalRow = overallResponse.data.rows?.[0];
      const totalClicks = totalRow?.clicks || 0;
      const totalImpressions = totalRow?.impressions || 0;
      const avgCtr = totalRow?.ctr ? parseFloat((totalRow.ctr * 100).toFixed(2)) : 0;
      const avgPosition = totalRow?.position ? parseFloat(totalRow.position.toFixed(1)) : 0;

      // Get top queries
      console.log('[Google Search Console REST] Fetching top queries...');
      const queriesUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;
      const queriesResponse = await this.client.post(
        queriesUrl,
        {
          startDate,
          endDate,
          dimensions: ['query'],
          rowLimit: 10,
        },
        { headers }
      );
      console.log('[Google Search Console REST] ✓ Top queries received');

      const topQueries = (queriesResponse.data.rows || []).map((row: any) => ({
        query: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
        position: row.position ? parseFloat(row.position.toFixed(1)) : 0,
      }));

      // Get top pages
      console.log('[Google Search Console REST] Fetching top pages...');
      const pagesUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;
      const pagesResponse = await this.client.post(
        pagesUrl,
        {
          startDate,
          endDate,
          dimensions: ['page'],
          rowLimit: 10,
        },
        { headers }
      );
      console.log('[Google Search Console REST] ✓ Top pages received');

      const topPages = (pagesResponse.data.rows || []).map((row: any) => ({
        page: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
        position: row.position ? parseFloat(row.position.toFixed(1)) : 0,
      }));

      // Get device data
      console.log('[Google Search Console REST] Fetching device data...');
      const devicesUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;
      const devicesResponse = await this.client.post(
        devicesUrl,
        {
          startDate,
          endDate,
          dimensions: ['device'],
          rowLimit: 10,
        },
        { headers }
      );
      console.log('[Google Search Console REST] ✓ Device data received');

      const topDevices = (devicesResponse.data.rows || []).map((row: any) => ({
        device: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
      }));

      console.log('[Google Search Console REST] Summary fetched successfully');

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
      console.error('[Google Search Console REST] Error fetching summary:', {
        siteUrl,
        startDate,
        endDate,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }

  /**
   * Fetch daily breakdown of GSC data
   */
  async getSearchDataDaily(
    siteUrl: string,
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      date: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>
  > {
    if (!this.credentials) {
      throw new Error('Google Search Console service not initialized');
    }

    try {
      return await this.fetchDailyData(siteUrl, startDate, endDate, this.credentials);
    } catch (error: any) {
      // If primary service account fails with 403 and fallback exists, try fallback
      if (error.response?.status === 403 && this.fallbackCredentials) {
        console.log('[Google Search Console REST] Primary service account denied for daily data, trying fallback...');
        try {
          return await this.fetchDailyData(siteUrl, startDate, endDate, this.fallbackCredentials);
        } catch (fallbackError) {
          console.error('[Google Search Console REST] Fallback service account also failed for daily data');
          throw fallbackError;
        }
      }
      throw error;
    }
  }

  /**
   * Internal method to fetch daily data with specific credentials
   */
  private async fetchDailyData(
    siteUrl: string,
    startDate: string,
    endDate: string,
    credentials: any
  ): Promise<
    Array<{
      date: string;
      clicks: number;
      impressions: number;
      ctr: number;
      position: number;
    }>
  > {
    try {
      const accessToken = await this.getAccessToken(credentials);

      // Extract domain from the provided URL
      const urlObj = new URL(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
      const domain = urlObj.hostname;

      console.log(`[Google Search Console REST] Fetching daily data for domain: ${domain}`);

      // Find the correct site URL format from accessible sites
      const matchedSiteUrl = await this.findMatchingSiteUrl(domain);
      const finalSiteUrl = matchedSiteUrl || `sc-domain:${domain}`;

      const encodedSiteUrl = encodeURIComponent(finalSiteUrl);

      console.log(`[Google Search Console REST] Fetching daily metrics for ${finalSiteUrl}`);

      // Create request headers with auth token
      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      // Get daily data - GSC doesn't support daily dimension, so we'll fetch with date dimension
      console.log('[Google Search Console REST] Fetching daily metrics...');
      const dailyUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodedSiteUrl}/searchAnalytics/query`;
      const dailyResponse = await this.client.post(
        dailyUrl,
        {
          startDate,
          endDate,
          dimensions: ['date'],
          rowLimit: 1000, // Get all days
        },
        { headers }
      );

      console.log('[Google Search Console REST] ✓ Daily metrics received');

      const dailyData = (dailyResponse.data.rows || []).map((row: any) => ({
        date: row.keys?.[0] || '',
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr ? parseFloat((row.ctr * 100).toFixed(2)) : 0,
        position: row.position ? parseFloat(row.position.toFixed(1)) : 0,
      }));

      console.log(`[Google Search Console REST] Daily data fetched successfully: ${dailyData.length} days`);

      return dailyData;
    } catch (error: any) {
      console.error('[Google Search Console REST] Error fetching daily data:', {
        siteUrl,
        startDate,
        endDate,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }
}

// Export singleton
let searchConsoleRestService: GoogleSearchConsoleRestService | null = null;

export function getSearchConsoleRestService(): GoogleSearchConsoleRestService {
  if (!searchConsoleRestService) {
    searchConsoleRestService = new GoogleSearchConsoleRestService();
  }
  return searchConsoleRestService;
}
