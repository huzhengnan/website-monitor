import { NextRequest, NextResponse } from 'next/server';
import { syncGoogleAnalytics, syncAllGoogleAnalytics, syncGADateRange } from '@/lib/services/ga-sync.service';
import { ApiError } from '@/lib/types';

/**
 * POST /api/connectors/sync
 * 触发指定连接器的数据同步或同步所有连接器
 * Body: { connectorId?: string, days?: number, startDate?: string, endDate?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 如果指定了日期范围，使用日期范围同步
    if (body.startDate && body.endDate) {
      if (!body.connectorId) {
        return NextResponse.json(
          { success: false, error: 'connectorId is required for date range sync' },
          { status: 400 }
        );
      }

      // 验证日期格式
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(body.startDate) || !dateRegex.test(body.endDate)) {
        return NextResponse.json(
          { success: false, error: 'Date format must be YYYY-MM-DD' },
          { status: 400 }
        );
      }

      const result = await syncGADateRange(
        body.connectorId,
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

    // 如果指定了 connectorId，同步该连接器
    if (body.connectorId) {
      const days = body.days || 7;

      if (days < 1 || days > 365) {
        return NextResponse.json(
          { success: false, error: 'Days must be between 1 and 365' },
          { status: 400 }
        );
      }

      const result = await syncGoogleAnalytics(body.connectorId, days);

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
            connectorId: body.connectorId,
            syncedDays: result.syncedDays,
            days,
          },
        },
        { status: 200 }
      );
    }

    // 如果没有指定 connectorId，同步所有 GA 连接器
    const days = body.days || 7;

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { success: false, error: 'Days must be between 1 and 365' },
        { status: 400 }
      );
    }

    const results = await syncAllGoogleAnalytics(days);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    return NextResponse.json(
      {
        success: true,
        data: {
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          results,
          days,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Sync connector error:', error);
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
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
