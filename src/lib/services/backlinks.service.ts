import { prisma } from '@/lib/prisma';

export interface BacklinkSiteInput {
  url: string;
  note?: string;
  dr?: number | null;
}

export async function listBacklinkSites(params?: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  sortField?: 'domain' | 'url' | 'dr' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}) {
  const page = Math.max(1, params?.page || 1);
  const pageSize = Math.min(100, Math.max(1, params?.pageSize || 20));
  const where: any = {};
  if (params?.keyword) {
    const k = params.keyword;
    where.OR = [
      { domain: { contains: k, mode: 'insensitive' } },
      { url: { contains: k, mode: 'insensitive' } },
      { note: { contains: k, mode: 'insensitive' } },
    ];
  }
  const total = await prisma.backlinkSite.count({ where });
  const orderBy: any = {};
  const field = params?.sortField || 'createdAt';
  const order = params?.sortOrder || 'desc';
  orderBy[field] = order;
  const items = await prisma.backlinkSite.findMany({
    where,
    orderBy,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { total, items, page, pageSize };
}

export function extractDomain(rawUrl: string): string {
  try {
    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const u = new URL(normalized);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

export async function upsertBacklinkSite(input: BacklinkSiteInput) {
  const domain = extractDomain(input.url);
  const drVal = input.dr == null || Number.isNaN(Number(input.dr)) ? null : Number(input.dr);
  return prisma.backlinkSite.upsert({
    where: { url: input.url },
    create: { url: input.url, domain, note: input.note, dr: drVal as any },
    update: { domain, note: input.note, dr: drVal as any },
  });
}

export function parseDR(note?: string | null): number | null {
  if (!note) return null;
  const m = note.match(/dr\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function parseLine(line: string): { url: string; note?: string; dr?: number | null } | null {
  // Expect tab separated: URL\t备注
  const trimmed = line.trim();
  if (!trimmed || /^(导航站链接|#)/.test(trimmed)) return null;
  const parts = trimmed.split('\t');
  const url = parts[0]?.trim();
  const note = (parts[1] || '').trim();
  if (!url || url.startsWith('http') === false && !/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(url)) {
    return null;
  }
  const dr = parseDR(note);
  return { url, note, dr };
}
