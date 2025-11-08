import client from './client';

// Evaluation types
export interface Evaluation {
  id: string;
  siteId: string;
  date: string;
  marketScore: number;
  qualityScore: number;
  seoScore: number;
  trafficScore: number;
  revenueScore: number;
  compositeScore: number;
  evaluator?: string;
  notes?: string;
  weights?: {
    market: number;
    quality: number;
    seo: number;
    traffic: number;
    revenue: number;
  };
  site?: {
    id: string;
    name: string;
    domain?: string;
  };
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface EvaluationStats {
  totalCount: number;
  latestComposite: number;
  avgComposite: number;
  avgMarket: number;
  avgQuality: number;
  avgSeo: number;
  avgTraffic: number;
  avgRevenue: number;
  trend: number;
}

export interface LeaderboardEntry {
  rank: number;
  siteId: string;
  siteName: string;
  domain: string;
  status: string;
  score: number;
  scores: {
    composite: number;
    market: number;
    quality: number;
    seo: number;
    traffic: number;
    revenue: number;
  };
  evaluationDate: string;
}

export interface ListEvaluationsResponse {
  items: Evaluation[];
  total?: number;
}

export interface LeaderboardResponse {
  items: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateEvaluationRequest {
  siteId: string;
  date?: string;
  marketScore: number;
  qualityScore: number;
  seoScore: number;
  trafficScore: number;
  revenueScore: number;
  evaluator?: string;
  notes?: string;
  weights?: {
    market?: number;
    quality?: number;
    seo?: number;
    traffic?: number;
    revenue?: number;
  };
}

// Get all evaluations for a site
export async function getSiteEvaluations(siteId: string): Promise<Evaluation[]> {
  const response = await client.get(`/evaluations/sites/${siteId}`);
  return response.data;
}

// Get specific evaluation by ID
export async function getEvaluationById(id: string): Promise<Evaluation> {
  const response = await client.get(`/evaluations/${id}`);
  return response.data;
}

// Get latest evaluation for a site
export async function getLatestEvaluation(siteId: string): Promise<Evaluation | null> {
  const response = await client.get(`/evaluations/site/${siteId}/latest`);
  return response.data || null;
}

// Get evaluation statistics for a site
export async function getSiteEvaluationStats(siteId: string): Promise<EvaluationStats> {
  const response = await client.get(`/evaluations/stats/${siteId}`);
  return response.data;
}

// Create evaluation
export async function createEvaluation(data: CreateEvaluationRequest): Promise<Evaluation> {
  const response = await client.post('/evaluations', data);
  return response.data;
}

// Update evaluation
export async function updateEvaluation(
  id: string,
  data: Partial<CreateEvaluationRequest>
): Promise<Evaluation> {
  const response = await client.put(`/evaluations/${id}`, data);
  return response.data;
}

// Delete evaluation
export async function deleteEvaluation(id: string): Promise<void> {
  await client.delete(`/evaluations/${id}`);
}

// Get leaderboard
export async function getLeaderboard(
  dimension: 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue' = 'composite',
  options?: {
    page?: number;
    pageSize?: number;
  }
): Promise<LeaderboardResponse> {
  const params = new URLSearchParams();
  params.append('dimension', dimension);
  if (options?.page) params.append('page', options.page.toString());
  if (options?.pageSize) params.append('pageSize', options.pageSize.toString());

  const response = await client.get(`/evaluations/leaderboard?${params.toString()}`);
  return response.data;
}
