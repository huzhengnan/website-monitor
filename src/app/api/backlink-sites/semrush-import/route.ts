import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  parseSemrushPaste,
  validateSemrushData,
  generateNoteFromSemrush,
} from '@/lib/services/semrush-parser.service';
import { extractDomain, normalizeUrl, selectBetterUrl } from '@/lib/services/url-normalization.service';
import { calculateImportanceScore } from '@/lib/services/importance-score.service';

/**
 * 导入 Semrush 数据到外链站点
 * POST /api/backlink-sites/semrush-import
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pastedText } = body;

    if (!pastedText || typeof pastedText !== 'string') {
      return NextResponse.json(
        { success: false, message: 'pastedText is required' },
        { status: 400 }
      );
    }

    // 解析 Semrush 数据
    const parsedDataList = parseSemrushPaste(pastedText);

    if (parsedDataList.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No valid Semrush data found in pasted text' },
        { status: 400 }
      );
    }

    // 验证并更新数据
    const results = {
      success: 0,
      updated: 0,
      failed: 0,
      errors: [] as { domain: string; error: string }[],
    };

    for (const semrushData of parsedDataList) {
      try {
        // 验证数据
        const validation = validateSemrushData(semrushData);
        if (!validation.valid) {
          results.failed++;
          results.errors.push({
            domain: semrushData.domain || 'unknown',
            error: validation.errors.join(', '),
          });
          continue;
        }

        const domain = extractDomain(semrushData.domain).toLowerCase();
        const rawUrl = `https://${domain}`;
        const url = normalizeUrl(rawUrl); // 规范化 URL（处理 www、末尾斜杠等）
        const now = new Date();

        // 分别构建数据以避免 Prisma BigInt 类型混合错误
        // 1. 常规字段（不包含 BigInt 和 JSON）
        const updateDataWithoutBigIntAndJson: any = {
          semrushLastSync: now,
          note: generateNoteFromSemrush(semrushData),
        };

        if (semrushData.authorityScore !== undefined) {
          updateDataWithoutBigIntAndJson.authorityScore = semrushData.authorityScore;
        }
        if (semrushData.organicTraffic) {
          updateDataWithoutBigIntAndJson.organicTraffic = semrushData.organicTraffic.toString();
        }
        if (semrushData.organicKeywords) {
          updateDataWithoutBigIntAndJson.organicKeywords = semrushData.organicKeywords;
        }
        if (semrushData.paidTraffic) {
          updateDataWithoutBigIntAndJson.paidTraffic = semrushData.paidTraffic.toString();
        }
        if (semrushData.refDomains) {
          updateDataWithoutBigIntAndJson.refDomains = semrushData.refDomains;
        }
        if (semrushData.aiVisibility) {
          updateDataWithoutBigIntAndJson.aiVisibility = semrushData.aiVisibility;
        }
        if (semrushData.aiMentions) {
          updateDataWithoutBigIntAndJson.aiMentions = semrushData.aiMentions;
        }
        if (semrushData.trafficChange !== undefined) {
          updateDataWithoutBigIntAndJson.trafficChange = semrushData.trafficChange.toString();
        }
        if (semrushData.keywordsChange !== undefined) {
          updateDataWithoutBigIntAndJson.keywordsChange = semrushData.keywordsChange.toString();
        }

        // 2. BigInt 字段
        let backlinksValue: bigint | undefined;
        if (semrushData.backlinks) {
          backlinksValue = BigInt(Math.round(semrushData.backlinks));
        }

        // 检查是否已存在（优先检查完全相同的 URL）
        let existingSite = await prisma.backlinkSite.findUnique({
          where: { url },
        });

        // 如果 URL 不存在，检查是否存在同 domain 但不同 URL 的记录（可能是末尾斜杠等差异）
        if (!existingSite) {
          const domainSites = await prisma.backlinkSite.findMany({
            where: { domain },
            orderBy: { createdAt: 'asc' },
            take: 1,
          });

          if (domainSites.length > 0) {
            // 发现同 domain 的现有记录，比较 URL 质量，选择更好的 URL
            const existingUrl = domainSites[0].url;
            const betterUrl = selectBetterUrl(url, existingUrl);

            if (betterUrl !== existingUrl) {
              // 新 URL 更好，需要更新现有记录的 URL
              existingSite = domainSites[0];

              // 更新为更规范的 URL
              await (prisma.backlinkSite.update as any)({
                where: { id: existingSite.id },
                data: { url: betterUrl },
              });

              // 更新 URL 引用
              existingSite = await prisma.backlinkSite.findUnique({
                where: { url: betterUrl },
              });
            } else {
              // 现有 URL 更好，使用现有 URL
              existingSite = domainSites[0];
            }
          }
        }

        const isNew = !existingSite;

        // 使用 upsert - 自动创建或更新（用 url 作为唯一字段）
        // 注意：不在 upsert 时混合 BigInt 和其他类型，避免 Prisma 类型混合错误
        const site = await (prisma.backlinkSite.upsert as any)({
          where: { url },
          create: {
            url,
            domain,
            ...updateDataWithoutBigIntAndJson,
          },
          update: updateDataWithoutBigIntAndJson,
        });

        // 单独处理 BigInt 字段（避免与其他类型混合）
        if (backlinksValue) {
          await (prisma.backlinkSite.update as any)({
            where: { id: site.id },
            data: { backlinks: backlinksValue },
          });
        }

        // 单独处理 JSON 数据
        await (prisma.backlinkSite.update as any)({
          where: { id: site.id },
          data: { semrushDataJson: semrushData },
        });

        // 自动计算重要程度评分
        const importanceScore = await calculateImportanceScore(site.id);
        await (prisma.backlinkSite.update as any)({
          where: { id: site.id },
          data: { importanceScore },
        });

        // 统计结果
        if (isNew) {
          results.success++;
        } else {
          results.updated++;
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          domain: semrushData.domain || 'unknown',
          error: error.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Semrush data imported successfully',
      data: {
        total: parsedDataList.length,
        created: results.success,
        updated: results.updated,
        failed: results.failed,
        errors: results.errors.length > 0 ? results.errors : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to import Semrush data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to import Semrush data' },
      { status: 500 }
    );
  }
}
