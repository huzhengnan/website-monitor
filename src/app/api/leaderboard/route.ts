import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/services/evaluations.service';
import { ApiError } from '@/lib/types';

/**
 * Get leaderboard for a specific dimension
 * GET /api/leaderboard?dimension=composite&page=1&pageSize=20
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dimension = (searchParams.get('dimension') ||
      'composite') as 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    const result = await getLeaderboard(dimension, page, pageSize);
    return NextResponse.json(
      {
        success: true,
        data: {
          items: result.items,
          total: result.total,
          page,
          pageSize,
          dimension,
        },
      },
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
