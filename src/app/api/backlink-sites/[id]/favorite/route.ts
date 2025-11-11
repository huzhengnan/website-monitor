import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { isFavorite } = body;

    if (typeof isFavorite !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'isFavorite must be a boolean' },
        { status: 400 }
      );
    }

    // 更新收藏状态
    const updated = await prisma.backlinkSite.update({
      where: { id },
      data: { isFavorite },
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, isFavorite: updated.isFavorite },
    });
  } catch (error: any) {
    console.error('Toggle favorite error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to toggle favorite' },
      { status: 500 }
    );
  }
}
