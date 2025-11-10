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

        // 检查是否已存在该域名（不管 URL 如何变化）
        const existingSites = await prisma.backlinkSite.findMany({
          where: { domain },
          orderBy: { createdAt: 'asc' },
        });

        let existingSite = null;
        let isNew = true;

        if (existingSites.length > 0) {
          // 找到了同 domain 的记录
          isNew = false;

          // 选择 URL 最规范的记录
          let bestSite = existingSites[0];
          for (const site of existingSites) {
            const betterUrl = selectBetterUrl(site.url, bestSite.url);
            if (betterUrl === site.url) {
              bestSite = site;
            }
          }

          existingSite = bestSite;

          // 如果新的 URL 更规范，则更新该记录的 URL
          const betterUrl = selectBetterUrl(url, existingSite.url);
          if (betterUrl !== existingSite.url) {
            await (prisma.backlinkSite.update as any)({
              where: { id: existingSite.id },
              data: { url: betterUrl },
            });
            existingSite.url = betterUrl;
          }

          // 删除其他同 domain 但不同 URL 的重复记录
          for (const site of existingSites) {
            if (site.id !== existingSite.id) {
              await prisma.backlinkSite.delete({
                where: { id: site.id },
              });
            }
          }
        }

        // 如果是更新操作，需要检查现有备注是否存在，如果存在则追加而不是覆盖
        let updateData = { ...updateDataWithoutBigIntAndJson };
        if (!isNew && existingSite) {
          // 获取现有的备注
          const existingNote = existingSite.note || '';
          const newNote = generateNoteFromSemrush(semrushData);

          // 如果现有备注不为空，就追加新备注（用分号分隔）
          if (existingNote && newNote && !existingNote.includes(newNote)) {
            updateData.note = `${existingNote}; ${newNote}`;
          } else if (newNote) {
            updateData.note = newNote;
          }
        }

        // 创建或更新记录
        // 注意：不在操作时混合 BigInt 和其他类型，避免 Prisma 类型混合错误
        let site;
        if (isNew) {
          // 创建新记录
          site = await (prisma.backlinkSite.create as any)({
            data: {
              url,
              domain,
              ...updateData,
            },
          });
        } else {
          // 更新现有记录
          site = await (prisma.backlinkSite.update as any)({
            where: { id: existingSite!.id },
            data: updateData,
          });
        }

        // 单独处理 BigInt 字段（避免与其他类型混合）
        if (backlinksValue) {
          await (prisma.backlinkSite.update as any)({
            where: { id: site.id },
            data: { backlinks: backlinksValue },
          });
        }

        // 单独处理 JSON 数据和标签
        await (prisma.backlinkSite.update as any)({
          where: { id: site.id },
          data: {
            semrushDataJson: semrushData,
            semrushTags: semrushData.tags || null, // 保存提取的标签或 null
          },
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
