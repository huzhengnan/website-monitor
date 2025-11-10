import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 序列化 Decimal 和其他特殊类型
function serializeSubmissions(submissions: any[]) {
  return submissions.map((submission) => ({
    ...submission,
    cost: submission.cost ? Number(submission.cost) : null,
  }));
}

// 获取外链站点的提交详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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
      data: serializeSubmissions(submissions),
    });
  } catch (error) {
    console.error('Failed to fetch backlink submissions:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch backlink submissions' },
      { status: 500 }
    );
  }
}
