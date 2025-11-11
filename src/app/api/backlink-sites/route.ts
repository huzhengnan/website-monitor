import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateImportanceScore, initializeImportanceScore } from '@/lib/services/importance-score.service';
import {
  normalizeUrl,
  extractDomain,
  areDuplicateUrls,
  selectBetterUrl,
} from '@/lib/services/url-normalization.service';

// 转换 BigInt 为字符串以便 JSON 序列化
function serializeBigInt(data: any) {
  return {
    ...data,
    backlinks: data.backlinks ? data.backlinks.toString() : null,
  };
}

// 获取所有外链站点列表（支持分页、排序、搜索）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const keyword = searchParams.get('keyword');
    const sortField = searchParams.get('sortField') || 'createdAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const where: any = keyword
      ? {
          OR: [
            { domain: { contains: keyword, mode: 'insensitive' } },
            { url: { contains: keyword, mode: 'insensitive' } },
            { note: { contains: keyword, mode: 'insensitive' } },
          ],
        }
      : {};

    // 构建排序对象 - 收藏的始终排在前面
    const orderBy: any = [
      { isFavorite: 'desc' }, // 收藏的排在前面
    ];

    if (
      sortField === 'createdAt' ||
      sortField === 'updatedAt' ||
      sortField === 'domain' ||
      sortField === 'dr' ||
      sortField === 'importanceScore' ||
      sortField === 'authorityScore' ||
      sortField === 'organicTraffic'
    ) {
      orderBy.push({ [sortField]: sortOrder });
    } else {
      // 其他字段默认按重要程度降序
      orderBy.push({ importanceScore: 'desc' });
    }

    const skip = (page - 1) * pageSize;

    const [sites, total] = await Promise.all([
      prisma.backlinkSite.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          backlinkSubmissions: {
            select: { id: true }, // 只获取 ID 用于计数
          },
        },
      }),
      prisma.backlinkSite.count({ where }),
    ]);

    // 转换 BigInt 和 Decimal 为字符串以便 JSON 序列化，并添加提交数量
    const serializedSites = sites.map((site: any) => {
      const serialized: any = {
        id: site.id,
        url: site.url,
        domain: site.domain,
        dr: site.dr,
        note: site.note,
        isFavorite: site.isFavorite,
        importanceScore: site.importanceScore,
        authorityScore: site.authorityScore,
        organicTraffic: site.organicTraffic,
        organicKeywords: site.organicKeywords,
        paidTraffic: site.paidTraffic,
        backlinks: site.backlinks ? site.backlinks.toString() : null,
        refDomains: site.refDomains,
        aiVisibility: site.aiVisibility,
        aiMentions: site.aiMentions,
        trafficChange: site.trafficChange,
        keywordsChange: site.keywordsChange,
        semrushLastSync: site.semrushLastSync,
        semrushDataJson: site.semrushDataJson,
        semrushTags: site.semrushTags,
        submitUrl: site.submitUrl,
        riskLevel: site.riskLevel,
        createdAt: site.createdAt,
        updatedAt: site.updatedAt,
        submissionCount: site.backlinkSubmissions?.length || 0,
      };
      return serialized;
    });

    return NextResponse.json({
      success: true,
      data: serializedSites,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error('Failed to fetch backlink sites:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch backlink sites' },
      { status: 500 }
    );
  }
}

// 创建新的外链站点
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { url, domain, dr, note } = body;

    if (!url || !domain) {
      return NextResponse.json(
        { success: false, message: 'url and domain are required' },
        { status: 400 }
      );
    }

    // 规范化 URL
    url = normalizeUrl(url);
    domain = extractDomain(url);

    // 检查完全相同的 URL 是否已存在
    const existingByUrl = await prisma.backlinkSite.findUnique({
      where: { url },
    });

    if (existingByUrl) {
      return NextResponse.json(
        { success: false, message: 'This backlink site already exists', status: 'duplicate_exact' },
        { status: 409 }
      );
    }

    // 检查是否存在相同域名的其他记录
    const existingByDomain = await prisma.backlinkSite.findFirst({
      where: { domain },
    });

    if (existingByDomain) {
      // 存在相同域名的记录，选择哪个更好
      const betterUrl = selectBetterUrl(existingByDomain.url, url);

      // 如果新 URL 更好，则更新现有记录
      if (betterUrl === url) {
        const updated = await prisma.backlinkSite.update({
          where: { id: existingByDomain.id },
          data: {
            url,
            note: note || existingByDomain.note, // 新备注，如果没有则保留旧的
            dr: dr ? parseFloat(dr) : existingByDomain.dr, // 新 DR，如果没有则保留旧的
          },
        });

        return NextResponse.json(
          {
            success: true,
            data: serializeBigInt(updated),
            message: 'Duplicate detected. Updated existing record with better URL',
            status: 'duplicate_merged',
          },
          { status: 200 }
        );
      } else {
        // 现有 URL 更好，返回现有记录
        return NextResponse.json(
          {
            success: true,
            data: serializeBigInt(existingByDomain),
            message: 'Duplicate detected. Existing record has better URL format',
            status: 'duplicate_exists',
          },
          { status: 200 }
        );
      }
    }

    // 新建记录
    const site = await prisma.backlinkSite.create({
      data: {
        url,
        domain,
        dr: dr ? parseFloat(dr) : null,
        note,
      },
    });

    // 异步计算重要程度评分（不阻塞返回）
    initializeImportanceScore(site.id).catch((error) => {
      console.error('Failed to calculate importance score:', error);
    });

    return NextResponse.json(
      {
        success: true,
        data: serializeBigInt(site),
        message: 'Backlink site created successfully',
        status: 'created',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create backlink site:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create backlink site' },
      { status: 500 }
    );
  }
}
