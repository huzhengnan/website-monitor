#!/usr/bin/env node
// Import backlink sites from ../docs/外链提交网站.txt into database

const fs = require('node:fs');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function extractDomain(rawUrl) {
  try {
    const normalized = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    const u = new URL(normalized);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return rawUrl;
  }
}

function parseDR(note) {
  if (!note) return null;
  const m = note.match(/dr\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || /^(导航站链接|#)/.test(trimmed)) return null;
  const parts = trimmed.split('\t');
  const url = (parts[0] || '').trim();
  const note = (parts[1] || '').trim();
  if (!url) return null;
  const dr = parseDR(note);
  return { url, note, dr };
}

async function main() {
  // Ensure schema/table exists without using prisma db push (avoid data loss)
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS website_manager;`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS website_manager.backlink_sites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      url VARCHAR(500) NOT NULL UNIQUE,
      domain VARCHAR(255) NOT NULL,
      dr DECIMAL(6,2),
      note TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_backlink_domain ON website_manager.backlink_sites(domain);`);

  const filePath = path.join(process.cwd(), '..', 'docs', '外链提交网站.txt');
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  let created = 0, skipped = 0;
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) { skipped++; continue; }
    const domain = extractDomain(parsed.url);
    await prisma.backlinkSite.upsert({
      where: { url: parsed.url },
      create: { url: parsed.url, domain, note: parsed.note, dr: parsed.dr },
      update: { domain, note: parsed.note, dr: parsed.dr },
    });
    created++;
  }
  console.log('Import finished:', { created, skipped, total: lines.length });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
