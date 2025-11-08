import axios, { AxiosInstance } from 'axios';
import { HttpProxyAgent } from 'http-proxy-agent';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Google Analytics REST API 服务
 * 直接使用 REST API 而不是官方库，支持代理
 */

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

export interface GAProperty {
  propertyId: string;
  displayName: string;
  websiteUrl?: string;
  timeZone?: string;
  currencyCode?: string;
}

export interface GAAccount {
  accountId: string;
  displayName?: string;
  properties: GAProperty[];
}

export interface GAMetric {
  name: string;
  values: string[];
}

export interface GADimension {
  name: string;
  values: string[];
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Google Analytics REST API 客户端
 */
export class GoogleAnalyticsRestClient {
  private axiosInstance: AxiosInstance;
  private credentials: GACredentials;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(credentials: GACredentials) {
    this.credentials = credentials;

    // 创建 axios 实例，支持代理
    // 检查环境变量（支持大写和小写）
    let proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
                   process.env.HTTP_PROXY || process.env.http_proxy;

    // 如果没有找到环境变量，使用默认代理
    if (!proxyUrl) {
      console.log('[GA REST API] 未找到代理环境变量，使用默认代理: localhost:7890');
      proxyUrl = 'http://localhost:7890';
    } else {
      console.log(`[GA REST API] 使用代理: ${proxyUrl}`);
    }

    const httpAgent = new HttpProxyAgent(proxyUrl);
    const httpsAgent = new HttpsProxyAgent(proxyUrl);

    this.axiosInstance = axios.create({
      httpAgent,
      httpsAgent,
      timeout: 120000, // 2分钟超时，足够处理多个 GA4 属性的发现和同步
    });
  }

  /**
   * 获取访问令牌（使用 JWT）
   */
  private async getAccessToken(): Promise<string> {
    // 如果令牌仍然有效，直接返回
    if (this.accessToken && Date.now() < this.tokenExpiry - 60000) {
      return this.accessToken;
    }

    try {
      // 创建 JWT
      const jwt = this.createJWT();

      // 交换访问令牌
      const response = await this.axiosInstance.post<TokenResponse>(
        'https://oauth2.googleapis.com/token',
        {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt,
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      console.log('[GA REST API] 已获取访问令牌');
      return this.accessToken;
    } catch (error) {
      console.error('[GA REST API] 获取访问令牌失败:', error);
      throw new Error('Failed to get access token from Google');
    }
  }

  /**
   * 创建 JWT
   */
  private createJWT(): string {
    const crypto = require('crypto');

    // JWT Header
    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.credentials.private_key_id,
    };

    // JWT Payload
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.credentials.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    // Base64 编码
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

    // 签名
    const signature = crypto
      .createSign('RSA-SHA256')
      .update(`${encodedHeader}.${encodedPayload}`)
      .sign(this.credentials.private_key, 'base64url');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  /**
   * 发现所有 GA4 属性
   */
  async discoverProperties(): Promise<GAAccount[]> {
    try {
      const token = await this.getAccessToken();

      // 列出所有账户
      console.log('[GA REST API] 正在列出账户...');
      const accountsResponse = await this.axiosInstance.get(
        'https://analyticsadmin.googleapis.com/v1beta/accounts',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const accounts: GAAccount[] = [];
      const accountsData = accountsResponse.data.accounts || [];

      console.log(`[GA REST API] 发现 ${accountsData.length} 个账户`);

      // 对每个账户列出属性
      for (const account of accountsData) {
        const accountId = account.name.split('/')[1];
        const accountName = account.displayName || '';

        console.log(`[GA REST API] 正在列出账户 ${accountName} 的属性...`);

        try {
          const propertiesResponse = await this.axiosInstance.get(
            `https://analyticsadmin.googleapis.com/v1beta/properties`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              params: {
                filter: `parent:accounts/${accountId}`,
              },
            }
          );

          const properties: GAProperty[] = [];
          const propertiesData = propertiesResponse.data.properties || [];

          console.log(`[GA REST API] 账户 ${accountName} 有 ${propertiesData.length} 个属性`);

          for (const prop of propertiesData) {
            const propertyId = prop.name.split('/')[1];
            properties.push({
              propertyId,
              displayName: prop.displayName || `Property ${propertyId}`,
              websiteUrl: prop.websiteUrl,
              timeZone: prop.timeZone,
              currencyCode: prop.currencyCode,
            });
          }

          accounts.push({
            accountId,
            displayName: accountName,
            properties,
          });
        } catch (error) {
          console.error(`[GA REST API] 获取账户 ${accountName} 的属性失败:`, error);
          // 继续处理其他账户
          continue;
        }
      }

      return accounts;
    } catch (error) {
      console.error('[GA REST API] 发现属性失败:', error);
      throw error;
    }
  }

  /**
   * 验证凭证
   */
  async validateCredentials(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();

      // 尝试获取账户列表来验证凭证
      const response = await this.axiosInstance.get(
        'https://analyticsadmin.googleapis.com/v1beta/accounts',
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            pageSize: 1,
          },
        }
      );

      return true;
    } catch (error) {
      console.error('[GA REST API] 验证凭证失败:', error);
      return false;
    }
  }

