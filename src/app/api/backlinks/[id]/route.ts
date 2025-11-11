import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 辅助函数：将Prisma对象转换为可序列化的JSON对象
function serializeData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === 'bigint') {
    return data.toString();
  }

  if (data instanceof Date) {
    return data.toISOString();
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => serializeData(item));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serializeData(value);
    }
    return result;
  }

  return data;
}

// 更新外链提交记录
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      status,
      notes,
      submitDate,
      indexedDate,
      cost,
      trackedAt,
    } = body;

    const submission = await prisma.backlinkSubmission.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(notes !== undefined && { notes }),
        ...(submitDate && { submitDate: new Date(submitDate) }),
        ...(indexedDate && { indexedDate: new Date(indexedDate) }),
        ...(cost !== undefined && { cost: cost ? parseFloat(cost) : null }),
        ...(trackedAt && { trackedAt: new Date(trackedAt) }),
      },
      include: {
        backlinkSite: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeData(submission),
      message: 'Backlink submission updated successfully',
    });
  } catch (error) {
    console.error('Failed to update backlink submission:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update backlink submission' },
      { status: 500 }
    );
  }
}

// 删除外链提交记录
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.backlinkSubmission.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Backlink submission deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete backlink submission:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete backlink submission' },
      { status: 500 }
    );
  }
}

