import { NextRequest, NextResponse } from 'next/server';
import { syncGSCDataForSite, syncAllGSCData } from '@/lib/services/gsc-sync.service';

/**
 * POST /api/connectors/gsc-sync
 * Sync GSC data for a specific site or all sites
 * Body: {
 *   siteId?: string,
 *   domain?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   days?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('[GSC Sync API] Request:', body);

    // If specific site with date range is provided
    if (body.siteId && body.domain && body.startDate && body.endDate) {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.startDate) || !dateRegex.test(body.endDate)) {
        return NextResponse.json(
          { success: false, error: 'Date format must be YYYY-MM-DD' },
          { status: 400 }
        );
      }

      const result = await syncGSCDataForSite(
        body.siteId,
        body.domain,
        body.startDate,
        body.endDate
      );

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.error,
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            syncedDays: result.syncedDays,
            dateRange: {
              start: body.startDate,
              end: body.endDate,
            },
          },
        },
        { status: 200 }
      );
    }

    // If no specific site, sync all sites
    const days = body.days || 90;

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { success: false, error: 'Days must be between 1 and 365' },
        { status: 400 }
      );
    }

    const result = await syncAllGSCData(days);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          totalSyncedDays: result.totalSyncedDays,
          days,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[GSC Sync API] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync GSC data',
      },
      { status: 500 }
    );
  }
}
