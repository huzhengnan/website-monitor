import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 删除外链站点
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;

    const site = await prisma.backlinkSite.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: site,
      message: 'Backlink site deleted successfully',
    });
  } catch (error: any) {
    console.error('Failed to delete backlink site:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, message: 'Backlink site not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Failed to delete backlink site' },
      { status: 500 }
    );
  }
}
