/**
 * Semrush 数据解析服务
 * 支持从复制粘贴的 Semrush 数据中提取关键指标
 */

export interface SemrushData {
  domain: string;
  authorityScore?: number;
  organicTraffic?: number;
  organicKeywords?: number;
  paidTraffic?: number;
  backlinks?: number;
  refDomains?: number;
  aiVisibility?: number;
  aiMentions?: number;
  trafficChange?: number;
  keywordsChange?: number;
  tags?: string[]; // Semrush 标签数组，例如 ['Link farm', 'Adult content', ...]
}

/**
 * 已知的 Semrush 标签列表（基于常见的网站风险和内容类别标记）
 */
const KNOWN_SEMRUSH_TAGS = [
  'Link farm',
  'Adult content',
  'Gambling',
  'Spam',
  'Malware',
  'Phishing',
  'Suspicious',
  'Not indexed',
  'Slow loading',
  'Server issues',
  'SSL issues',
  'Mobile friendly',
  'Low authority',
  'Newly registered',
  'Outdated content',
  'Duplicate content',
  'Very good',
];

/**
 * 从文本中提取数字（支持 K、M、B 等单位）
 * @param text 输入文本，例如 "256.5K", "69.5M"
 * @returns 完整数字
 */
function parseNumber(text: string): number {
  if (!text) return 0;

  const trimmed = text.trim().replace(/,/g, '');

  // 移除百分号
  const withoutPercent = trimmed.replace('%', '');

  // 检查单位
  if (withoutPercent.endsWith('K') || withoutPercent.endsWith('k')) {
    return parseFloat(withoutPercent) * 1000;
  }
  if (withoutPercent.endsWith('M') || withoutPercent.endsWith('m')) {
    return parseFloat(withoutPercent) * 1_000_000;
  }
  if (withoutPercent.endsWith('B') || withoutPercent.endsWith('b')) {
    return parseFloat(withoutPercent) * 1_000_000_000;
  }

  return parseFloat(withoutPercent) || 0;
}

/**
 * 从粘贴的 Semrush 数据中解析结构化数据
 * 支持多种格式：
 * 1. 纯域名开头：producthunt.com\nAuthority Score\n49\nOrganic traffic\n256.5K
 * 2. 复杂格式：包含 USD、AI Visibility 等额外信息
 * 3. 标签分隔：Authority Score\n49\nOrganic traffic\n256.5K（无域名）
 */
export function parseSemrushPaste(pastedText: string): SemrushData[] {
  const lines = pastedText.split('\n').map(line => line.trim()).filter(line => line);

  // 识别数据块（通常以域名开头）
  const dataBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of lines) {
    // 检查是否是新的数据块起始（域名行）
    // 识别模式：看起来像域名的行（有 .com/.io/.org 等顶级域名）
    // 但不是数字、单位或 Semrush 关键词
    const lowerLine = line.toLowerCase();

    // 必须看起来像有效的域名
    const hasTLD = /\.(com|io|ai|net|org|co|dev|app|site|xyz|tv|info|top|biz|shop|pro|club|tech|blog|online|store|center|cloud|works|digital|media|agency|group|company|careers|solutions|services|support|community|education|health|global|international|local|regional)$/i.test(line);

    // 不能是数字、单位或百分比
    const notValue = !line.match(/^\d+\.?\d*[KMB%]?$/) &&
                     !line.match(/^[+-]?\d+\.?\d*%?$/) &&
                     !line.match(/^\d+\.?\d*$/);

    // 不能包含 Semrush 指标关键词
    const notMetric = !lowerLine.includes('traffic') &&
                      !lowerLine.includes('authority') &&
                      !lowerLine.includes('backlink') &&
                      !lowerLine.includes('keyword') &&
                      !lowerLine.includes('mention') &&
                      !lowerLine.includes('visibility') &&
                      !lowerLine.includes('ai ');

    const isDomainLine = hasTLD && notValue && notMetric;

    if (isDomainLine) {
      if (currentBlock.length > 0) {
        dataBlocks.push(currentBlock);
      }
      currentBlock = [line];
    } else if (line.length > 0) {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    dataBlocks.push(currentBlock);
  }

  // 解析每个数据块
  const results = dataBlocks.map(block => parseSemrushBlock(block)).filter(block => block.domain);

  // 如果没有找到任何数据块，尝试直接解析所有行作为单个块
  if (results.length === 0 && lines.length > 0) {
    const singleBlockResult = parseSemrushBlock(lines);
    if (singleBlockResult.domain) {
      results.push(singleBlockResult);
    }
  }

  return results;
}

/**
 * 解析单个 Semrush 数据块
 */