  /**
   * 获取属性的流量数据
   */
  async getMetrics(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<{
    activeUsers: number;
    newUsers: number;
    events: number;
    sessions: number;
  }> {
    try {
      const token = await this.getAccessToken();

      console.log(`[GA REST API] 正在获取属性 ${propertyId} 的指标数据...`);

      const response = await this.axiosInstance.post(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'keyEvents' },
            { name: 'sessions' },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 解析响应
      const rows = response.data.rows || [];
      if (rows.length === 0) {
        console.log(`[GA REST API] 属性 ${propertyId} 没有返回数据`);
        return { activeUsers: 0, newUsers: 0, events: 0, sessions: 0 };
      }

      const metricValues = rows[0].metricValues || [];

      return {
        activeUsers: parseInt(metricValues[0]?.value || '0'),
        newUsers: parseInt(metricValues[1]?.value || '0'),
        events: parseInt(metricValues[2]?.value || '0'),
        sessions: parseInt(metricValues[3]?.value || '0'),
      };
    } catch (error: any) {
      // 详细的错误日志
      if (error.response) {
        console.error('[GA REST API] GA API 响应错误:', {
          status: error.response.status,
          statusText: error.response.statusText,
          errorMessage: error.response.data?.error?.message,
          errorCode: error.response.data?.error?.code,
          errorDetails: error.response.data?.error?.details,
          errorReason: error.response.data?.error?.reason,
          errorDomain: error.response.data?.error?.domain,
          fullError: JSON.stringify(error.response.data?.error, null, 2),
        });
      } else {
        console.error('[GA REST API] 获取指标数据失败:', error.message);
      }
      throw error;
    }
  }

  /**
   * 获取每日指标数据（按日期分组）- 包含所有 GA4 指标
   */
  async getDailyMetrics(
    propertyId: string,
    startDate: string,
    endDate: string
  ): Promise<Array<{
    date: string;
    activeUsers: number;
    newUsers: number;
    events: number; // keyEvents from GA4
    sessions: number;
    screenPageViews: number;
    bounceRate: number;
    engagementRate: number;
    engagedSessions: number;
    sessionDuration: number;
    metricsData: Record<string, any>;
  }>> {
    try {
      const token = await this.getAccessToken();

      console.log(`[GA REST API] 正在获取属性 ${propertyId} 的每日指标数据 (${startDate} 到 ${endDate})...`);

      // 请求所有支持的 GA4 指标
      const response = await this.axiosInstance.post(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          dimensions: [
            { name: 'date' },
          ],
          metrics: [
            { name: 'activeUsers' },           // 0: 活跃用户
            { name: 'newUsers' },              // 1: 新用户
            { name: 'eventCount' },            // 2: 事件总数（改为 eventCount，不是 keyEvents）
            { name: 'sessions' },              // 3: 会话
            { name: 'screenPageViews' },       // 4: 页面浏览
            { name: 'bounceRate' },            // 5: 跳出率
            { name: 'engagementRate' },        // 6: 参与度
            { name: 'engagedSessions' },       // 7: 参与会话
            { name: 'averageSessionDuration' }, // 8: 平均会话时长
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // 解析响应
      const rows = response.data.rows || [];
      if (rows.length === 0) {
        console.log(`[GA REST API] 属性 ${propertyId} 没有返回数据`);
        return [];
      }

      console.log(`[GA REST API] 属性 ${propertyId} 返回了 ${rows.length} 行数据`);

      return rows.map((row: any) => {
        const dimensionValues = row.dimensionValues || [];
        const metricValues = row.metricValues || [];

        // 日期格式为 YYYYMMDD，需要转换为 YYYY-MM-DD
        const dateStr = dimensionValues[0]?.value || '';
        const formattedDate = dateStr.length === 8
          ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
          : dateStr;

        // 建立指标索引以便引用（顺序必须与请求中的 metrics 数组顺序一致）
        const metrics = {
          activeUsers: parseInt(metricValues[0]?.value || '0'),
          newUsers: parseInt(metricValues[1]?.value || '0'),
          eventCount: parseInt(metricValues[2]?.value || '0'),  // 改为 eventCount（总事件数）
          sessions: parseInt(metricValues[3]?.value || '0'),
          screenPageViews: parseInt(metricValues[4]?.value || '0'),
          bounceRate: parseFloat(metricValues[5]?.value || '0'),
          engagementRate: parseFloat(metricValues[6]?.value || '0'),
          engagedSessions: parseInt(metricValues[7]?.value || '0'),
          averageSessionDuration: parseFloat(metricValues[8]?.value || '0'),
        };

        return {
          date: formattedDate,
          activeUsers: metrics.activeUsers,
          newUsers: metrics.newUsers,
          events: metrics.eventCount,  // ✅ 使用 eventCount（总事件数）
          sessions: metrics.sessions,
          screenPageViews: metrics.screenPageViews,
          bounceRate: metrics.bounceRate,
          engagementRate: metrics.engagementRate,
          engagedSessions: metrics.engagedSessions,
          sessionDuration: metrics.averageSessionDuration,
          metricsData: metrics,
        };
      });
    } catch (error: any) {
      // 详细的错误日志
      if (error.response) {
        console.error('[GA REST API] GA API 响应错误:', {
          status: error.response.status,
          statusText: error.response.statusText,
          errorMessage: error.response.data?.error?.message,
          errorCode: error.response.data?.error?.code,
          errorDetails: error.response.data?.error?.details,
          errorReason: error.response.data?.error?.reason,
          errorDomain: error.response.data?.error?.domain,
          fullError: JSON.stringify(error.response.data?.error, null, 2),
        });
      } else {
        console.error('[GA REST API] 获取每日指标数据失败:', error.message);
      }
      throw error;
    }
  }
}

/**
 * 便捷函数：发现 GA4 属性
 */
export async function discoverGAProperties(credentials: GACredentials): Promise<GAAccount[]> {
  const client = new GoogleAnalyticsRestClient(credentials);
  return client.discoverProperties();
}

/**
 * 便捷函数：验证凭证
 */
export async function validateGACredentials(credentials: GACredentials): Promise<boolean> {
  const client = new GoogleAnalyticsRestClient(credentials);
  return client.validateCredentials();
}

/**
 * 便捷函数：获取指标数据
 */
export async function getGAMetrics(
  credentials: GACredentials,
  propertyId: string,
  startDate: string,
  endDate: string
) {
  const client = new GoogleAnalyticsRestClient(credentials);
  return client.getMetrics(propertyId, startDate, endDate);
}
