/**
 * 风险级别定义
 * 支持扩展新的风险类型
 */

export const RISK_LEVELS = {
  safe: {
    value: 'safe',
    label: '安全',
    color: 'default',
    badgeStatus: 'success' as const,
    tooltip: '无已知风险',
  },
  low_authority: {
    value: 'low_authority',
    label: '低权威度',
    color: 'warning',
    badgeStatus: 'warning' as const,
    tooltip: '此网站权威度低，质量一般',
  },
  link_farm: {
    value: 'link_farm',
    label: '链接农场',
    color: 'error',
    badgeStatus: 'error' as const,
    tooltip: '此网站被标记为链接农场，谨慎提交',
  },
  // 可以轻松添加新的风险类型
  // suspicious: {
  //   value: 'suspicious',
  //   label: '可疑',
  //   color: 'orange',
  //   badgeStatus: 'warning',
  //   tooltip: '此网站可能存在可疑行为',
  // },
} as const;

export type RiskLevel = keyof typeof RISK_LEVELS;

/**
 * 根据风险级别获取配置
 */
export function getRiskLevelConfig(riskLevel: string | null | undefined) {
  if (!riskLevel || riskLevel === 'safe') {
    return RISK_LEVELS.safe;
  }

  // 如果风险级别在已定义的配置中，返回对应配置
  if (riskLevel in RISK_LEVELS) {
    return RISK_LEVELS[riskLevel as RiskLevel];
  }

  // 如果是未定义的风险类型，返回默认配置（安全）
  // 这样新增的风险类型可以被自动处理
  console.warn(`Unknown risk level: ${riskLevel}, using default safe config`);
  return RISK_LEVELS.safe;
}

/**
 * 检测文本中的风险标记
 * 支持扩展新的风险类型检测规则
 */
export function detectRiskLevel(text: string): RiskLevel {
  if (!text) return 'safe';

  const lowerText = text.toLowerCase();

  // 检测顺序很重要：从最严重的风险开始检测
  if (lowerText.includes('link') && lowerText.includes('farm')) {
    return 'link_farm';
  }

  if (lowerText.includes('low') && lowerText.includes('authority')) {
    return 'low_authority';
  }

  // 可以继续添加其他风险类型的检测规则
  // if (lowerText.includes('suspicious')) {
  //   return 'suspicious';
  // }

  return 'safe';
}
