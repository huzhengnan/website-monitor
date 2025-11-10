import { prisma } from '@/lib/prisma';

/**
 * 外链网站重要程度评分服务
 *
 * 评分规则（总分 100）：
 * - DR（域名等级）: 50% 权重
 * - 提交状态: 30% 权重
 * - 提交数量: 20% 权重
 */

/**
 * 计算单个外链网站的重要程度评分
 *
 * @param backlinkSiteId 外链网站 ID
 * @returns 评分 (0-100)
 */
export async function calculateImportanceScore(backlinkSiteId: string): Promise<number> {
  const site = await prisma.backlinkSite.findUnique({
    where: { id: backlinkSiteId },
    include: {
      backlinkSubmissions: true,
    },
  });

  if (!site) {
    return 0;
  }

  let score = 0;

  // 1. DR 权重 50%
  if (site.dr) {
    const drScore = Math.min(100, Number(site.dr) * 2); // DR 最高 50，转换为 50 分
    score += drScore * 0.5;
  }

  // 2. 提交状态权重 30%
  const submissions = site.backlinkSubmissions || [];
  if (submissions.length > 0) {
    const statusScores: { [key: string]: number } = {
      indexed: 100, // 已收录 - 最有价值
      submitted: 70, // 已提交 - 中等价值
      contacted: 50, // 已联系 - 有潜力
      pending: 30, // 待处理 - 低价值
      failed: 0, // 失败 - 无价值
    };

    // 计算平均状态分数
    const avgStatusScore =
      submissions.reduce((sum: number, sub) => {
        const statusScore = statusScores[sub.status] || 0;
        return sum + statusScore;
      }, 0) / submissions.length;

    score += avgStatusScore * 0.3;
  }

  // 3. 提交数量权重 20%
  if (submissions.length > 0) {
    // 提交数量分数：最多 10 个算 100 分
    const quantityScore = Math.min(100, (submissions.length / 10) * 100);
    score += quantityScore * 0.2;
  }

  return Math.round(score);
}

/**
 * 批量计算重要程度评分
 * 更新所有外链网站的评分
 */
export async function recalculateAllScores(): Promise<void> {
  const sites = await prisma.backlinkSite.findMany({
    include: {
      backlinkSubmissions: true,
    },
  });

  for (const site of sites) {
    const score = await calculateImportanceScore(site.id);
    await (prisma.backlinkSite.update as any)({
      where: { id: site.id },
      data: { importanceScore: score },
    });
  }

  console.log(`✅ 已更新 ${sites.length} 个外链网站的重要程度评分`);
}

/**
 * 创建新外链网站时计算初始评分
 */
export async function initializeImportanceScore(backlinkSiteId: string): Promise<void> {
  const score = await calculateImportanceScore(backlinkSiteId);
  await (prisma.backlinkSite.update as any)({
    where: { id: backlinkSiteId },
    data: { importanceScore: score },
  });
}

/**
 * 添加提交记录后更新所有关联的评分
 */
export async function updateRelatedScores(backlinkSiteId: string): Promise<void> {
  const score = await calculateImportanceScore(backlinkSiteId);
  await (prisma.backlinkSite.update as any)({
    where: { id: backlinkSiteId },
    data: { importanceScore: score },
  });
}

/**
 * 获取重要程度评分的分类标签
 */
export function getImportanceLevel(score: number): {
  label: string;
  color: string;
  icon: string;
} {
  if (score >= 80) {
    return {
      label: '非常重要',
      color: '#ff4d4f', // 红色
      icon: '🔴',
    };
  } else if (score >= 60) {
    return {
      label: '重要',
      color: '#faad14', // 橙色
      icon: '🟠',
    };
  } else if (score >= 40) {
    return {
      label: '中等',
      color: '#1890ff', // 蓝色
      icon: '🔵',
    };
  } else if (score >= 20) {
    return {
      label: '一般',
      color: '#52c41a', // 绿色
      icon: '🟢',
    };
  } else {
    return {
      label: '较低',
      color: '#bfbfbf', // 灰色
      icon: '⚪',
    };
  }
}
