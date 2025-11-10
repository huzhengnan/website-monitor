const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function exportDomains() {
  try {
    const sites = await prisma.backlinkSite.findMany({
      where: {
        domain: {
          not: '',
        },
      },
      select: {
        domain: true,
      },
      orderBy: {
        domain: 'asc',
      },
    });

    const domains = sites
      .map(site => site.domain)
      .filter(domain => domain && domain.trim() !== '');

    console.log(domains.join('\n'));
  } finally {
    await prisma.$disconnect();
  }
}

exportDomains();
