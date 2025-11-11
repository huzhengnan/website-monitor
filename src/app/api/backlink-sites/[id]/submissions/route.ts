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

// 创建提交记录
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status = 'submitted', submitDate, indexedDate, notes } = body;

    // 检查外链网站是否存在
    const backlinkSite = await prisma.backlinkSite.findUnique({
      where: { id },
    });

    if (!backlinkSite) {
      return NextResponse.json(
        { success: false, message: 'Backlink site not found' },
        { status: 404 }
      );
    }

    // 创建提交记录
    const submission = await prisma.backlinkSubmission.create({
      data: {
        backlinkSiteId: id,
        status,
        submitDate: submitDate ? new Date(submitDate) : new Date(),
        indexedDate: indexedDate ? new Date(indexedDate) : null,
        notes,
      },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...submission,
        cost: submission.cost ? Number(submission.cost) : null,
      },
      message: 'Submission created successfully',
    });
  } catch (error) {
    console.error('Failed to create submission:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create submission' },
      { status: 500 }
    );
  }
}
