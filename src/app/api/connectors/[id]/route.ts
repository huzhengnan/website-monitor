import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  updateConnector,
  deleteConnector,
} from '@/lib/services/connector.service';
import { ApiError, NotFoundError } from '@/lib/types';

const prisma = new PrismaClient();

/**
 * GET /api/connectors/[id]
 * 获取单个连接器
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const connector = await prisma.connector.findUnique({
      where: { id },
      include: {
        site: {
          select: {
            id: true,
            name: true,
            domain: true,
          },
        },
      },
    });

    if (!connector) {
      return NextResponse.json(
        { success: false, error: 'Connector not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: connector,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get connector error:', error);
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

/**
 * PUT /api/connectors/[id]
 * 更新连接器
 * Body: { credentials?: object, status?: string }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // 验证状态值
    if (body.status && !['active', 'error', 'inactive'].includes(body.status)) {
      return NextResponse.json(
        { success: false, error: "Status must be 'active', 'error', or 'inactive'" },
        { status: 400 }
      );
    }

    const connector = await updateConnector(id, {
      credentials: body.credentials,
      status: body.status,
    });

    return NextResponse.json(
      {
        success: true,
        data: connector,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update connector error:', error);
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
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

/**
 * DELETE /api/connectors/[id]
 * 删除连接器
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await deleteConnector(id);

    return NextResponse.json(
      {
        success: true,
        message: 'Connector deleted successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete connector error:', error);
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 }
      );
    }
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
