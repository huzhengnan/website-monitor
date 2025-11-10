import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const items = await prisma.backlinkSite.findMany({ orderBy: { createdAt: 'desc' } });
    const header = 'domain,url,dr,note,createdAt\n';
    const rows = items.map((it) => [
      JSON.stringify(it.domain ?? ''),
      JSON.stringify(it.url ?? ''),
      it.dr == null ? '' : String(it.dr),
      JSON.stringify(it.note ?? ''),
      it.createdAt.toISOString(),
    ].join(','));
    const csv = header + rows.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="backlinks.csv"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Export failed' }, { status: 500 });
  }
}
