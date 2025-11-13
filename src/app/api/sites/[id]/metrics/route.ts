import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * Calculate date range based on days parameter
 */
function getDateRange(days: number): { startDate: string; endDate: string } {
  const formatDate = (d: Date) => d.toISOString().split('T')[0];

  if (days === 1) {
    // 今天
    const today = new Date();
    const dateStr = formatDate(today);
    return { startDate: dateStr, endDate: dateStr };
  } else if (days === 2) {
    // 昨天
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = formatDate(yesterday);
    return { startDate: dateStr, endDate: dateStr };
  } else {
    // 最近7天或30天（不包括昨天和今天，等待数据完整）
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 2); // 截至前天（数据更完整）

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days - 1); // 往前推N+1天（因为endDate已经往前推2天）

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const daysParam = searchParams.get('days');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // 支持两种调用方式：
    // 1. ?days=7 - 自动计算日期范围
    // 2. ?startDate=2025-10-27&endDate=2025-11-02 - 指定日期范围
    let startDate: string;
    let endDate: string;

    if (daysParam) {
      const days = parseInt(daysParam);
      const dateRange = getDateRange(days);
      startDate = dateRange.startDate;
      endDate = dateRange.endDate;
    } else if (startDateParam && endDateParam) {
      startDate = startDateParam;
      endDate = endDateParam;
    } else {
      return NextResponse.json(
        { success: false, error: 'Either days or both startDate and endDate are required' },
        { status: 400 }
      );
    }

    console.log(`[Metrics API] Fetching metrics for site ${id}, range: ${startDate} to ${endDate}`);

    // Verify site exists
    const site = await prisma.site.findUnique({
      where: { id },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 }
      );
    }

    // Parse date strings
    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59Z');

    // Fetch traffic data, GSC data, and backlink submissions in parallel
    const [trafficData, gscData, backlinkSubmissions] = await Promise.all([
      prisma.trafficData.findMany({
        where: {
          siteId: id,
          date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: {
          date: 'asc',
        },
      }),
      prisma.searchConsoleData.findMany({
        where: {
          siteId: id,
          date: {
            gte: start,
            lte: end,
          },
        },
        orderBy: {
          date: 'asc',
        },
      }),
      prisma.backlinkSubmission.findMany({
        where: {
          siteId: id,
          status: {
            in: ['submitted', 'indexed'], // 只统计已提交和已收录的外链
          },
        },
      }),
    ]);

    console.log(`[Metrics API] Traffic records: ${trafficData.length}, GSC records: ${gscData.length}, Backlinks: ${backlinkSubmissions.length}`);

    // Calculate backlink stats
    const totalBacklinks = backlinkSubmissions.length;
    const indexedBacklinks = backlinkSubmissions.filter(b => b.status === 'indexed').length;

    // Calculate traffic totals
    const totalPv = trafficData.reduce((sum, item) => sum + item.pv, 0);
    const totalUv = trafficData.reduce((sum, item) => sum + item.uv, 0);
    const totalSessions = trafficData.reduce((sum, item) => sum + item.sessions, 0);
    const totalActiveUsers = trafficData.reduce((sum, item) => sum + item.activeUsers, 0);
    const totalNewUsers = trafficData.reduce((sum, item) => sum + item.newUsers, 0);
    const totalEvents = trafficData.reduce((sum, item) => sum + item.events, 0);
    const avgBounceRate = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.bounceRate?.toNumber() || 0), 0) / trafficData.length
      : 0;
    const avgSessionDuration = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.averageSessionDuration?.toNumber() || 0), 0) /
        trafficData.length
      : 0;
    const conversionRate = trafficData.length > 0
      ? trafficData.reduce((sum, item) => sum + (item.conversionRate?.toNumber() || 0), 0) /
        trafficData.length
      : 0;

    // Calculate GSC totals
    const totalClicks = gscData.reduce((sum, record) => sum + record.totalClicks, 0);
    const totalImpressions = gscData.reduce((sum, record) => sum + record.totalImpressions, 0);
    const avgCtr =
      gscData.length > 0
        ? gscData.reduce((sum, record) => sum + (Number(record.avgCtr) || 0), 0) / gscData.length
        : 0;
    const avgPosition =
      gscData.length > 0
        ? gscData.reduce((sum, record) => sum + (Number(record.avgPosition) || 0), 0) / gscData.length
        : 0;

    const latestEvaluation = await prisma.evaluation.findFirst({
      where: { siteId: id },
      orderBy: { date: 'desc' },
      select: {
        siteId: true,
        date: true,
        marketScore: true,
        qualityScore: true,
        seoScore: true,
        trafficScore: true,
        revenueScore: true,
        overallScore: true,
        reasons: true,
        suggestions: true,
      },
    });

    const norm = (v: number, max: number) => Math.max(0, Math.min(100, (v / max) * 100));
    const inv = (v: number) => Math.max(0, Math.min(100, 100 - v));
    const posScore = Math.max(0, Math.min(100, 100 - ((avgPosition / 100) * 100)));

    const autoTrafficScore = Math.round(
      norm(totalPv, 1_000_000) * 0.35 +
      norm(totalSessions, 500_000) * 0.25 +
      norm(totalActiveUsers, 500_000) * 0.2 +
      norm(avgSessionDuration, 300) * 0.2
    );

    const autoQualityScore = Math.round(
      norm(avgSessionDuration, 300) * 0.5 +
      inv(Math.min(100, avgBounceRate)) * 0.5
    );

    const autoSeoScore = Math.round(
      norm(totalClicks, 50_000) * 0.3 +
      norm(totalImpressions, 2_000_000) * 0.15 +
      Math.max(0, Math.min(100, avgCtr)) * 0.15 +
      posScore * 0.2 +
      norm(totalBacklinks, 100) * 0.15 +
      norm(indexedBacklinks, 50) * 0.05
    );

    const autoMarketScore = Math.round(
      norm(totalNewUsers, 100_000) * 0.6 +
      norm(totalEvents, 1_000_000) * 0.4
    );

    const autoRevenueScore = Math.round(
      Math.max(0, Math.min(100, conversionRate))
    );

    const autoComposite = Math.round(
      (autoTrafficScore + autoQualityScore + autoSeoScore + autoMarketScore + autoRevenueScore) / 5
    );

    // 生成评分原因和建议
    const generateReasons = () => {
      const reasons: any = {};

      // 质量评分原因（基于时长和跳出率）
      if (avgSessionDuration < 60) {
        reasons.quality = `用户平均停留时长较短(${avgSessionDuration.toFixed(0)}秒)，跳出率${(avgBounceRate * 100).toFixed(1)}%`;
      } else if (avgSessionDuration < 180) {
        reasons.quality = `用户停留时长适中(${(avgSessionDuration / 60).toFixed(1)}分钟)，跳出率${(avgBounceRate * 100).toFixed(1)}%`;
      } else {
        reasons.quality = `用户停留时长较长(${(avgSessionDuration / 60).toFixed(1)}分钟)，互动质量高，跳出率${(avgBounceRate * 100).toFixed(1)}%`;
      }

      // 流量评分原因
      if (totalPv < 1000) {
        reasons.traffic = `页面浏览量较低(${totalPv}次)，会话数${totalSessions}次，活跃用户${totalActiveUsers}人`;
      } else if (totalPv < 100000) {
        reasons.traffic = `页面浏览量适中(${totalPv}次)，会话数${totalSessions}次，流量稳定`;
      } else {
        reasons.traffic = `页面浏览量较高(${totalPv}次)，会话数${totalSessions}次，流量表现优秀`;
      }

      // SEO评分原因
      if (totalClicks < 100) {
        reasons.seo = `搜索点击量较低(${totalClicks}次)，曝光量${totalImpressions}次，外链${totalBacklinks}个(已收录${indexedBacklinks}个)，平均排名${avgPosition.toFixed(1)}`;
      } else if (totalClicks < 10000) {
        reasons.seo = `搜索点击量适中(${totalClicks}次)，曝光量${totalImpressions}次，外链${totalBacklinks}个(已收录${indexedBacklinks}个)，CTR ${avgCtr.toFixed(2)}%`;
      } else {
        reasons.seo = `搜索点击量较高(${totalClicks}次)，曝光量${totalImpressions}次，外链${totalBacklinks}个(已收录${indexedBacklinks}个)，SEO表现良好`;
      }

      // 市场评分原因
      if (totalNewUsers < 100) {
        reasons.market = `新用户增长较慢(${totalNewUsers}人)，事件数${totalEvents}次`;
      } else if (totalNewUsers < 10000) {
        reasons.market = `新用户增长稳定(${totalNewUsers}人)，事件数${totalEvents}次，市场表现正常`;
      } else {
        reasons.market = `新用户增长迅速(${totalNewUsers}人)，事件数${totalEvents}次，市场表现优秀`;
      }

      // 营收评分原因
      if (conversionRate < 1) {
        reasons.revenue = `转化率较低(${conversionRate.toFixed(2)}%)，需要优化转化漏斗`;
      } else if (conversionRate < 5) {
        reasons.revenue = `转化率适中(${conversionRate.toFixed(2)}%)，有提升空间`;
      } else {
        reasons.revenue = `转化率较高(${conversionRate.toFixed(2)}%)，营收表现良好`;
      }

      return reasons;
    };

    const generateSuggestions = () => {
      const suggestions: any = {};

      // 质量建议
      if (avgSessionDuration < 60) {
        suggestions.quality = '建议优化内容质量和页面体验，增加互动元素，降低跳出率';
      } else if (avgBounceRate > 0.7) {
        suggestions.quality = '跳出率较高，建议优化首页内容，增加内部链接';
      } else {
        suggestions.quality = '继续保持内容质量，关注用户反馈，持续优化体验';
      }

      // 流量建议
      if (totalPv < 1000) {
        suggestions.traffic = '建议增加内容更新频率，加强SEO优化，拓展流量渠道';
      } else if (totalSessions < totalUv * 1.5) {
        suggestions.traffic = '用户回访率较低，建议增加内容深度，提高用户粘性';
      } else {
        suggestions.traffic = '流量表现良好，建议继续优化用户体验，保持增长势头';
      }

      // SEO建议
      if (totalBacklinks === 0) {
        suggestions.seo = '尚无外链，建议开始提交外链到目录站和导航站，提升网站权重';
      } else if (totalBacklinks > 0 && indexedBacklinks === 0) {
        suggestions.seo = '外链尚未被收录，建议提高外链质量，选择权重更高的平台';
      } else if (indexedBacklinks < totalBacklinks * 0.5) {
        suggestions.seo = `外链收录率较低(${Math.round(indexedBacklinks/totalBacklinks*100)}%)，建议提高外链质量，选择权重更高的平台`;
      } else if (totalBacklinks < 10) {
        suggestions.seo = `已有${totalBacklinks}个外链，建议继续增加外链提交，提升网站权重`;
      } else if (totalClicks < 100) {
        suggestions.seo = '搜索点击量较低，建议优化关键词策略和外链质量，提升页面SEO评分';
      } else if (avgPosition > 20) {
        suggestions.seo = '搜索排名较低，建议优化标题和描述，继续增加高质量外链';
      } else if (avgCtr < 5) {
        suggestions.seo = `CTR较低(${avgCtr.toFixed(2)}%)，建议优化搜索结果片段，使标题和描述更吸引人`;
      } else {
        suggestions.seo = `外链表现良好(${totalBacklinks}个外链，${indexedBacklinks}个已收录)，建议持续优化长尾关键词`;
      }

      // 市场建议
      if (totalNewUsers < 100) {
        suggestions.market = '建议加强市场推广，增加社交媒体曝光，拓展新用户渠道';
      } else if (totalEvents < totalSessions * 2) {
        suggestions.market = '用户互动较少，建议增加互动功能，提升用户参与度';
      } else {
        suggestions.market = '市场表现良好，建议分析用户画像，精准定位目标用户';
      }

      // 营收建议
      if (conversionRate < 1) {
        suggestions.revenue = '建议优化转化漏斗，增加CTA按钮，简化转化流程';
      } else if (conversionRate < 5) {
        suggestions.revenue = '建议A/B测试不同转化方案，优化落地页设计';
      } else {
        suggestions.revenue = '转化率良好，建议提升客单价，优化产品组合';
      }

      return suggestions;
    };

    const autoReasons = generateReasons();
    const autoSuggestions = generateSuggestions();

    // Prepare daily data for charts (merged traffic and GSC)
    const dailyDataMap = new Map<string, any>();

    // Add traffic data
    trafficData.forEach((item) => {
      const dateStr = item.date.toISOString().split('T')[0];
      dailyDataMap.set(dateStr, {
        date: dateStr,
        traffic: {
          pv: item.pv,
          uv: item.uv,
          sessions: item.sessions,
          activeUsers: item.activeUsers,
          newUsers: item.newUsers,
          events: item.events,
          bounceRate: item.bounceRate?.toNumber() || 0,
          sessionDuration: item.averageSessionDuration?.toNumber() || 0,
          conversionRate: item.conversionRate?.toNumber() || 0,
        },
      });
    });

    // Add GSC data
    gscData.forEach((item) => {
      const dateStr = item.date.toISOString().split('T')[0];
      const existing = dailyDataMap.get(dateStr) || { date: dateStr };
      existing.gsc = {
        clicks: item.totalClicks,
        impressions: item.totalImpressions,
        ctr: item.avgCtr || 0,
        position: item.avgPosition || 0,
      };
      dailyDataMap.set(dateStr, existing);
    });

    const dailyData = Array.from(dailyDataMap.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      success: true,
      data: {
        dateRange: {
          startDate,
          endDate,
        },
        traffic: {
          totalPv,
          totalUv,
          totalSessions,
          totalActiveUsers,
          totalNewUsers,
          totalEvents,
          avgBounceRate: parseFloat(avgBounceRate.toFixed(2)),
          avgSessionDuration: parseFloat(avgSessionDuration.toFixed(2)),
          conversionRate: parseFloat(conversionRate.toFixed(2)),
          recordCount: trafficData.length,
        },
        gsc: {
          totalClicks,
          totalImpressions,
          avgCtr: parseFloat(avgCtr.toFixed(2)),
          avgPosition: parseFloat(avgPosition.toFixed(2)),
          recordCount: gscData.length,
        },
        evaluation: latestEvaluation
          ? {
              market: latestEvaluation.marketScore ?? null,
              quality: latestEvaluation.qualityScore ?? null,
              seo: latestEvaluation.seoScore ?? null,
              traffic: latestEvaluation.trafficScore ?? null,
              revenue: latestEvaluation.revenueScore ?? null,
              composite: latestEvaluation.overallScore ? Number(latestEvaluation.overallScore) : null,
              date: latestEvaluation.date,
              reasons: latestEvaluation.reasons ?? null,
              suggestions: latestEvaluation.suggestions ?? null,
            }
          : {
              market: autoMarketScore,
              quality: autoQualityScore,
              seo: autoSeoScore,
              traffic: autoTrafficScore,
              revenue: autoRevenueScore,
              composite: autoComposite,
              date: null,
              reasons: autoReasons,
              suggestions: autoSuggestions,
            },
        dailyData,
      },
    });
  } catch (error: any) {
    console.error('[Metrics API] Error:', {
      message: error.message,
      stack: error.stack,
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch metrics',
      },
      { status: 500 }
    );
  }
}
