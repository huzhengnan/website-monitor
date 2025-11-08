import { NextRequest, NextResponse } from 'next/server';
import {
  updateTrafficData,
  deleteTrafficData,
} from '@/lib/services/traffic.service';
import { UpdateTrafficDataRequest, ApiError } from '@/lib/types';

/**
 * Update traffic record
 * PUT /api/traffic/:id
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const data = body as UpdateTrafficDataRequest;

    const traffic = await updateTrafficData(id, data);
    return NextResponse.json(
      { success: true, data: traffic, message: 'Traffic record updated successfully' },
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
 * Delete traffic record
 * DELETE /api/traffic/:id
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await deleteTrafficData(id);
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
