import { PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../types';

const prisma = new PrismaClient();

export interface CreateConnectorRequest {
  siteId: string;
  type: 'GoogleAnalytics' | 'Plausible' | 'Matomo' | 'Custom';
  credentials: Record<string, any>;
}

export interface UpdateConnectorRequest {
  credentials?: Record<string, any>;
  status?: 'active' | 'error' | 'inactive';
}

/**
 * 获取站点的连接器
 */
export async function getSiteConnector(siteId: string, type?: string) {
  const where: any = { siteId };
  if (type) {
    where.type = type;
  }

  const connector = await prisma.connector.findFirst({
    where,
  });

  return connector;
}

/**
 * 获取所有连接器
 */
export async function getAllConnectors(siteId?: string) {
  const where = siteId ? { siteId } : {};

  const connectors = await prisma.connector.findMany({
    where,
    include: {
      site: {
        select: {
          id: true,
          name: true,
          domain: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return connectors;
}

/**
 * 创建连接器
 */
export async function createConnector(
  data: CreateConnectorRequest
): Promise<any> {
  // 验证站点是否存在
  const site = await prisma.site.findUnique({
    where: { id: data.siteId },
  });

  if (!site || site.deletedAt) {
    throw new NotFoundError('Site not found');
  }

  // 检查是否已有相同类型的连接器
  const existing = await prisma.connector.findFirst({
    where: {
      siteId: data.siteId,
      type: data.type,
    },
  });

  if (existing) {
    throw new ValidationError(`Connector of type ${data.type} already exists for this site`);
  }

  // 验证凭证
  if (!data.credentials || Object.keys(data.credentials).length === 0) {
    throw new ValidationError('Credentials are required');
  }

  const connector = await prisma.connector.create({
    data: {
      siteId: data.siteId,
      type: data.type,
      credentials: data.credentials,
      status: 'active',
    },
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

  return connector;
}

/**
 * 更新连接器
 */
export async function updateConnector(
  id: string,
  data: UpdateConnectorRequest
): Promise<any> {
  // 验证连接器是否存在
  const existing = await prisma.connector.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Connector not found');
  }

  const connector = await prisma.connector.update({
    where: { id },
    data: {
      credentials: data.credentials ?? undefined,
      status: data.status ?? undefined,
      updatedAt: new Date(),
    },
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

  return connector;
}

/**
 * 删除连接器
 */
export async function deleteConnector(id: string): Promise<void> {
  const connector = await prisma.connector.findUnique({
    where: { id },
  });

  if (!connector) {
    throw new NotFoundError('Connector not found');
  }

  await prisma.connector.delete({
    where: { id },
  });
}

/**
 * 更新同步状态
 */
export async function updateSyncStatus(
  id: string,
  status: 'active' | 'error' | 'inactive',
  error?: string
): Promise<void> {
  await prisma.connector.update({
    where: { id },
    data: {
      status,
      lastError: error || null,
      lastSyncAt: new Date(),
    },
  });
}

/**
 * 获取需要同步的连接器
 */
export async function getActiveSyncConnectors(type?: string) {
  const where: any = { status: 'active' };
  if (type) {
    where.type = type;
  }

  const connectors = await prisma.connector.findMany({
    where,
    include: {
      site: {
        select: {
          id: true,
          name: true,
          domain: true,
        },
      },
    },
    orderBy: {
      lastSyncAt: 'asc', // 优先同步最久未同步的
    },
  });

  return connectors;
}

/**
 * 批量创建连接器
 */
export async function createConnectorsForProperties(
  siteId: string,
  credentials: Record<string, any>,
  properties: Array<{ propertyId: string; displayName: string; websiteUrl?: string }>
): Promise<any[]> {
  // 验证站点是否存在
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!site || site.deletedAt) {
    throw new NotFoundError('Site not found');
  }

  const createdConnectors = [];

  for (const property of properties) {
    try {
      // 检查是否已有该属性的连接器
      const existing = await prisma.connector.findFirst({
        where: {
          siteId,
          type: 'GoogleAnalytics',
          credentials: {
            path: ['propertyId'],
            equals: property.propertyId,
          },
        },
      });

      if (existing) {
        console.log(`Connector already exists for property ${property.propertyId}`);
        continue;
      }

      // 为该属性创建连接器
      const connector = await prisma.connector.create({
        data: {
          siteId,
          type: 'GoogleAnalytics',
          credentials: {
            ...credentials,
            propertyId: property.propertyId,
            propertyName: property.displayName,
            propertyUrl: property.websiteUrl,
          },
          status: 'active',
        },
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

      createdConnectors.push(connector);
    } catch (error) {
      console.error(`Failed to create connector for property ${property.propertyId}:`, error);
    }
  }

  return createdConnectors;
}
