import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { HttpsProxyAgent } from 'https-proxy-agent';

/**
 * Google Analytics 账户和属性发现服务
 * 用于自动发现 Service Account 有权访问的所有 GA4 属性
 */

// 获取代理配置
function getProxyAgent() {
  const proxyUrl = process.env.PROXY_URL || 'http://localhost:7890';
  if (process.env.USE_PROXY === 'true' || process.env.PROXY_URL) {
    console.log(`[GA Discovery] 使用代理: ${proxyUrl}`);
    return new HttpsProxyAgent(proxyUrl);
  }
  return undefined;
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
  displayName: string;
  properties: GAProperty[];
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

/**
 * 从 Service Account 凭证发现所有 GA4 属性
 */
export async function discoverGAProperties(credentials: GACredentials): Promise<GAAccount[]> {
  try {
    // 创建认证客户端
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    // 创建 Google Analytics Admin API 客户端（配置代理）
    const proxyAgent = getProxyAgent();
    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth,
      ...(proxyAgent && {
        client: {
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent
        }
      })
    });

    // 列出所有账户
    const accountsResponse = await analyticsAdmin.properties.list({
      filter: 'parent:~',
    });

    const properties = accountsResponse.data.properties || [];
    const accounts: Map<string, GAAccount> = new Map();

    // 对每个属性进行处理
    for (const property of properties) {
      if (!property.name || !property.displayName) {
        continue;
      }

      // 解析属性 ID（格式：properties/123456789）
      const propertyId = property.name.split('/')[1];
      if (!propertyId) {
        continue;
      }

      // 获取账户信息（从属性的 parent 字段提取）
      const parentMatch = property.parent?.match(/accounts\/(\d+)/);
      const accountId = parentMatch ? parentMatch[1] : 'unknown';

      // 初始化账户（如果不存在）
      if (!accounts.has(accountId)) {
        accounts.set(accountId, {
          accountId,
          displayName: `Account ${accountId}`,
          properties: [],
        });
      }

      // 添加属性到账户
      const account = accounts.get(accountId)!;
      const propertyData = property as any;
      account.properties.push({
        propertyId,
        displayName: property.displayName,
        websiteUrl: propertyData.websiteUrl ?? undefined,
        timeZone: propertyData.timeZone ?? undefined,
        currencyCode: propertyData.currencyCode ?? undefined,
      });
    }

    return Array.from(accounts.values());
  } catch (error) {
    console.error('Failed to discover GA properties:', error);
    throw error;
  }
}

/**
 * 验证 Service Account 凭证是否有效
 */
export async function validateGACredentials(credentials: GACredentials): Promise<boolean> {
  try {
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const proxyAgent = getProxyAgent();
    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth,
      ...(proxyAgent && {
        client: {
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent
        }
      })
    });

    // 尝试列出属性，如果成功则凭证有效
    await analyticsAdmin.properties.list({
      filter: 'parent:~',
      pageSize: 1,
    });

    return true;
  } catch (error) {
    console.error('GA credentials validation failed:', error);
    return false;
  }
}

/**
 * 获取指定属性的详细信息
 */
export async function getPropertyDetails(
  credentials: GACredentials,
  propertyId: string
): Promise<GAProperty | null> {
  try {
    const auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    });

    const proxyAgent = getProxyAgent();
    const analyticsAdmin = google.analyticsadmin({
      version: 'v1beta',
      auth,
      ...(proxyAgent && {
        client: {
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent
        }
      })
    });

    const response = await analyticsAdmin.properties.get({
      name: `properties/${propertyId}`,
    });

    if (!response.data || !response.data.displayName) {
      return null;
    }

    const data = response.data as any;
    return {
      propertyId,
      displayName: response.data.displayName,
      websiteUrl: data.websiteUrl ?? undefined,
      timeZone: data.timeZone ?? undefined,
      currencyCode: data.currencyCode ?? undefined,
    };
  } catch (error) {
    console.error(`Failed to get property details for ${propertyId}:`, error);
    return null;
  }
}
