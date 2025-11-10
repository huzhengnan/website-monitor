import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateRelatedScores } from '@/lib/services/importance-score.service';

// 获取指定网站的外链提交记录
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json(
        { success: false, message: 'siteId is required' },
        { status: 400 }
      );
    }

    const submissions = await prisma.backlinkSubmission.findMany({
      where: { siteId },
      include: {
        backlinkSite: true,
      },
      orderBy: { createdAt: 'desc' },
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

// 创建新的外链提交记录
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      siteId,
      backlinkSiteId,
      status,
      notes,
      submitDate,
      indexedDate,
      cost,
    } = body;

    if (!siteId || !backlinkSiteId) {
      return NextResponse.json(
        { success: false, message: 'siteId and backlinkSiteId are required' },
        { status: 400 }
      );
    }

    // 检查是否已存在
    const existing = await prisma.backlinkSubmission.findUnique({
      where: {
        siteId_backlinkSiteId: {
          siteId,
          backlinkSiteId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'This submission already exists' },
        { status: 409 }
      );
    }

    const submission = await prisma.backlinkSubmission.create({
      data: {
        siteId,
        backlinkSiteId,
        status: status || 'pending',
        notes,
        submitDate: submitDate ? new Date(submitDate) : null,
        indexedDate: indexedDate ? new Date(indexedDate) : null,
        cost: cost ? parseFloat(cost) : null,
      },
      include: {
        backlinkSite: true,
      },
    });

    // 异步更新外链网站的重要程度评分
    updateRelatedScores(backlinkSiteId).catch((error) => {
      console.error('Failed to update importance score:', error);
    });

    return NextResponse.json(
      {
        success: true,
        data: submission,
        message: 'Backlink submission created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create backlink submission:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create backlink submission' },
      { status: 500 }
    );
  }
}
