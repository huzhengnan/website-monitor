import { NextRequest, NextResponse } from 'next/server';
import { getSearchConsoleRestService } from '@/lib/services/google-search-console-rest.service';

export async function GET(request: NextRequest) {
  try {
    const domain = request.nextUrl.searchParams.get('domain');
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    if (!domain || !startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          error: 'domain, startDate, and endDate are required',
        },
        { status: 400 }
      );
    }

    console.log('[Search Console API] Request:', { domain, startDate, endDate });

    const service = getSearchConsoleRestService();
    const siteUrl = domain.startsWith('http') ? domain : `https://${domain}`;

    console.log('[Search Console API] Attempting to fetch data from GSC REST service...');
    const data = await service.getSearchDataSummary(siteUrl, startDate, endDate);

    console.log('[Search Console API] Response:', {
      totalClicks: data.totalClicks,
      totalImpressions: data.totalImpressions,
      queriesCount: data.topQueries.length,
      pagesCount: data.topPages.length,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('[Search Console API] Error:', {
      message: error.message,
      status: error.status,
      response: error.response?.data,
    });

    // 检查是否是权限错误
    if (error.message?.includes('does not have sufficient permission') || error.status === 403) {
      return NextResponse.json(
        {
          success: false,
          error: 'Service Account does not have permission for this site. Please verify permissions in Google Search Console.',
          code: 'PERMISSION_DENIED',
          details: {
            message: error.message,
          },
        },
        { status: 403 }
      );
    }

    // 检查是否是验证错误
    if (error.message?.includes('not verified')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Website not verified in Google Search Console. Please verify the website first.',
          code: 'SITE_NOT_VERIFIED',
        },
        { status: 403 }
      );
    }

    // 检查是否是初始化错误
    if (error.message?.includes('not initialized')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Google Search Console service not initialized. Please configure credentials.',
          code: 'SERVICE_NOT_INITIALIZED',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch search console data',
      },
      { status: 500 }
    );
  }
}
