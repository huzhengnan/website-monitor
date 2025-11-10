import client from './client';

export interface BacklinkSite {
  id: string;
  url: string;
  domain: string;
  dr?: number | string | null;
  note?: string | null;
  // 重要程度评分（0-100）- 综合 DR、提交状态、提交数量
  importanceScore?: number | null;

  // Semrush 数据
  authorityScore?: number | null;
  organicTraffic?: number | null;
  organicKeywords?: number | null;
  paidTraffic?: number | null;
  backlinks?: number | null;
  refDomains?: number | null;
  aiVisibility?: number | null;
  aiMentions?: number | null;
  trafficChange?: number | null;
  keywordsChange?: number | null;
  semrushLastSync?: string | null;

  // 提交统计
  submissionCount?: number;

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

export async function updateBacklink(id: string, payload: { url?: string; note?: string; dr?: number | null }) {
  return client.put(`/backlink-sites/${id}`, payload);
}

export async function importBacklinksFromDocs(): Promise<{ success: boolean; stats: { created: number; updated?: number; skipped: number; total: number } }> {
  return client.post('/backlinks/import', {});
}

export async function importSemrushData(pastedText: string): Promise<{
  success: boolean;
  data?: { total: number; created: number; updated: number; failed: number; errors?: Array<{ domain: string; error: string }> };
  message: string;
}> {
  return client.post('/backlink-sites/semrush-import', { pastedText });
}

export async function deleteBacklink(id: string): Promise<{ success: boolean }> {
  return client.delete(`/backlink-sites/${id}`);
}

export interface BacklinkSubmissionDetail {
  id: string;
  backlinkSiteId: string;
  status: string;
  notes?: string | null;
  submitDate?: string | null;
  indexedDate?: string | null;
  cost?: number | null;
  site: {
    id: string;
    name: string;
    domain: string;
  };
}

export async function getBacklinkSubmissions(backlinkSiteId: string): Promise<{ success: boolean; data: BacklinkSubmissionDetail[] }> {
  return client.get(`/backlink-sites/${backlinkSiteId}/submissions`);
}

export async function importGSCSubmissions(siteId: string, backlinkDomains: Array<{ domain: string; url?: string; indexedDate?: string }>): Promise<{
  success: boolean;
  message: string;
  stats: { created: number; updated: number; failed: number; total: number; errors?: Array<{ domain: string; error: string }> };
}> {
  return client.post('/backlink-sites/gsc-import', { siteId, backlinkDomains });
}

export async function quickImportBacklinks(domains: Array<{ domain: string; url?: string; note?: string }>, siteId?: string): Promise<{
  success: boolean;
  message: string;
  stats: { created: number; updated: number; failed: number; total: number; errors?: Array<{ domain: string; error: string }> };
}> {
  return client.post('/backlink-sites/quick-import', { domains, siteId });
}
