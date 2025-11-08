import client from './client';

// Traffic data types (matching backend)
export interface TrafficSource {
  id: string;
  trafficDataId: string;
  source: string;
  count: number;
}

export interface TrafficDevice {
  id: string;
  trafficDataId: string;
  device: string;
  count: number;
}

export interface TrafficPage {
  id: string;
  trafficDataId: string;
  url: string;
  pv: number;
  uv: number;
  bounceRate?: number;
}

export interface TrafficData {
  id: string;
  siteId: string;
  date: string;
  pv: number;
  uv: number;
  sessions: number;
  bounceRate?: number;
  avgTimeOnPage?: number;
  pagesPerSession?: number;
  conversionRate?: number;
  sources: TrafficSource[];
  devices: TrafficDevice[];
  pages: TrafficPage[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface TrafficAnalytics {
  totalPv: number;
  totalUv: number;
  totalSessions: number;
  avgBounceRate: number;
  dateRange: {
    start: string | null;
    end: string | null;
  };
  topSources: Array<{
    source: string;
    count: number;
  }>;
  topDevices: Array<{
    device: string;
    count: number;
  }>;
  topPages: Array<{
    url: string;
    pv: number;
    uv: number;
  }>;
  dailyTrend: Array<{
    date: string;
    pv: number;
    uv: number;
    sessions: number;
    bounceRate: number;
  }>;
}

export interface ListTrafficResponse {
  items: TrafficData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateTrafficDataRequest {
  siteId: string;
  date: string;
  pv: number;
  uv: number;
  sessions: number;
  bounceRate?: number;
  avgTimeOnPage?: number;
  pagesPerSession?: number;
  conversionRate?: number;
  sources?: Array<{
    source: string;
    count: number;
  }>;
  devices?: Array<{
    device: string;
    count: number;
  }>;
  pages?: Array<{
    url: string;
    pv: number;
    uv: number;
    bounceRate?: number;
  }>;
}

// Get traffic data for a specific site
export async function getSiteTraffic(
  siteId: string,
  options?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<ListTrafficResponse> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.pageSize) params.append('pageSize', options.pageSize.toString());

  const response = await client.get(`/traffic/sites/${siteId}?${params.toString()}`);
  return response.data;
}

// Get specific traffic data by ID
export async function getTrafficById(id: string): Promise<TrafficData> {
  const response = await client.get(`/traffic/${id}`);
  return response.data;
}

// Create traffic data
export async function createTrafficData(data: CreateTrafficDataRequest): Promise<TrafficData> {
  const response = await client.post('/traffic', data);
  return response.data;
}

// Update traffic data
export async function updateTrafficData(
  id: string,
  data: Partial<CreateTrafficDataRequest>
): Promise<TrafficData> {
  const response = await client.put(`/traffic/${id}`, data);
  return response.data;
}

// Delete traffic data
export async function deleteTrafficData(id: string): Promise<void> {
  await client.delete(`/traffic/${id}`);
}

// Get global traffic analytics
export async function getGlobalTrafficAnalytics(options?: {
  startDate?: string;
  endDate?: string;
}): Promise<TrafficAnalytics> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  const response = await client.get(`/traffic/analytics/global?${params.toString()}`);
  return response.data;
}

// Get traffic analytics for a specific site
export async function getSiteTrafficAnalytics(
  siteId: string,
  options?: {
    startDate?: string;
    endDate?: string;
  }
): Promise<TrafficAnalytics> {
  const params = new URLSearchParams();
  if (options?.startDate) params.append('startDate', options.startDate);
  if (options?.endDate) params.append('endDate', options.endDate);

  const response = await client.get(`/traffic/analytics/site/${siteId}?${params.toString()}`);
  return response.data;
}
