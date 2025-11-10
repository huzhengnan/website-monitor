import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  normalizeUrl,
  extractDomain,
} from '@/lib/services/url-normalization.service';

// 转换 BigInt 为字符串以便 JSON 序列化
function serializeBigInt(data: any) {
  return {
    ...data,
    backlinks: data.backlinks ? data.backlinks.toString() : null,
  };
}

// 更新外链站点
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const body = await request.json();
    const { url, note, dr } = body;

    // 检查站点是否存在
    const existingSite = await prisma.backlinkSite.findUnique({
      where: { id },
    });

    if (!existingSite) {
      return NextResponse.json(
        { success: false, message: 'Backlink site not found' },
        { status: 404 }
      );
    }

    // 如果修改了 URL，需要规范化并检查重复
    let normalizedUrl = existingSite.url;
    let domain = existingSite.domain;

    if (url && url !== existingSite.url) {
      normalizedUrl = normalizeUrl(url);
      domain = extractDomain(normalizedUrl);

      // 检查新 URL 是否已被其他记录使用
      const duplicateByUrl = await prisma.backlinkSite.findUnique({
        where: { url: normalizedUrl },
      });

      if (duplicateByUrl && duplicateByUrl.id !== id) {
        return NextResponse.json(
          { success: false, message: 'This URL already exists' },
          { status: 409 }
        );
      }

      // 检查新 URL 的域名是否已被其他记录使用
      const duplicateByDomain = await prisma.backlinkSite.findFirst({
        where: {
          domain,
          id: { not: id },
        },
      });

      if (duplicateByDomain) {
        return NextResponse.json(
          { success: false, message: 'A backlink site with this domain already exists' },
          { status: 409 }
        );
      }
    }

    // 更新记录
    const updated = await prisma.backlinkSite.update({
      where: { id },
      data: {
        url: normalizedUrl,
        domain,
        note: note !== undefined ? note : existingSite.note,
        dr: dr !== undefined ? (dr ? parseFloat(dr) : null) : existingSite.dr,
      },
    });

    return NextResponse.json({
      success: true,
      data: serializeBigInt(updated),
      message: 'Backlink site updated successfully',
    });
  } catch (error: any) {
    console.error('Failed to update backlink site:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update backlink site' },
      { status: 500 }
    );
  }
}

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
      data: serializeBigInt(site),
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
