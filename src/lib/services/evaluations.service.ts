import { PrismaClient } from '@prisma/client';
import {
  CreateEvaluationRequest,
  UpdateEvaluationRequest,
  Evaluation,
  EvaluationStats,
  LeaderboardEntry,
  NotFoundError,
  ValidationError,
} from '../types';

const prisma = new PrismaClient();

/**
 * Get evaluations for a specific site
 */
export async function getSiteEvaluations(siteId: string): Promise<Evaluation[]> {
  // Verify site exists
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!site || site.deletedAt) {
    throw new NotFoundError('Site not found');
  }

  const evaluations = await prisma.evaluation.findMany({
    where: {
      siteId,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  return evaluations as unknown as Evaluation[];
}

/**
 * Get evaluation by ID
 */
export async function getEvaluationById(id: string): Promise<Evaluation> {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      site: {
        select: {
          id: true,
          name: true,
          domain: true,
        },
      },
    },
  });

  if (!evaluation) {
    throw new NotFoundError('Evaluation not found');
  }

  return evaluation as unknown as Evaluation;
}

/**
 * Create evaluation for a site
 */
export async function createEvaluation(
  data: CreateEvaluationRequest
): Promise<Evaluation> {
  const {
    siteId,
    date = new Date().toISOString().split('T')[0],
    marketScore,
    qualityScore,
    seoScore,
    trafficScore,
    revenueScore,
    evaluator,
    notes,
    weights,
  } = data;

  // Verify site exists
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!site || site.deletedAt) {
    throw new NotFoundError('Site not found');
  }

  // Validate scores
  if (
    marketScore < 0 ||
    marketScore > 100 ||
    qualityScore < 0 ||
    qualityScore > 100 ||
    seoScore < 0 ||
    seoScore > 100 ||
    trafficScore < 0 ||
    trafficScore > 100 ||
    revenueScore < 0 ||
    revenueScore > 100
  ) {
    throw new ValidationError('Scores must be between 0 and 100');
  }

  // Calculate composite score with optional weights
  const defaultWeights = {
    market: 0.2,
    quality: 0.2,
    seo: 0.2,
    traffic: 0.2,
    revenue: 0.2,
  };

  const finalWeights = weights || defaultWeights;

  // Normalize weights if provided
  const weightValues = Object.values(finalWeights) as number[];
  const weightSum = weightValues.reduce((sum: number, w: number) => sum + w, 0);
  const normalizedWeights = {
    market: (finalWeights.market || 0) / weightSum,
    quality: (finalWeights.quality || 0) / weightSum,
    seo: (finalWeights.seo || 0) / weightSum,
    traffic: (finalWeights.traffic || 0) / weightSum,
    revenue: (finalWeights.revenue || 0) / weightSum,
  };

  const compositeScore = Math.round(
    marketScore * normalizedWeights.market +
    qualityScore * normalizedWeights.quality +
    seoScore * normalizedWeights.seo +
    trafficScore * normalizedWeights.traffic +
    revenueScore * normalizedWeights.revenue
  );

  const evaluation = await prisma.evaluation.create({
    data: {
      siteId,
      date: new Date(date),
      marketScore,
      qualityScore,
      seoScore,
      trafficScore,
      revenueScore,
      evaluator: evaluator || null,
      notes: notes || null,
      weights: finalWeights,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return { ...evaluation, compositeScore } as unknown as Evaluation;
}

/**
 * Update evaluation
 */
export async function updateEvaluation(
  id: string,
  data: UpdateEvaluationRequest
): Promise<Evaluation> {
  // Verify evaluation exists
  const existing = await prisma.evaluation.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Evaluation not found');
  }

  const {
    marketScore,
    qualityScore,
    seoScore,
    trafficScore,
    revenueScore,
    evaluator,
    notes,
    weights,
  } = data;

  // Validate scores if provided
  if (marketScore !== undefined && (marketScore < 0 || marketScore > 100)) {
    throw new ValidationError('Market score must be between 0 and 100');
  }
  if (qualityScore !== undefined && (qualityScore < 0 || qualityScore > 100)) {
    throw new ValidationError('Quality score must be between 0 and 100');
  }
  if (seoScore !== undefined && (seoScore < 0 || seoScore > 100)) {
    throw new ValidationError('SEO score must be between 0 and 100');
  }
  if (trafficScore !== undefined && (trafficScore < 0 || trafficScore > 100)) {
    throw new ValidationError('Traffic score must be between 0 and 100');
  }
  if (revenueScore !== undefined && (revenueScore < 0 || revenueScore > 100)) {
    throw new ValidationError('Revenue score must be between 0 and 100');
  }

  // Calculate new composite score if any scores changed
  let compositeScore: number | undefined;
  if (
    marketScore !== undefined ||
    qualityScore !== undefined ||
    seoScore !== undefined ||
    trafficScore !== undefined ||
    revenueScore !== undefined ||
    weights !== undefined
  ) {
    const finalMarketScore = marketScore ?? existing.marketScore ?? 0;
    const finalQualityScore = qualityScore ?? existing.qualityScore ?? 0;
    const finalSeoScore = seoScore ?? existing.seoScore ?? 0;
    const finalTrafficScore = trafficScore ?? existing.trafficScore ?? 0;
    const finalRevenueScore = revenueScore ?? existing.revenueScore ?? 0;

    const defaultWeights = {
      market: 0.2,
      quality: 0.2,
      seo: 0.2,
      traffic: 0.2,
      revenue: 0.2,
    };

    const finalWeights = weights || (existing.weights as any) || defaultWeights;
    const weightValues = Object.values(finalWeights) as number[];
    const weightSum = weightValues.reduce((sum: number, w: number) => sum + w, 0);

    const normalizedWeights = {
      market: (finalWeights.market || 0.2) / weightSum,
      quality: (finalWeights.quality || 0.2) / weightSum,
      seo: (finalWeights.seo || 0.2) / weightSum,
      traffic: (finalWeights.traffic || 0.2) / weightSum,
      revenue: (finalWeights.revenue || 0.2) / weightSum,
    };

    compositeScore = Math.round(
      finalMarketScore * normalizedWeights.market +
      finalQualityScore * normalizedWeights.quality +
      finalSeoScore * normalizedWeights.seo +
      finalTrafficScore * normalizedWeights.traffic +
      finalRevenueScore * normalizedWeights.revenue
    );
  }

  const evaluation = await prisma.evaluation.update({
    where: { id },
    data: {
      marketScore: marketScore ?? undefined,
      qualityScore: qualityScore ?? undefined,
      seoScore: seoScore ?? undefined,
      trafficScore: trafficScore ?? undefined,
      revenueScore: revenueScore ?? undefined,
      evaluator: evaluator ?? undefined,
      notes: notes ?? undefined,
      weights: weights ?? undefined,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return { ...evaluation, compositeScore: compositeScore ?? 0 } as unknown as Evaluation;
}

/**
 * Delete evaluation
 */
export async function deleteEvaluation(id: string): Promise<void> {
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
  });

  if (!evaluation) {
    throw new NotFoundError('Evaluation not found');
  }

  await prisma.evaluation.delete({
    where: { id },
  });
}

/**
 * Get latest evaluation for a site
 */
export async function getLatestEvaluation(siteId: string): Promise<Evaluation | null> {
  const evaluation = await prisma.evaluation.findFirst({
    where: {
      siteId,
    },
    include: {
      site: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  return (evaluation || null) as Evaluation | null;
}

/**
 * Get evaluation statistics for a site
 */
export async function getSiteEvaluationStats(siteId: string): Promise<EvaluationStats> {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      siteId,
    },
    select: {
      marketScore: true,
      qualityScore: true,
      seoScore: true,
      trafficScore: true,
      revenueScore: true,
      date: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (evaluations.length === 0) {
    return {
      totalCount: 0,
      latestComposite: 0,
      avgComposite: 0,
      avgMarket: 0,
      avgQuality: 0,
      avgSeo: 0,
      avgTraffic: 0,
      avgRevenue: 0,
      trend: 0, // 0 = 平稳, > 0 = 上升, < 0 = 下降
    };
  }

  const totalCount = evaluations.length;
  const avgMarket =
    evaluations.reduce((sum: number, e: any) => sum + e.marketScore, 0) / totalCount;
  const avgQuality =
    evaluations.reduce((sum: number, e: any) => sum + e.qualityScore, 0) / totalCount;
  const avgSeo =
    evaluations.reduce((sum: number, e: any) => sum + e.seoScore, 0) / totalCount;
  const avgTraffic =
    evaluations.reduce((sum: number, e: any) => sum + e.trafficScore, 0) / totalCount;
  const avgRevenue =
    evaluations.reduce((sum: number, e: any) => sum + e.revenueScore, 0) / totalCount;

  // Calculate composite score as average of all scores
  const avgComposite = (avgMarket + avgQuality + avgSeo + avgTraffic + avgRevenue) / 5;

  // Calculate trend: use latest vs average
  const latestMarket = evaluations[0].marketScore || 0;
  const latestQuality = evaluations[0].qualityScore || 0;
  const latestSeo = evaluations[0].seoScore || 0;
  const latestTraffic = evaluations[0].trafficScore || 0;
  const latestRevenue = evaluations[0].revenueScore || 0;
  const latestComposite = (latestMarket + latestQuality + latestSeo + latestTraffic + latestRevenue) / 5;
  const trend = Math.round(latestComposite - avgComposite);

  return {
    totalCount,
    latestComposite,
    avgComposite: Math.round(avgComposite * 100) / 100,
    avgMarket: Math.round(avgMarket * 100) / 100,
    avgQuality: Math.round(avgQuality * 100) / 100,
    avgSeo: Math.round(avgSeo * 100) / 100,
    avgTraffic: Math.round(avgTraffic * 100) / 100,
    avgRevenue: Math.round(avgRevenue * 100) / 100,
    trend,
  };
}

/**
 * Get leaderboard for a specific dimension
 */
export async function getLeaderboard(
  dimension: 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue' = 'composite',
  page: number = 1,
  pageSize: number = 20
): Promise<{ items: LeaderboardEntry[]; total: number }> {
  const scoreField = dimension === 'composite' ? 'compositeScore' : `${dimension}Score`;

  // Get all sites with their latest evaluation
  const sites = await prisma.site.findMany({
    where: {
    },
    select: {
      id: true,
      name: true,
      domain: true,
      status: true,
    },
  });

  // Get latest evaluations for each site
  const siteEvaluations = await Promise.all(
    sites.map(async (site: any) => {
      const latest = await getLatestEvaluation(site.id);
      return {
        site,
        evaluation: latest,
      };
    })
  );

  // Filter sites with evaluations and create leaderboard entries
  const leaderboardItems: LeaderboardEntry[] = siteEvaluations
    .filter((item: any) => item.evaluation !== null)
    .map((item) => {
      const evaluation = item.evaluation!;
      // Calculate composite score from individual scores
      const compositeScore = Math.round(
        ((evaluation.marketScore || 0) +
          (evaluation.qualityScore || 0) +
          (evaluation.seoScore || 0) +
          (evaluation.trafficScore || 0) +
          (evaluation.revenueScore || 0)) /
          5
      );
      return {
        rank: 0, // Will be set after sorting
        siteId: item.site.id,
        siteName: item.site.name,
        domain: item.site.domain,
        status: item.site.status,
        score:
          dimension === 'composite'
            ? compositeScore
            : dimension === 'market'
              ? evaluation.marketScore || 0
              : dimension === 'quality'
                ? evaluation.qualityScore || 0
                : dimension === 'seo'
                  ? evaluation.seoScore || 0
                  : dimension === 'traffic'
                    ? evaluation.trafficScore || 0
                    : evaluation.revenueScore || 0,
        scores: {
          composite: compositeScore,
          market: evaluation.marketScore || 0,
          quality: evaluation.qualityScore || 0,
          seo: evaluation.seoScore || 0,
          traffic: evaluation.trafficScore || 0,
          revenue: evaluation.revenueScore || 0,
        },
        evaluationDate: evaluation.date,
      };
    })
    .sort((a, b) => b.score - a.score) // Sort descending by score
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  const total = leaderboardItems.length;
  const startIdx = (page - 1) * pageSize;
  const items = leaderboardItems.slice(startIdx, startIdx + pageSize);

  return { items, total };
}
