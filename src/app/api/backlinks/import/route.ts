import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseLine, upsertBacklinkSite } from '@/lib/services/backlinks.service';

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const override = url.searchParams.get('path') || undefined;
    // Default file path: ../docs/外链提交网站.txt relative to repo root
    const defaultPath = path.join(process.cwd(), '..', 'docs', '外链提交网站.txt');
    const filePath = override ? path.resolve(process.cwd(), override) : defaultPath;
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    let created = 0;
    let skipped = 0;
    let updated = 0;
    for (const line of lines) {
      const parsed = parseLine(line);
      if (!parsed) { skipped++; continue; }
      try {
        const before = await (await import('@/lib/prisma')).prisma.backlinkSite.findUnique({ where: { url: parsed.url } });
        await upsertBacklinkSite(parsed);
        if (before) updated++; else created++;
      } catch {
        skipped++;
      }
    }
    return NextResponse.json({ success: true, stats: { created, updated, skipped, total: lines.length } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Import failed' }, { status: 500 });
  }
}
