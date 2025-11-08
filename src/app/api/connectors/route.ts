import { NextRequest, NextResponse } from 'next/server';
import {
  getAllConnectors,
  createConnector,
  getSiteConnector,
} from '@/lib/services/connector.service';
import { ApiError } from '@/lib/types';

/**
 * GET /api/connectors?siteId=xxx
 * 获取连接器列表
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');

    const connectors = await getAllConnectors(siteId || undefined);

    return NextResponse.json(
      {
        success: true,
        data: {
          items: connectors,
          total: connectors.length,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get connectors error:', error);
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
 * POST /api/connectors
 * 创建新连接器
 * Body: { siteId: string, type: string, credentials: object }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.siteId) {
      return NextResponse.json(
        { success: false, error: 'siteId is required' },
        { status: 400 }
      );
    }

    if (!body.type) {
      return NextResponse.json(
        { success: false, error: 'type is required' },
        { status: 400 }
      );
    }

    if (!body.credentials) {
      return NextResponse.json(
        { success: false, error: 'credentials are required' },
        { status: 400 }
      );
    }

    // 检查是否为有效的类型
    const validTypes = ['GoogleAnalytics', 'Plausible', 'Matomo', 'Custom'];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid connector type. Must be one of: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const connector = await createConnector({
      siteId: body.siteId,
      type: body.type,
      credentials: body.credentials,
    });

    return NextResponse.json(
      {
        success: true,
        data: connector,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create connector error:', error);
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
