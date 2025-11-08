import { NextRequest, NextResponse } from 'next/server';
import { discoverGAProperties, validateGACredentials } from '@/lib/services/ga-rest-api.service';
import { createConnectorsForProperties } from '@/lib/services/connector.service';
import { syncGoogleAnalytics } from '@/lib/services/ga-sync.service';
import { ApiError } from '@/lib/types';

/**
 * POST /api/connectors/discover
 * 发现 Service Account 有权访问的所有 GA4 属性，并为指定站点创建连接器
 * Body: {
 *   siteId: string,
 *   credentials: object,
 *   autoSync?: boolean,
 *   days?: number
 * }
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

    if (!body.credentials) {
      return NextResponse.json(
        { success: false, error: 'credentials are required' },
        { status: 400 }
      );
    }

    // 验证凭证格式
    if (
      !body.credentials.type ||
      !body.credentials.project_id ||
      !body.credentials.private_key ||
      !body.credentials.client_email
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required credential fields',
        },
        { status: 400 }
      );
    }

    // 验证凭证有效性
    const isValid = await validateGACredentials(body.credentials);
    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid credentials or no GA properties accessible',
        },
        { status: 401 }
      );
    }

    // 发现所有属性
    const accounts = await discoverGAProperties(body.credentials);

    if (accounts.length === 0 || accounts.every((a) => a.properties.length === 0)) {
      return NextResponse.json(
        {
          success: false,
          error: 'No GA4 properties found. Make sure the service account has access to GA4 properties.',
        },
        { status: 404 }
      );
    }

    // 收集所有属性
    const allProperties = accounts.flatMap((a) => a.properties);

    // 为所有属性创建连接器
    const connectors = await createConnectorsForProperties(
      body.siteId,
      body.credentials,
      allProperties
    );

    // 如果启用自动同步，则同步所有新创建的连接器
    const syncResults: any[] = [];
    const autoSync = body.autoSync === true;
    const days = body.days || 30;

    if (autoSync && connectors.length > 0) {
      for (const connector of connectors) {
        try {
          const result = await syncGoogleAnalytics(connector.id, days);
          syncResults.push({
            connectorId: connector.id,
            propertyId: allProperties.find(
              (p) => p.propertyId === (connector.credentials as any)?.propertyId
            )?.propertyId,
            syncSuccess: result.success,
            syncedDays: result.syncedDays,
            syncError: result.error,
          });
        } catch (error) {
          syncResults.push({
            connectorId: connector.id,
            syncSuccess: false,
            syncError: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          accounts,
          totalProperties: allProperties.length,
          creatorsConnectors: connectors.length,
          connectors: connectors.map((c) => ({
            id: c.id,
            type: c.type,
            status: c.status,
            propertyId: (c.credentials as any)?.propertyId,
            propertyName: (c.credentials as any)?.propertyName,
          })),
          autoSync,
          syncResults: syncResults.length > 0 ? syncResults : undefined,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Discovery error:', error);
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
