import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import {
  parseSemrushPaste,
  validateSemrushData,
  generateNoteFromSemrush,
} from '@/lib/services/semrush-parser.service';
import { extractDomain } from '@/lib/services/url-normalization.service';
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
        const url = `https://${domain}`;
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
        const isNew = site.createdAt.getTime() === site.updatedAt.getTime() &&
                     site.updatedAt.getTime() > now.getTime() - 1000;
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
