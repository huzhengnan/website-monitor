import client from './client';

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
  propertyId: string;
}

export interface Connector {
  id: string;
  siteId: string;
  type: 'GoogleAnalytics' | 'Plausible' | 'Matomo' | 'Custom';
  credentials: GACredentials | Record<string, any>;
  status: 'active' | 'error' | 'inactive';
  lastSyncAt?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  site?: {
    id: string;
    name: string;
    domain: string;
  };
}

/**
 * 获取站点的连接器列表
 */
export async function getConnectors(siteId: string) {
  const response = await client.get<{ success: boolean; data: { items: Connector[] } }>(
    '/connectors',
    {
      params: { siteId },
    }
  );
  return response.data;
}

/**
 * 获取单个连接器
 */
export async function getConnectorById(id: string) {
  const response = await client.get<{ success: boolean; data: Connector }>(`/connectors/${id}`);
  return response.data;
}

/**
 * 创建连接器
 */
export async function createConnector(data: {
  siteId: string;
  type: 'GoogleAnalytics' | 'Plausible' | 'Matomo' | 'Custom';
  credentials: GACredentials | Record<string, any>;
}) {
  const response = await client.post<{ success: boolean; data: Connector }>('/connectors', data);
  return response.data;
}

/**
 * 更新连接器
 */
export async function updateConnector(
  id: string,
  data: {
    credentials?: GACredentials | Record<string, any>;
    status?: 'active' | 'error' | 'inactive';
  }
) {
  const response = await client.put<{ success: boolean; data: Connector }>(
    `/connectors/${id}`,
    data
  );
  return response.data;
}

/**
 * 删除连接器
 */
export async function deleteConnector(id: string) {
  const response = await client.delete(`/connectors/${id}`);
  return response.data;
}

/**
 * 触发同步
 */
export async function triggerSync(params: {
  connectorId?: string;
  days?: number;
  startDate?: string;
  endDate?: string;
}) {
  const response = await client.post<{ success: boolean; data: any }>('/connectors/sync', params);
  return response.data;
}
