import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface QuickImportItem {
  domain: string;
  url?: string;
  note?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domains, siteId } = body as { domains: QuickImportItem[]; siteId?: string };

    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return NextResponse.json(
        { success: false, message: 'domains array is required and must not be empty' },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ domain: string; error: string }> = [];

    // 验证 siteId 是否存在（如果提供）
    let site = null;
    if (siteId) {
      site = await prisma.site.findUnique({
        where: { id: siteId },
      });
      if (!site) {
        return NextResponse.json(
          { success: false, message: 'Site not found' },
          { status: 404 }
        );
      }
    }

    for (const item of domains) {
      try {
        const domain = item.domain.trim();
        const url = item.url || `https://${domain}`;
        const note = item.note;

        if (!domain) {
          failed++;
          errors.push({ domain: '', error: 'Domain is empty' });
          continue;
        }

        // 查找或创建外链站点
        let backlinkSite = await prisma.backlinkSite.findFirst({
          where: { domain },
        });

        if (backlinkSite) {
          // 更新现有记录
          backlinkSite = await prisma.backlinkSite.update({
            where: { id: backlinkSite.id },
            data: {
              url,
              note: note || backlinkSite.note,
            },
          });
          updated++;
        } else {
          // 创建新的外链站点
          backlinkSite = await prisma.backlinkSite.create({
            data: {
              url,
              domain,
              note,
            },
          });
          created++;
        }

        // 如果提供了 siteId，创建提交记录
        if (site && siteId) {
          const existingSubmission = await prisma.backlinkSubmission.findUnique({
            where: {
              siteId_backlinkSiteId: {
                siteId,
                backlinkSiteId: backlinkSite.id,
              },
            },
          });

          if (!existingSubmission) {
            await prisma.backlinkSubmission.create({
              data: {
                siteId,
                backlinkSiteId: backlinkSite.id,
                status: 'submitted',
                submitDate: new Date(),
              },
            });
          }
        }
      } catch (error: any) {
        failed++;
        errors.push({
          domain: item.domain,
          error: error?.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Quick import completed: ${created} created, ${updated} updated, ${failed} failed`,
        stats: {
          created,
          updated,
          failed,
          total: domains.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Failed to quick import backlinks:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to quick import backlinks', error: error?.message },
      { status: 500 }
    );
  }
}
