import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 获取外链站点的提交详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const submissions = await prisma.backlinkSubmission.findMany({
      where: { backlinkSiteId: id },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
      orderBy: { submitDate: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: submissions,
    });
  } catch (error) {
    console.error('Failed to fetch backlink submissions:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch backlink submissions' },
      { status: 500 }
    );
  }
}
