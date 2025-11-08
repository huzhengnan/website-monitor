import { NextRequest, NextResponse } from 'next/server';
import { getSiteSummary } from '@/lib/services/sites.service';
import { ApiError } from '@/lib/types';

/**
 * Get site summary (overview)
 * GET /api/sites/:id/summary
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const summary = await getSiteSummary(id);
    return NextResponse.json(
      { success: true, data: summary },
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
