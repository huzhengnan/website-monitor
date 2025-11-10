const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const sites = await prisma.backlinkSite.count();
    const submissions = await prisma.backlinkSubmission.count();
    console.log(`\n📊 数据库检查结果:`);
    console.log(`   🔗 外链站点数: ${sites}`);
    console.log(`   📝 提交记录数: ${submissions}\n`);
    
    if (sites > 0) {
      console.log('✅ 外链站点数据存在');
      const sample = await prisma.backlinkSite.findMany({ take: 3 });
      sample.forEach(s => console.log(`   - ${s.domain}`));
    } else {
      console.log('⚠️ 外链站点表为空');
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
