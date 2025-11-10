import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface GSCImportPayload {
  siteId: string; // 我们的网站ID
  backlinkDomains: Array<{
    domain: string;
    url?: string;
    indexedDate?: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    const body: GSCImportPayload = await request.json();
    const { siteId, backlinkDomains } = body;

    if (!siteId || !backlinkDomains || backlinkDomains.length === 0) {
      return NextResponse.json(
        { success: false, message: 'siteId and backlinkDomains are required' },
        { status: 400 }
      );
    }

    // 验证网站是否存在
    const site = await prisma.site.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, message: 'Site not found' },
        { status: 404 }
      );
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: Array<{ domain: string; error: string }> = [];

    for (const backlink of backlinkDomains) {
      try {
        // 查找或创建外链站点
        let backlinkSite = await prisma.backlinkSite.findFirst({
          where: { domain: backlink.domain },
        });

        if (!backlinkSite) {
          // 创建新的外链站点
          const url = backlink.url || `https://${backlink.domain}`;
          backlinkSite = await prisma.backlinkSite.create({
            data: {
              url,
              domain: backlink.domain,
            },
          });
        }

        // 检查提交记录是否已存在
        const existingSubmission = await prisma.backlinkSubmission.findUnique({
          where: {
            siteId_backlinkSiteId: {
              siteId,
              backlinkSiteId: backlinkSite.id,
            },
          },
        });

        if (existingSubmission) {
          // 更新为已收录状态
          await prisma.backlinkSubmission.update({
            where: {
              siteId_backlinkSiteId: {
                siteId,
                backlinkSiteId: backlinkSite.id,
              },
            },
            data: {
              status: 'indexed',
              indexedDate: backlink.indexedDate ? new Date(backlink.indexedDate) : new Date(),
            },
          });
          updated++;
        } else {
          // 创建新的提交记录，标记为已收录
          await prisma.backlinkSubmission.create({
            data: {
              siteId,
              backlinkSiteId: backlinkSite.id,
              status: 'indexed',
              submitDate: new Date(),
              indexedDate: backlink.indexedDate ? new Date(backlink.indexedDate) : new Date(),
            },
          });
          created++;
        }
      } catch (error: any) {
        failed++;
        errors.push({
          domain: backlink.domain,
          error: error?.message || 'Unknown error',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `GSC import completed: ${created} created, ${updated} updated, ${failed} failed`,
        stats: {
          created,
          updated,
          failed,
          total: backlinkDomains.length,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Failed to import GSC submissions:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to import GSC submissions', error: error?.message },
      { status: 500 }
    );
  }
}
