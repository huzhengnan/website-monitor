import { NextRequest, NextResponse } from 'next/server';
import {
  getSiteById,
  getSiteSummary,
  updateSite,
  deleteSite,
} from '@/lib/services/sites.service';
import { UpdateSiteRequest, ApiError } from '@/lib/types';

/**
 * Get site by ID
 * GET /api/sites/:id
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const site = await getSiteById(id);
    return NextResponse.json(
      { success: true, data: site },
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
 * Update site
 * PUT /api/sites/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, domain, categoryId, status, platform, iconUrl, description, notes, tags } = body;

    const data: UpdateSiteRequest = {
      id,
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

    const site = await updateSite(id, data);
    return NextResponse.json(
      { success: true, data: site, message: 'Site updated successfully' },
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
 * Delete site
 * DELETE /api/sites/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deleteSite(id);
    return NextResponse.json(
      { success: true, data: result },
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