function parseSemrushBlock(lines: string[]): SemrushData {
  const data: SemrushData = {
    domain: '',
  };

  // 预处理：过滤掉无关的行（如货币代码、地区信息等）
  const filterLine = (line: string): boolean => {
    const lowerLine = line.toLowerCase();
    // 过滤掉纯数字、单个字母、货币代码等无意义词汇
    if (lowerLine === 'usd' || lowerLine === 'us' || lowerLine === 'today,' || lowerLine === 'today') return false;
    if (lowerLine === 'soon' || lowerLine === '-' || lowerLine === ':' || lowerLine === '域名概览：') return false;
    if (line.match(/^[A-Z]{2}$/)) return false; // 国家代码
    if (lowerLine === 'chatgpt' || lowerLine === 'gemini' || lowerLine === 'ai overview' || lowerLine === 'ai mode') return false; // AI 产品名
    if (lowerLine.includes('流量比例') || lowerLine.includes('引用') || lowerLine.includes('cited')) return false;
    // 注意：保留所有可能的标签，包括 'very good' 等
    // 不过滤短词，让标签提取器处理
    return true;
  };

  const filteredLines = lines.filter(filterLine);

  // 预处理：将字段名和值配对
  // 例如：["Authority Score", "49", "Organic traffic", "256.5K"]
  // 转换为：["Authority Score 49", "Organic traffic 256.5K"]
  const processedLines: string[] = [];
  for (let i = 0; i < filteredLines.length; i++) {
    const line = filteredLines[i];
    const lowerLine = line.toLowerCase();

    // 检查这一行是否是字段名（包含 Semrush 关键词但不是值）
    const isSemrushFieldName =
      (lowerLine.includes('authority') || lowerLine.includes('organic') ||
       lowerLine.includes('paid') || lowerLine.includes('backlink') ||
       lowerLine.includes('ref') || lowerLine.includes('ai ') ||
       lowerLine.includes('traffic') || lowerLine.includes('keyword') ||
       lowerLine.includes('mention') || lowerLine.includes('visibility')) &&
      !line.match(/^\d+/) && // 不是以数字开头
      !line.includes('K') && !line.includes('M') && !line.includes('B') && // 不包含单位
      !line.includes('%') && // 不包含百分号
      !line.match(/^\d+\.?\d*$/); // 不是纯数字

    if (isSemrushFieldName) {
      // 查找这个字段的值
      let valueFound = false;
      // 检查是否已经有值在同一行
      const afterColon = line.split(/[:=]/).slice(1).join(':').trim();
      if (afterColon && (afterColon.match(/^\d/) || afterColon.includes('K') || afterColon.includes('M'))) {
        // 值已经在同一行了
        processedLines.push(line);
        valueFound = true;
      } else if (i + 1 < filteredLines.length) {
        // 下一行可能是值，检查下一行是否看起来像一个值
        const nextLine = filteredLines[i + 1];
        if (nextLine.match(/^\d/) || nextLine.match(/^[+-]/)) {
          // 合并字段名和值
          processedLines.push(`${line} ${nextLine}`);
          i++; // 跳过下一行，因为我们已经处理过了
          valueFound = true;
        }
      }

      if (!valueFound) {
        processedLines.push(line);
      }
    } else {
      processedLines.push(line);
    }
  }

  // 后处理：清理单独的值行（没有字段名的数值）
  // 将它们附加到前面的字段名
  const finalProcessedLines: string[] = [];
  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];

    // 检查是否是单独的值行（以数字或+/-开头，不包含空格）
    if ((line.match(/^\d/) || line.match(/^[+-]/)) && !line.includes(' ')) {
      // 这可能是前一个字段的值
      if (finalProcessedLines.length > 0) {
        // 将其附加到前一行
        finalProcessedLines[finalProcessedLines.length - 1] = `${finalProcessedLines[finalProcessedLines.length - 1]} ${line}`;
      } else {
        finalProcessedLines.push(line);
      }
    } else {
      finalProcessedLines.push(line);
    }
  }

  for (const line of finalProcessedLines) {
    const lowerLine = line.toLowerCase();

    // 提取域名
    if (!data.domain && line.includes('.')) {
      const domainMatch = line.match(/([a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+)/);
      if (domainMatch) {
        data.domain = domainMatch[1];
      }
    }

    // Authority Score
    if (lowerLine.includes('authority') || lowerLine.includes('authority score')) {
      const numbers = line.match(/\d+/g);
      if (numbers) {
        data.authorityScore = parseInt(numbers[0]);
      }
    }

    // Organic traffic
    if (lowerLine.includes('organic') && lowerLine.includes('traffic')) {
      // 首先尝试从冒号/等号后面获取值
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      // 如果没有找到分隔符的值，直接提取数字和单位
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.organicTraffic = parseNumber(value);
      }
    }

    // Organic keywords
    if (lowerLine.includes('organic') && lowerLine.includes('keyword')) {
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.organicKeywords = Math.round(parseNumber(value));
      }
    }

    // Paid traffic
    if (lowerLine.includes('paid') && lowerLine.includes('traffic')) {
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.paidTraffic = parseNumber(value);
      }
    }

    // Backlinks
    if (lowerLine.includes('backlink') && !lowerLine.includes('ref')) {
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.backlinks = Math.round(parseNumber(value));
      }
    }

    // Ref.Domains 或 Referring Domains
    if (lowerLine.includes('ref') && lowerLine.includes('domain')) {
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.refDomains = Math.round(parseNumber(value));
      }
    }

    // AI Visibility
    if (lowerLine.includes('ai') && lowerLine.includes('visibility')) {
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.aiVisibility = Math.round(parseNumber(value));
      }
    }

    // AI Mentions
    if (lowerLine.includes('ai') && lowerLine.includes('mention')) {
      const splitResult = line.split(/[:=]/);
      let value = '';
      if (splitResult.length > 1) {
        value = splitResult[1].trim();
      }
      if (!value) {
        const match = line.match(/(\d+\.?\d*)\s*([KMB])?/);
        if (match) {
          value = `${match[1]}${match[2] || ''}`;
        }
      }
      if (value) {
        data.aiMentions = Math.round(parseNumber(value));
      }
    }

    // Traffic Change (+1.7% 或 -5.7%)
    if (lowerLine.includes('traffic') && (line.includes('+') || line.includes('-'))) {
      const match = line.match(/([+-]?\d+\.?\d*)\s*%/);
      if (match) {
        data.trafficChange = parseFloat(match[1]);
      }
    }

    // Keywords Change (百分比变化，可能与 Organic keywords 在同一行或分离)
    if ((lowerLine.includes('keyword') || line.includes('change')) && (line.includes('+') || line.includes('-'))) {
      // 提取百分比，但不提取 Organic keywords 本身的值（如 266.6K）
      const match = line.match(/([+-]?\d+\.?\d*)\s*%/);
      if (match && !data.keywordsChange) {
        data.keywordsChange = parseFloat(match[1]);
      }
    }
  }

  // 提取标签：在 Authority Score 之后的非数字行作为标签
  // Semrush 的格式是：Authority Score -> 分数 -> 标签（如 "Very good"）
  const tags: string[] = [];

  // 已知的 Semrush 字段名（精确匹配，而不是包含匹配）
  const semrushFieldNames = new Set([
    'organic traffic',
    'paid traffic',
    'backlinks',
    'ref.domains',
    'referring domains',
    'organic keywords',
    'paid keywords',
    'ai visibility',
    'ai mentions',
    'cited pages',
    'traffic change',
    'keywords change',
    'authority score',
  ]);

  for (let i = 0; i < finalProcessedLines.length; i++) {
    const line = finalProcessedLines[i];
    const lowerLine = line.toLowerCase();

    // 找到 Authority Score 行
    if (lowerLine.includes('authority') && lowerLine.includes('score')) {
      // 查找后续的第一个非数字、非字段名的行作为标签
      for (let j = i + 1; j < finalProcessedLines.length; j++) {
        const nextLine = finalProcessedLines[j].trim();
        const lowerNextLine = nextLine.toLowerCase();

        // 跳过纯数字行
        if (nextLine.match(/^\d+\.?\d*[KMB%]?$/)) {
          continue;
        }

        // 检查是否是已知的字段名（精确匹配）
        let isFieldName = false;
        for (const fieldName of semrushFieldNames) {
          if (lowerNextLine === fieldName ||
              (lowerNextLine.startsWith(fieldName) && !lowerNextLine.replace(fieldName, '').trim().match(/^\d/))) {
            isFieldName = true;
            break;
          }
        }

        if (isFieldName) {
          break;
        }

        // 这就是标签
        if (nextLine && !tags.includes(nextLine)) {
          tags.push(nextLine);
        }
        break;
      }
      break; // 只需要找一个标签，Authority Score 之后的就是
    }
  }

  if (tags.length > 0) {
    data.tags = tags;
  }

  return data;
}

/**
 * 从 Semrush 数据生成备注
 */
export function generateNoteFromSemrush(data: SemrushData): string {
  const parts: string[] = [];

  if (data.authorityScore !== undefined) {
    parts.push(`Authority: ${data.authorityScore}`);
  }
  if (data.organicTraffic) {
    const trafficK = Math.round(data.organicTraffic / 1000);
    parts.push(`Traffic: ${trafficK}K`);
  }
  if (data.refDomains) {
    const refK = Math.round(data.refDomains / 1000);
    parts.push(`RefDomains: ${refK}K`);
  }
  if (data.backlinks) {
    const backlinksM = Math.round(data.backlinks / 1_000_000 * 10) / 10;
    parts.push(`Backlinks: ${backlinksM}M`);
  }

  return parts.join(' | ');
}

/**
 * 验证解析结果
 */
export function validateSemrushData(data: SemrushData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.domain || data.domain.length === 0) {
    errors.push('Missing domain');
  }

  if (data.authorityScore !== undefined && (data.authorityScore < 0 || data.authorityScore > 100)) {
    errors.push('Authority Score must be between 0 and 100');
  }

  if (data.organicTraffic && data.organicTraffic < 0) {
    errors.push('Organic traffic cannot be negative');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
