// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Query parameters
export interface ListQuery {
  page?: number | string;
  pageSize?: number | string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SitesListQuery extends ListQuery {
  categoryId?: string;
  status?: string;
  tags?: string[];
  scoreMin?: number | string;
  scoreMax?: number | string;
}

export interface TrafficQuery {
  siteId?: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

// Request body types
export interface CreateSiteRequest {
  name: string;
  domain: string;
  categoryId: string;
  status?: 'online' | 'maintenance' | 'offline';
  platform?: string;
  iconUrl?: string;
  description?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateSiteRequest extends Partial<CreateSiteRequest> {
  id: string;
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

export interface UpdateTrafficDataRequest {
  pv?: number;
  uv?: number;
  sessions?: number;
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

// Traffic data types
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
  date: Date;
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
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

export interface UpdateEvaluationRequest {
  marketScore?: number;
  qualityScore?: number;
  seoScore?: number;
  trafficScore?: number;
  revenueScore?: number;
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

// Evaluation data types
export interface Evaluation {
  id: string;
  siteId: string;
  date: Date;
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
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
  trend: number; // 0 = 平稳, > 0 = 上升, < 0 = 下降
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
  evaluationDate: Date;
}

// Error types
export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string) {
    super(400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Forbidden') {
    super(403, message);
    this.name = 'ForbiddenError';
  }
}
