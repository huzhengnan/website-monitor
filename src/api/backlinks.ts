import client from './client';

export interface BacklinkSite {
  id: string;
  url: string;
  domain: string;
  dr?: number | string | null;
  note?: string | null;
  // 重要程度评分（0-100）- 综合 DR、提交状态、提交数量
  importanceScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function listBacklinks(params?: { page?: number; pageSize?: number; keyword?: string; sortField?: string; sortOrder?: 'asc' | 'desc' }): Promise<{ success: boolean; data: BacklinkSite[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.keyword) query.set('keyword', params.keyword);
  if (params?.sortField) query.set('sortField', params.sortField);
  if (params?.sortOrder) query.set('sortOrder', params.sortOrder);
  const qs = query.toString();
  return client.get(`/backlink-sites${qs ? `?${qs}` : ''}`);
}

export async function createBacklink(payload: { url: string; note?: string; dr?: number | null }) {
  return client.post('/backlink-sites', payload);
}

export async function importBacklinksFromDocs(): Promise<{ success: boolean; stats: { created: number; updated?: number; skipped: number; total: number } }> {
  return client.post('/backlinks/import', {});
}

export async function deleteBacklink(id: string): Promise<{ success: boolean }> {
  return client.delete(`/backlink-sites/${id}`);
}
