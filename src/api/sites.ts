import client from './client';

export interface Site {
  id: string;
  name: string;
  domain: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
    color?: string;
  } | null;
  status: 'online' | 'maintenance' | 'offline';
  platform?: string;
  iconUrl?: string;
  description?: string;
  notes?: string;
  tags: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface ListSitesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  status?: string;
  tags?: string[];
  scoreMin?: number;
  scoreMax?: number;
}

export interface ListSitesResponse {
  items: Site[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Get all sites
 */
export async function listSites(params?: ListSitesParams) {
  // client.get returns the full API response { success, data: ListSitesResponse }
  const response = await client.get<{ success: boolean; data: ListSitesResponse }>('/sites', {
    params,
  });
  // The response is already the API object with { success, data: ListSitesResponse }
  return { data: (response as any).data };
}

/**
 * Get site by ID
 */
export async function getSiteById(id: string) {
  const response = await client.get<{ data: Site }>(`/sites/${id}`);
  return response.data;
}

/**
 * Get site summary
 */
export async function getSiteSummary(id: string) {
  const response = await client.get(`/sites/${id}/summary`);
  return response.data;
}

/**
 * Create site
 */
export async function createSite(data: Partial<Site>) {
  const response = await client.post<{ data: Site }>('/sites', data);
  return response.data;
}

/**
 * Update site
 */
export async function updateSite(id: string, data: Partial<Site>) {
  const response = await client.put<{ data: Site }>(`/sites/${id}`, data);
  return response.data;
}

/**
 * Delete site
 */
export async function deleteSite(id: string) {
  const response = await client.delete(`/sites/${id}`);
  return response.data;
}
