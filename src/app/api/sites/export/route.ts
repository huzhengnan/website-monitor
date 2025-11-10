import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';

export async function GET() {
  try {
    const sites = await prisma.site.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        platform: true,
        createdAt: true,
        category: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const header = 'id,name,domain,status,platform,category,createdAt\n';
    const rows = sites.map((s) => [
      JSON.stringify(s.id),
      JSON.stringify(s.name),
      JSON.stringify(s.domain),
      JSON.stringify(s.status),
      JSON.stringify(s.platform || ''),
      JSON.stringify(s.category?.name || ''),
      s.createdAt.toISOString(),
    ].join(','));
    const csv = header + rows.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="sites.csv"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Export failed' }, { status: 500 });
  }
}

