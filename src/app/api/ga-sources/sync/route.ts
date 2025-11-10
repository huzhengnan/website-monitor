import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { createGARestClient, GACredentials } from '@/lib/services/google-analytics-rest.service';

export const runtime = 'nodejs';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function filterDomain(src: string): string | null {
  const s = src.toLowerCase();
  const exclude = new Set([
    'google','bing','baidu','yahoo','duckduckgo','qwant','sogou','360','(none)','(not set)','direct','(direct)',
    'facebook','instagram','twitter','linkedin','reddit','pinterest','youtube','t.co','fb','wechat','weibo'
  ]);
  if (!s) return null;
  if (exclude.has(s)) return null;
  // crude domain check: must contain a dot
  if (!s.includes('.')) return null;
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get('days') || '30');
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days + 1);
    const startDate = formatDate(start);
    const endDate = formatDate(end);

    // Load GA service account credentials
    let creds: GACredentials | null = null;
    const envJson = process.env.GA_CREDENTIALS;
    if (envJson) {
      creds = JSON.parse(envJson);
    } else {
      const filePath = path.join(process.cwd(), '..', 'google-cloud-acount.json');
      const raw = await fs.readFile(filePath, 'utf8');
      creds = JSON.parse(raw);
    }
    if (!creds) {
      return NextResponse.json({ success: false, error: 'Missing GA service account credentials' }, { status: 500 });
    }

    // Find active GA connectors
    const connectors = await prisma.connector.findMany({
      where: { type: 'GoogleAnalytics', status: 'active' },
      select: { id: true, siteId: true, credentials: true, site: { select: { id: true, name: true } } },
    });

    const results: Array<{ siteId: string; propertyId: string; sources: number; wroteToDate: string | null }>=[];

    for (const c of connectors) {
      try {
        const propertyId = (c.credentials as any)?.propertyId as string;
        if (!propertyId) continue;
        const client = createGARestClient(propertyId, creds as any);
        const rawSources = await client.getSessionSources(startDate, endDate);
        const domains = Array.from(new Set(rawSources.map(filterDomain).filter(Boolean) as string[]));

        // Find the latest trafficData in range, else create one at endDate
        let traffic = await prisma.trafficData.findFirst({
          where: { siteId: c.siteId, date: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') } },
          orderBy: { date: 'desc' },
          select: { id: true, date: true },
        });
        if (!traffic) {
          // create placeholder record for endDate
          traffic = await prisma.trafficData.create({
            data: {
              siteId: c.siteId,
              date: new Date(endDate + 'T00:00:00Z'),
              pv: 0, uv: 0, sessions: 0,
            },
            select: { id: true, date: true },
          });
        }

        // Replace sources for that traffic record
        await prisma.trafficSource.deleteMany({ where: { trafficId: traffic.id } });
        if (domains.length > 0) {
          await prisma.trafficSource.createMany({
            data: domains.map((d) => ({ trafficId: traffic!.id, source: d, count: 1 })),
            skipDuplicates: true,
          });
        }

        results.push({ siteId: c.siteId, propertyId, sources: domains.length, wroteToDate: traffic.date.toISOString().slice(0,10) });
      } catch (e:any) {
        results.push({ siteId: c.siteId, propertyId: (c.credentials as any)?.propertyId || 'unknown', sources: 0, wroteToDate: null });
      }
    }

    return NextResponse.json({ success: true, startDate, endDate, results });
  } catch (err:any) {
    return NextResponse.json({ success: false, error: err?.message || 'Sync failed' }, { status: 500 });
  }
}

