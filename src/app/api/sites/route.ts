import { NextRequest, NextResponse } from 'next/server';
import {
  listSites,
  getSiteById,
  getSiteSummary,
  createSite,
  updateSite,
  deleteSite,
} from '@/lib/services/sites.service';
import { CreateSiteRequest, UpdateSiteRequest, SitesListQuery, ApiError } from '@/lib/types';

/**
 * List all sites with filters
 * GET /api/sites
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query: SitesListQuery = {
      page: parseInt(searchParams.get('page') as string, 10) || 1,
      pageSize: parseInt(searchParams.get('pageSize') as string, 10) || 20,
      search: searchParams.get('search') as string | undefined,
      categoryId: searchParams.get('categoryId') as string | undefined,
      status: searchParams.get('status') as string | undefined,
      tags: searchParams.get('tags')
        ? (searchParams.get('tags') as string).split(',').filter(Boolean)
        : undefined,
      scoreMin: searchParams.get('scoreMin') ? parseInt(searchParams.get('scoreMin') as string, 10) : undefined,
      scoreMax: searchParams.get('scoreMax') ? parseInt(searchParams.get('scoreMax') as string, 10) : undefined,
    };

    const result = await listSites(query);
    return NextResponse.json(
      {
        success: true,
        data: {
          items: result.items,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Sites API GET error:', error);
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

/**
 * Create new site
 * POST /api/sites
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, domain, categoryId, status, platform, iconUrl, description, notes, tags } = body;

    // Validation
    if (!name || !domain || !categoryId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, domain, categoryId' },
        { status: 400 }
      );
    }

    const data: CreateSiteRequest = {
      name,
      domain,
      categoryId,
      status,
      platform,
      iconUrl,
      description,
      notes,
      tags,
    };

    const site = await createSite(data);
    return NextResponse.json(
      {
        success: true,
        data: site,
        message: 'Site created successfully',
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
