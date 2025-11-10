/**
 * URL 规范化和去重服务
 *
 * 功能：
 * - 规范化 URL（处理 www、https、末尾斜杠等）
 * - 从 URL 提取规范域名
 * - 检测重复的 URL
 * - 在创建或导入时自动去重
 */

/**
 * 规范化 URL
 *
 * 转换：
 * - http://example.com → https://example.com
 * - www.example.com → example.com
 * - example.com/ → example.com
 * - example.com:443 → example.com
 *
 * @param rawUrl 原始 URL
 * @returns 规范化后的 URL
 */
export function normalizeUrl(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return rawUrl;
  }

  let url = rawUrl.trim();

  // 如果不包含协议，添加 https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);

    // 移除 www 前缀
    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // 重新组装 URL（不带末尾斜杠、不带默认端口）
    const normalized = `https://${hostname}`;
    return normalized;
  } catch (error) {
    // 如果 URL 解析失败，返回原始值
    return url;
  }
}

/**
 * 从 URL 提取规范域名
 *
 * @param url URL 字符串
 * @returns 规范域名（如 example.com）
 */
export function extractDomain(url: string): string {
  if (!url) {
    return '';
  }

  let urlStr = url.trim();

  // 如果不包含协议，添加 https://
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = `https://${urlStr}`;
  }

  try {
    const parsed = new URL(urlStr);
    let domain = parsed.hostname.toLowerCase();

    // 移除 www 前缀
    if (domain.startsWith('www.')) {
      domain = domain.slice(4);
    }

    return domain;
  } catch (error) {
    // 提取失败时尝试简单方式
    return urlStr
      .replace(/^(https?:\/\/)?(www\.)?/, '') // 移除协议和 www
      .replace(/\/$/, '') // 移除末尾斜杠
      .split(/[/?#]/)[0]; // 取第一个 /、? 或 # 之前的部分
  }
}

/**
 * 检查两个 URL 是否指向同一个域名
 *
 * @param url1 第一个 URL
 * @param url2 第二个 URL
 * @returns 是否重复
 */
export function areDuplicateUrls(url1: string, url2: string): boolean {
  const domain1 = extractDomain(url1);
  const domain2 = extractDomain(url2);
  return domain1 === domain2 && domain1 !== '';
}

/**
 * 比较两个 URL 的质量（判断哪个更规范）
 *
 * 评分标准（越高越好）：
 * - 没有 www 前缀 +5
 * - 没有末尾斜杠 +3
 * - 没有 www 且没有末尾斜杠 +10
 * - URL 长度越短越好 -长度/100
 *
 * @param url1 第一个 URL
 * @param url2 第二个 URL
 * @returns 返回质量更好的 URL
 */
export function selectBetterUrl(url1: string, url2: string): string {
  if (!url1) return url2;
  if (!url2) return url1;

  const scoreUrl = (url: string): number => {
    let score = 0;
    const lower = url.toLowerCase();

    // 没有 www 加分
    if (!lower.includes('www.')) {
      score += 5;
    }

    // 没有末尾斜杠加分
    if (!lower.endsWith('/')) {
      score += 3;
    }

    // 长度更短加分（长度越短分数越高）
    score -= url.length / 100;

    return score;
  };

  return scoreUrl(url1) >= scoreUrl(url2) ? url1 : url2;
}

/**
 * 在数组中查找重复的 URL
 *
 * @param urls URL 数组
 * @returns 重复组列表，每组包含重复的 URL 列表
 */
export function findDuplicateUrlGroups(urls: string[]): string[][] {
  const groups: Map<string, string[]> = new Map();

  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain) continue;

    if (!groups.has(domain)) {
      groups.set(domain, []);
    }
    groups.get(domain)!.push(url);
  }

  // 只返回包含 2 个或以上的重复组
  return Array.from(groups.values()).filter((group) => group.length > 1);
}

/**
 * 从重复组中选择最佳 URL（用于合并）
 *
 * @param urls URL 数组
 * @returns 质量最好的 URL
 */
export function selectBestUrlFromGroup(urls: string[]): string {
  if (urls.length === 0) return '';
  if (urls.length === 1) return urls[0];

  let best = urls[0];
  for (let i = 1; i < urls.length; i++) {
    best = selectBetterUrl(best, urls[i]);
  }
  return best;
}

/**
 * 规范化和去重 URL 列表
 *
 * @param urls URL 数组
 * @returns 规范化后且去重的 URL 数组
 */
export function deduplicateUrls(urls: string[]): string[] {
  const normalized = urls.map(normalizeUrl);
  const domains = new Map<string, string>();

  for (const url of normalized) {
    const domain = extractDomain(url);
    if (!domain) continue;

    if (domains.has(domain)) {
      // 如果已存在，保留质量更好的
      const existing = domains.get(domain)!;
      domains.set(domain, selectBetterUrl(existing, url));
    } else {
      domains.set(domain, url);
    }
  }

  return Array.from(domains.values());
}
