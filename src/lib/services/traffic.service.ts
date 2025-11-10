import { prisma } from '@/lib/prisma';
import {
  TrafficData,
  TrafficSource,
  TrafficDevice,
  TrafficPage,
  CreateTrafficDataRequest,
  UpdateTrafficDataRequest,
  TrafficQuery,
  TrafficAnalytics,
  NotFoundError,
  ValidationError,
} from '../types';


/**
 * Get traffic data for a specific site with date range filtering
 */
export async function getSiteTraffic(
  siteId: string,
  query: TrafficQuery
): Promise<TrafficData[]> {
  const { startDate, endDate } = query;

  const where: any = {
    siteId,
  };

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
  }

  const traffic = await prisma.trafficData.findMany({
    where,
    include: {
      sources: true,
      devices: true,
      pages: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  return traffic as unknown as TrafficData[];
}

/**
 * Get traffic data by ID
 */
export async function getTrafficById(id: string): Promise<TrafficData> {
  const traffic = await prisma.trafficData.findUnique({
    where: { id },
    include: {
      sources: true,
      devices: true,
      pages: true,
      site: {
        select: {
          id: true,
          name: true,
          domain: true,
        },
      },
    },
  });

  if (!traffic) {
    throw new NotFoundError('Traffic data not found');
  }

  return traffic as unknown as TrafficData;
}

/**
 * Get traffic data by site and date
 */
export async function getTrafficData(siteId: string, date: string): Promise<any> {
  const traffic = await prisma.trafficData.findFirst({
    where: {
      siteId,
      date: new Date(date),
    },
    include: {
      sources: true,
      devices: true,
      pages: true,
    },
  });

  return traffic;
}

/**
 * Create traffic data for a site
 */
export async function createTrafficData(
  data: CreateTrafficDataRequest | any
): Promise<TrafficData> {
  const { siteId, date, pv, uv, sessions, bounceRate, avgTimeOnPage, sources, devices, pages, key } = data;

  // Verify site exists
  const site = await prisma.site.findUnique({
    where: { id: siteId },
  });

  if (!site) {
    throw new NotFoundError('Site not found');
  }

  // Check if traffic data already exists for this site and date
  const dateStr = typeof date === 'string' ? date : new Date(date).toISOString().split('T')[0];
  const existing = await prisma.trafficData.findFirst({
    where: {
      siteId,
      date: new Date(dateStr),
    },
  });

  if (existing) {
    throw new ValidationError('Traffic data already exists for this date');
  }

  // Create traffic data with related records
  const trafficData = await prisma.trafficData.create({
    data: {
      siteId,
      date: new Date(dateStr),
      pv,
      uv,
      sessions,
      bounceRate: bounceRate || null,
      key: key || null,
      sources: sources && Array.isArray(sources) && sources.length > 0
        ? {
            create: sources.map((s: any) => ({
              source: s.source,
              sessions: s.sessions || s.count,
              pageviews: s.pageviews || s.pv,
              bounceRate: s.bounceRate || 0,
            })),
          }
        : undefined,
      devices: devices && Array.isArray(devices) && devices.length > 0
        ? {
            create: devices.map((d: any) => ({
              device: d.device,
              sessions: d.sessions || d.count,
              pageviews: d.pageviews || d.pv,
              bounceRate: d.bounceRate || 0,
            })),
          }
        : undefined,
      pages: pages && Array.isArray(pages) && pages.length > 0
        ? {
            create: pages.map((p: any) => ({
              url: p.url,
              title: p.title || null,
              pageviews: p.pageviews || p.pv,
              users: p.users || p.uv,
              bounceRate: p.bounceRate || 0,
            })),
          }
        : undefined,
    },
    include: {
      sources: true,
      devices: true,
      pages: true,
    },
  });

  return trafficData as unknown as TrafficData;
}

/**
 * Update traffic data
 */
export async function updateTrafficData(
  id: string,
  data: UpdateTrafficDataRequest | any
): Promise<TrafficData> {
  // Verify traffic data exists
  const existing = await prisma.trafficData.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError('Traffic data not found');
  }

  const { pv, uv, sessions, bounceRate, avgTimeOnPage, sources, devices, pages } = data;

  // Start transaction for complex update
  const result = await prisma.$transaction(async (tx: any) => {
    // Update main traffic data
    const updated = await tx.trafficData.update({
      where: { id },
      data: {
        pv: pv ?? undefined,
        uv: uv ?? undefined,
        sessions: sessions ?? undefined,
        bounceRate: bounceRate !== undefined ? bounceRate : undefined,
      },
    });

    // Update sources if provided
    if (sources) {
      // Delete existing sources
      await tx.trafficSource.deleteMany({
        where: { trafficDataId: id },
      });
      // Create new sources
      if (sources.length > 0) {
        await tx.trafficSource.createMany({
          data: sources.map((s: any) => ({
            trafficDataId: id,
            source: s.source,
            sessions: s.sessions || s.count,
            pageviews: s.pageviews || s.pv,
            bounceRate: s.bounceRate || 0,
          })),
        });
      }
    }

    // Update devices if provided
    if (devices) {
      await tx.trafficDevice.deleteMany({
        where: { trafficDataId: id },
      });
      if (devices.length > 0) {
        await tx.trafficDevice.createMany({
          data: devices.map((d: any) => ({
            trafficDataId: id,
            device: d.device,
            sessions: d.sessions || d.count,
            pageviews: d.pageviews || d.pv,
            bounceRate: d.bounceRate || 0,
          })),
        });
      }
    }

    // Update pages if provided
    if (pages) {
      await tx.trafficPage.deleteMany({
        where: { trafficDataId: id },
      });
      if (pages.length > 0) {
        await tx.trafficPage.createMany({
          data: pages.map((p: any) => ({
            trafficDataId: id,
            url: p.url,
            title: p.title || null,
            pageviews: p.pageviews || p.pv,
            users: p.users || p.uv,
            bounceRate: p.bounceRate || 0,
          })),
        });
      }
    }

    // Return updated traffic data with relations
    return tx.trafficData.findUnique({
      where: { id },
      include: {
        sources: true,
        devices: true,
        pages: true,
      },
    });
  });

  return result as unknown as TrafficData;
}

/**
 * Delete traffic data (soft delete)
 */
export async function deleteTrafficData(id: string): Promise<void> {
  const traffic = await prisma.trafficData.findUnique({
    where: { id },
  });

  if (!traffic) {
    throw new NotFoundError('Traffic data not found');
  }

  await prisma.trafficData.update({
    where: { id },
    data: {
    },
  });
}

/**
 * Get traffic analytics for global or site-specific data
 */
export async function getTrafficAnalytics(
  query: TrafficQuery & { siteId?: string }
): Promise<TrafficAnalytics> {
  const { startDate, endDate, siteId } = query;

  const where: any = {
  };

  if (siteId) {
    where.siteId = siteId;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) {
      where.date.gte = new Date(startDate);
    }
    if (endDate) {
      where.date.lte = new Date(endDate);
    }
  }

  // Get all traffic data in range
  const trafficData = await prisma.trafficData.findMany({
    where,
    include: {
      sources: true,
      devices: true,
      pages: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  if (trafficData.length === 0) {
    return {
      totalPv: 0,
      totalUv: 0,
      totalSessions: 0,
      avgBounceRate: 0,
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
      topSources: [],
      topDevices: [],
      topPages: [],
      dailyTrend: [],
    };
  }

  // Calculate totals
  const totalPv = trafficData.reduce((sum: number, t: any) => sum + t.pv, 0);
  const totalUv = trafficData.reduce((sum: number, t: any) => sum + t.uv, 0);
  const totalSessions = trafficData.reduce((sum: number, t: any) => sum + t.sessions, 0);

  // Calculate average bounce rate (only from records that have it)
  const bounceRates = trafficData
    .filter((t: any) => t.bounceRate !== null)
    .map((t: any) => t.bounceRate as number);
  const avgBounceRate =
    bounceRates.length > 0
      ? bounceRates.reduce((sum: number, rate: number) => sum + rate, 0) / bounceRates.length
      : 0;

  // Aggregate sources
  const sourcesMap = new Map<string, number>();
  trafficData.forEach((t: any) => {
    t.sources.forEach((s: any) => {
      const current = sourcesMap.get(s.source) || 0;
      sourcesMap.set(s.source, current + s.count);
    });
  });
  const topSources = Array.from(sourcesMap.entries())
    .map(([source, count]: any) => ({ source, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  // Aggregate devices
  const devicesMap = new Map<string, number>();
  trafficData.forEach((t: any) => {
    t.devices.forEach((d: any) => {
      const current = devicesMap.get(d.device) || 0;
      devicesMap.set(d.device, current + d.count);
    });
  });
  const topDevices = Array.from(devicesMap.entries())
    .map(([device, count]: any) => ({ device, count }))
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 10);

  // Aggregate pages
  const pagesMap = new Map<string, { pv: number; uv: number }>();
  trafficData.forEach((t: any) => {
    t.pages.forEach((p: any) => {
      const current = pagesMap.get(p.url) || { pv: 0, uv: 0 };
      pagesMap.set(p.url, {
        pv: current.pv + p.pv,
        uv: current.uv + p.uv,
      });
    });
  });
  const topPages = Array.from(pagesMap.entries())
    .map(([url, data]: any) => ({ url, pv: data.pv, uv: data.uv }))
    .sort((a: any, b: any) => b.pv - a.pv)
    .slice(0, 10);

  // Build daily trend
  const dailyTrend = trafficData.map((t: any) => ({
    date: t.date.toISOString().split('T')[0],
    pv: t.pv,
    uv: t.uv,
    sessions: t.sessions,
    bounceRate: t.bounceRate || 0,
  }));

  return {
    totalPv,
    totalUv,
    totalSessions,
    avgBounceRate: Math.round(avgBounceRate * 100) / 100,
    dateRange: {
      start: startDate || trafficData[0].date.toISOString().split('T')[0],
      end:
        endDate || trafficData[trafficData.length - 1].date.toISOString().split('T')[0],
    },
    topSources,
    topDevices,
    topPages,
    dailyTrend,
  };
}
