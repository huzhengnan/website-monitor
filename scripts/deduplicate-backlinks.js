#!/usr/bin/env node
/**
 * 外链库重复检测和合并工具
 *
 * 功能：
 * - 检测重复的外链网站（基于域名）
 * - 合并重复记录
 * - 保留更新时间最近的记录
 *
 * 使用：
 * node scripts/deduplicate-backlinks.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔍 开始检测外链库中的重复记录...\n');

  try {
    // 获取所有外链网站
    const allSites = await prisma.backlinkSite.findMany({
      include: {
        backlinkSubmissions: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📊 总共找到 ${allSites.length} 个外链网站\n`);

    // 按域名分组
    const sitesByDomain = {};
    allSites.forEach((site) => {
      const domain = site.domain.toLowerCase().trim();
      if (!sitesByDomain[domain]) {
        sitesByDomain[domain] = [];
      }
      sitesByDomain[domain].push(site);
    });

    // 找出重复的域名
    const duplicates = Object.entries(sitesByDomain)
      .filter(([_, sites]) => sites.length > 1)
      .map(([domain, sites]) => ({
        domain,
        count: sites.length,
        sites: sites.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
      }));

    if (duplicates.length === 0) {
      console.log('✅ 没有发现重复的外链网站！');
      return;
    }

    console.log(`⚠️  发现 ${duplicates.length} 个重复的域名\n`);

    let totalMerged = 0;
    let totalDeleted = 0;

    // 处理每个重复的域名
    for (const { domain, count, sites } of duplicates) {
      console.log(`\n🔗 域名: ${domain} (${count} 条记录)`);
      console.log('='.repeat(60));

      const keepSite = sites[0]; // 保留最新的
      const deleteSites = sites.slice(1); // 删除其他的

      console.log(`✅ 保留: ${keepSite.url} (更新于 ${keepSite.updatedAt})`);

      for (const deleteSite of deleteSites) {
        console.log(`❌ 删除: ${deleteSite.url}`);

        // 如果要删除的记录有提交历史，转移到保留的记录
        if (deleteSite.backlinkSubmissions.length > 0) {
          console.log(
            `   ↳ 转移 ${deleteSite.backlinkSubmissions.length} 条提交记录`
          );

          // 更新提交记录指向保留的网站
          await prisma.backlinkSubmission.updateMany({
            where: { backlinkSiteId: deleteSite.id },
            data: { backlinkSiteId: keepSite.id },
          });

          totalMerged += deleteSite.backlinkSubmissions.length;
        }

        // 删除重复的记录
        await prisma.backlinkSite.delete({
          where: { id: deleteSite.id },
        });

        totalDeleted++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`\n✨ 合并完成！`);
    console.log(`   📦 删除了 ${totalDeleted} 条重复记录`);
    console.log(`   🔗 转移了 ${totalMerged} 条提交记录`);
    console.log(`   ✅ 保留了 ${allSites.length - totalDeleted} 条唯一记录\n`);

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
