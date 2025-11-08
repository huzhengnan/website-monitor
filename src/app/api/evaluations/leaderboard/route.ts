import { NextRequest, NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/services/evaluations.service';
import { ApiError } from '@/lib/types';

/**
 * Get leaderboard by dimension
 * GET /api/evaluations/leaderboard?dimension=composite&page=1&pageSize=20
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dimension = (searchParams.get('dimension') as 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue') || 'composite';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // Validate parameters
    const validDimensions = ['composite', 'market', 'quality', 'seo', 'traffic', 'revenue'];
    if (!validDimensions.includes(dimension)) {
      return NextResponse.json(
        { success: false, error: 'Invalid dimension. Must be one of: composite, market, quality, seo, traffic, revenue' },
        { status: 400 }
      );
    }

    if (page < 1) {
      return NextResponse.json(
        { success: false, error: 'Page must be >= 1' },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { success: false, error: 'PageSize must be between 1 and 100' },
        { status: 400 }
      );
    }

    const result = await getLeaderboard(dimension, page, pageSize);

    return NextResponse.json(
      {
        success: true,
        data: {
          items: result.items,
          total: result.total,
          page,
          pageSize,
          totalPages: Math.ceil(result.total / pageSize),
          dimension,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Leaderboard API error:', error);
    if (error instanceof ApiError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode }
      );
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}
