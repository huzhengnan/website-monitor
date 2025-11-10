import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateRelatedScores } from '@/lib/services/importance-score.service';

// 序列化 BigInt 和其他特殊类型
function serializeSubmissions(submissions: any[]) {
  return submissions.map((submission) => ({
    id: submission.id,
    siteId: submission.siteId,
    backlinkSiteId: submission.backlinkSiteId,
    status: submission.status,
    notes: submission.notes,
    submitDate: submission.submitDate,
    indexedDate: submission.indexedDate,
    cost: submission.cost ? Number(submission.cost) : null,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
    backlinkSite: submission.backlinkSite
      ? {
          id: submission.backlinkSite.id,
          url: submission.backlinkSite.url,
          domain: submission.backlinkSite.domain,
          dr: submission.backlinkSite.dr,
          note: submission.backlinkSite.note,
          importanceScore: submission.backlinkSite.importanceScore,
          authorityScore: submission.backlinkSite.authorityScore,
          organicTraffic: submission.backlinkSite.organicTraffic,
          organicKeywords: submission.backlinkSite.organicKeywords,
          paidTraffic: submission.backlinkSite.paidTraffic,
          backlinks: submission.backlinkSite.backlinks
            ? submission.backlinkSite.backlinks.toString()
            : null,
          refDomains: submission.backlinkSite.refDomains,
          aiVisibility: submission.backlinkSite.aiVisibility,
          aiMentions: submission.backlinkSite.aiMentions,
          trafficChange: submission.backlinkSite.trafficChange,
          keywordsChange: submission.backlinkSite.keywordsChange,
          semrushLastSync: submission.backlinkSite.semrushLastSync,
          semrushDataJson: submission.backlinkSite.semrushDataJson,
          createdAt: submission.backlinkSite.createdAt,
          updatedAt: submission.backlinkSite.updatedAt,
        }
      : null,
  }));
}

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
        data: serializeSubmissions([submission])[0],
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
