import { prisma } from '@/lib/prisma';

/**
 * 自动更新网站的综合评分
 * 通过调用 metrics API 获取最新评分数据并保存到数据库
 */
export async function updateSiteEvaluation(siteId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 调用 metrics API 获取评分数据
    const apiUrl = `http://localhost:3030/api/sites/${siteId}/metrics?days=30`;
    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to get metrics');
    }

    const evaluation = result.data?.evaluation;

    if (!evaluation) {
      console.log(`[Evaluation] No evaluation data for site ${siteId}`);
      return { success: true }; // 没有数据不算失败
    }

    // 使用 Prisma upsert 插入或更新评分数据
    await prisma.evaluation.upsert({
      where: {
        siteId_date: {
          siteId: siteId,
          date: new Date(),
        },
      },
      update: {
        marketScore: evaluation.market,
        qualityScore: evaluation.quality,
        seoScore: evaluation.seo,
        trafficScore: evaluation.traffic,
        revenueScore: evaluation.revenue,
        overallScore: evaluation.composite,
        reasons: evaluation.reasons || {},
        suggestions: evaluation.suggestions || {},
        updatedAt: new Date(),
      },
      create: {
        siteId: siteId,
        date: new Date(),
        marketScore: evaluation.market,
        qualityScore: evaluation.quality,
        seoScore: evaluation.seo,
        trafficScore: evaluation.traffic,
        revenueScore: evaluation.revenue,
        overallScore: evaluation.composite,
        reasons: evaluation.reasons || {},
        suggestions: evaluation.suggestions || {},
      },
    });

    console.log(`[Evaluation] ✅ Updated evaluation for site ${siteId} - Score: ${evaluation.composite}`);

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Evaluation] ❌ Failed to update evaluation for site ${siteId}:`, errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 批量更新所有网站的评分
 */
export async function updateAllSiteEvaluations(): Promise<
  Array<{
    siteId: string;
    siteName: string;
    success: boolean;
    error?: string;
  }>
> {
  try {
    // 获取所有活跃的网站
    const sites = await prisma.site.findMany({
      where: {
        deletedAt: null,
        status: 'online',
      },
      select: {
        id: true,
        name: true,
      },
    });

    const results = [];

    for (const site of sites) {
      const result = await updateSiteEvaluation(site.id);
      results.push({
        siteId: site.id,
        siteName: site.name,
        success: result.success,
        error: result.error,
      });
    }

    console.log(`[Evaluation] Batch update completed: ${results.filter(r => r.success).length}/${results.length} succeeded`);

    return results;
  } catch (error) {
    console.error('[Evaluation] Batch update error:', error instanceof Error ? error.message : error);
    return [];
  }
}
