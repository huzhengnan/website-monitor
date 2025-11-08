import { NextRequest, NextResponse } from 'next/server';
import { getSiteEvaluationStats } from '@/lib/services/evaluations.service';
import { ApiError } from '@/lib/types';

/**
 * Get evaluation statistics for a site
 * GET /api/evaluations/stats?siteId=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: siteId' },
        { status: 400 }
      );
    }

    const stats = await getSiteEvaluationStats(siteId);
    return NextResponse.json(
      { success: true, data: stats },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
