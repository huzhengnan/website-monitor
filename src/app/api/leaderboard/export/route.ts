import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/services/evaluations.service';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dimension = (searchParams.get('dimension') || 'composite') as 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '100', 10);
    const result = await getLeaderboard(dimension, page, pageSize);
    const header = 'rank,siteId,siteName,domain,status,score,evaluationDate\n';
    const rows = result.items.map((it) => [
      it.rank,
      JSON.stringify(it.siteId),
      JSON.stringify(it.siteName),
      JSON.stringify(it.domain),
      JSON.stringify(it.status),
      it.score,
      new Date(it.evaluationDate).toISOString(),
    ].join(','));
    const csv = header + rows.join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="leaderboard_${dimension}.csv"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Export failed' }, { status: 500 });
  }
}

