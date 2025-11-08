import { NextRequest, NextResponse } from 'next/server';
import {
  getSiteTraffic,
  createTrafficData,
} from '@/lib/services/traffic.service';
import { CreateTrafficDataRequest, ApiError } from '@/lib/types';

/**
 * Get traffic data for a site
 * GET /api/traffic?siteId=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const period = searchParams.get('period') as string | undefined;

    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: siteId' },
        { status: 400 }
      );
    }

    const traffic = await getSiteTraffic(siteId, { siteId });
    return NextResponse.json(
      { success: true, data: traffic },
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

/**
 * Create traffic record
 * POST /api/traffic
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, date, visitors, pageViews, bounceRate, avgSessionDuration, referrer, devices, notes } = body;

    // Validation
    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'Missing required field: siteId' },
        { status: 400 }
      );
    }

    const data = {
      siteId,
      date,
      visitors,
      pageViews,
      bounceRate,
      avgSessionDuration,
      referrer,
      devices,
      notes,
    } as unknown as CreateTrafficDataRequest;

    const traffic = await createTrafficData(data);
    return NextResponse.json(
      {
        success: true,
        data: traffic,
        message: 'Traffic record created successfully',
      },
      { status: 201 }
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
