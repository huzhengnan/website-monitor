import { prisma } from '@/lib/prisma';
import { CreateSiteRequest, UpdateSiteRequest, SitesListQuery, NotFoundError } from '@/lib/types';
import { validatePagination } from '@/lib/utils/validators';

/**
 * Get all sites with filters, search, and pagination
 */
export async function listSites(query: SitesListQuery) {
  const { page, pageSize } = validatePagination(query.page, query.pageSize);

  const where: any = {
    deletedAt: null,
  };

  // Filter by category
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  // Filter by status
  if (query.status) {
    where.status = query.status;
  }

  // Filter by score range
  let siteIds: string[] | undefined;
  if (query.scoreMin !== undefined || query.scoreMax !== undefined) {
    const scoreWhere: any = {};
    if (query.scoreMin !== undefined) {
      scoreWhere.overallScore = { gte: Number(query.scoreMin) };
    }
    if (query.scoreMax !== undefined) {
      scoreWhere.overallScore = {
        ...scoreWhere.overallScore,
        lte: Number(query.scoreMax),
      };
    }

    const evaluations = await prisma.evaluation.findMany({
      where: scoreWhere,
      distinct: ['siteId'],
      select: { siteId: true },
    });
    siteIds = evaluations.map((e: any) => e.siteId);
  }

  if (siteIds && siteIds.length > 0) {
    where.id = { in: siteIds };
  } else if (query.scoreMin !== undefined || query.scoreMax !== undefined) {
    // If score filter is applied but no sites found, return empty
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Search by name or domain
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { domain: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  // Filter by tags
  if (query.tags && query.tags.length > 0) {
    const sitesWithTags = await prisma.siteTag.findMany({
      where: {
        tag: {
          name: {
            in: query.tags,
          },
        },
      },
      select: { siteId: true },
    });
    const tagSiteIds = sitesWithTags.map((st: any) => st.siteId);
    where.id = {
      in: tagSiteIds,
    };
  }

  // Get total count
  const total = await prisma.site.count({ where });

  // Get sites with relations
  const items = await prisma.site.findMany({
    where,
    include: {
      category: true,
      siteTags: {
        include: {
          tag: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items: items.map(formatSiteResponse),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get site by ID with all details
 */
export async function getSiteById(id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      category: true,
      siteTags: {
        include: {
          tag: true,
        },
      },
      traffic: {
        orderBy: { date: 'desc' },
        take: 10,
      },
      evaluations: {
        orderBy: { date: 'desc' },
        take: 5,
      },
    },
  });

  if (!site) {
    throw new NotFoundError(`Site with ID ${id} not found`);
  }

  return formatSiteResponse(site);
}

/**
 * Get site summary (overview stats)
 */
export async function getSiteSummary(id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      traffic: {
        where: {
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
      evaluations: {
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
  });

  if (!site) {
    throw new NotFoundError(`Site with ID ${id} not found`);
  }

  const pv7d = site.traffic
    .filter((t: any) => t.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((sum: number, t: any) => sum + t.pv, 0);

  const uv7d = site.traffic
    .filter((t: any) => t.date >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .reduce((sum: number, t: any) => sum + t.uv, 0);

  const avgBounceRate = site.traffic.length > 0
    ? site.traffic.reduce((sum: number, t: any) => sum + (t.bounceRate || 0), 0) / site.traffic.length
    : 0;

  return {
    id: site.id,
    name: site.name,
    domain: site.domain,
    status: site.status,
    pv7d,
    uv7d,
    avgBounceRate: Math.round(avgBounceRate * 100) / 100,
    latestScore: site.evaluations[0]?.overallScore || null,
    latestEvalDate: site.evaluations[0]?.date || null,
    createdAt: site.createdAt,
  };
}

/**
 * Create new site
 */
export async function createSite(data: CreateSiteRequest) {
  // Create site
  const site = await prisma.site.create({
    data: {
      name: data.name,
      domain: data.domain,
      categoryId: data.categoryId,
      status: data.status || 'online',
      platform: data.platform,
      iconUrl: data.iconUrl,
      description: data.description,
      notes: data.notes,
    },
    include: {
      category: true,
    },
  });

  // Add tags if provided
  if (data.tags && data.tags.length > 0) {
    for (const tagName of data.tags) {
      let tag = await prisma.tag.findUnique({
        where: { name: tagName },
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: { name: tagName },
        });
      }

      await prisma.siteTag.create({
        data: {
          siteId: site.id,
          tagId: tag.id,
        },
      });
    }
  }

  return formatSiteResponse({
    ...site,
    siteTags: [],
  });
}

/**
 * Update site
 */
export async function updateSite(id: string, data: UpdateSiteRequest) {
  const site = await prisma.site.update({
    where: { id },
    data: {
      name: data.name,
      domain: data.domain,
      categoryId: data.categoryId,
      status: data.status,
      platform: data.platform,
      iconUrl: data.iconUrl,
      description: data.description,
      notes: data.notes,
    },
    include: {
      category: true,
      siteTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  // Update tags if provided
  if (data.tags) {
    // Remove old tags
    await prisma.siteTag.deleteMany({
      where: { siteId: id },
    });

    // Add new tags
    for (const tagName of data.tags) {
      let tag = await prisma.tag.findUnique({
        where: { name: tagName },
      });

      if (!tag) {
        tag = await prisma.tag.create({
          data: { name: tagName },
        });
      }

      await prisma.siteTag.create({
        data: {
          siteId: id,
          tagId: tag.id,
        },
      });
    }
  }

  return formatSiteResponse(site);
}

/**
 * Delete site (soft delete)
 */
export async function deleteSite(id: string) {
  const site = await prisma.site.findUnique({
    where: { id },
  });

  if (!site) {
    throw new NotFoundError(`Site with ID ${id} not found`);
  }

  await prisma.site.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });

  return { success: true, message: 'Site deleted successfully' };
}

/**
 * Format site response
 */
function formatSiteResponse(site: any) {
  return {
    id: site.id,
    name: site.name,
    domain: site.domain,
    categoryId: site.categoryId,
    category: site.category || null,
    status: site.status,
    platform: site.platform,
    iconUrl: site.iconUrl,
    description: site.description,
    notes: site.notes,
    tags: (site.siteTags || []).map((st: any) => ({
      id: st.tag.id,
      name: st.tag.name,
      color: st.tag.color,
    })),
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
}
