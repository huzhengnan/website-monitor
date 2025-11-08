import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { GoogleAnalyticsRestClient } from '@/lib/services/ga-rest-api.service';

// 设置更长的超时时间 (5分钟)
export const maxDuration = 300;

interface ImportRequest {
  credentials: {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
  };
  syncDays?: number;
}

interface ImportResult {
  success: boolean;
  data?: {
    importedSites: Array<{
      id: string;
      name: string;
      domain: string;
      propertyId: string;
    }>;
    totalImported: number;
    syncResults: Array<{
      siteId: string;
      propertyId: string;
      syncSuccess: boolean;
      syncedDays?: number;
      error?: string;
    }>;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ImportResult>> {
  try {
    const body: ImportRequest = await request.json();

    // 验证凭证
    if (
      !body.credentials.type ||
      !body.credentials.project_id ||
      !body.credentials.private_key ||
      !body.credentials.client_email
    ) {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必填的 Service Account 字段',
        },
        { status: 400 }
      );
    }

    const syncDays = body.syncDays || 30;
    const gaClient = new GoogleAnalyticsRestClient(body.credentials);

    // 获取所有 GA4 属性
    console.log('[GA Import] 正在发现 GA4 属性...');
    const properties = await gaClient.discoverProperties();

    if (!properties || properties.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: '未找到任何 GA4 属性',
        },
        { status: 400 }
      );
    }

    console.log(`[GA Import] 发现 ${properties.length} 个属性`);

    const importedSites: Array<{
      id: string;
      name: string;
      domain: string;
      propertyId: string;
    }> = [];
    const syncResults: Array<{
      siteId: string;
      propertyId: string;
      syncSuccess: boolean;
      syncedDays?: number;
      error?: string;
    }> = [];

    // properties 是 GAAccount[]，需要遍历账户和属性
    for (const account of properties) {
      console.log(`[GA Import] 处理账户: ${account.displayName} (${account.accountId})`);

      // 为该账户下的每个属性创建站点
      if (!account.properties || account.properties.length === 0) {
        console.log(`[GA Import] 账户 ${account.displayName} 没有属性`);
        continue;
      }

      for (const property of account.properties) {
        try {
          const siteId = randomUUID();

          // 确定域名的优先级：
          // 1. websiteUrl（GA4 配置中的网站 URL）
          // 2. displayName（通常就是实际的域名或网站名称）
          // 3. 生成一个基于 propertyId 的唯一域名
          let domain = property.websiteUrl;
          let siteName = property.displayName || `Property ${property.propertyId}`;

          if (!domain) {
            // 如果 displayName 看起来像域名，就用它作为 domain
            if (siteName && siteName.includes('.') && !siteName.includes(' ')) {
              domain = siteName;
            } else {
              // 否则生成一个基于 propertyId 的唯一域名
              domain = `ga-${property.propertyId}.local`;
            }
          }

          console.log(`[GA Import] 创建站点: ${siteName} (UUID: ${siteId})`);

          // 检查域名是否已经存在（只查找未删除的站点）
          const existingSite = await prisma.site.findFirst({
            where: {
              domain: domain,
              deletedAt: null,
            },
          });

          let siteForSync = null;

          if (existingSite) {
            console.log(`[GA Import] 站点已存在: ${siteName} (域名: ${domain})，将同步数据`);
            importedSites.push({
              id: existingSite.id,
              name: existingSite.name,
              domain: existingSite.domain,
              propertyId: property.propertyId,
            });
            siteForSync = existingSite;
            // 不要 continue，继续向下执行同步逻辑
          } else {
            // 检查是否有已删除的站点，如果有就恢复
            const deletedSite = await prisma.site.findFirst({
              where: {
                domain: domain,
                deletedAt: { not: null },
              },
            });

            if (deletedSite) {
              console.log(`[GA Import] 站点已被删除，正在恢复并更新: ${siteName} (UUID: ${deletedSite.id})`);
              const recoveredSite = await prisma.site.update({
                where: { id: deletedSite.id },
                data: {
                  name: siteName,
                  domain: domain,
                  status: 'online',
                  deletedAt: null,
                },
              });
              importedSites.push({
                id: recoveredSite.id,
                name: recoveredSite.name,
                domain: recoveredSite.domain,
                propertyId: property.propertyId,
              });
              siteForSync = recoveredSite;
              // 继续同步已恢复站点的数据，不使用 continue
            } else {
              // 创建站点
              const site = await prisma.site.create({
                data: {
                  id: siteId,
                  name: siteName,
                  domain: domain,
                  status: 'online',
                },
              });

              console.log(`[GA Import] 站点已创建: ${site.id}`);

              importedSites.push({
                id: site.id,
                name: site.name,
                domain: site.domain,
                propertyId: property.propertyId,
              });

              // 创建连接器
              console.log(`[GA Import] 创建 GA4 连接器...`);
              await prisma.connector.create({
                data: {
                  id: randomUUID(),
                  siteId: siteId,
                  type: 'GoogleAnalytics',
                  credentials: {
                    propertyId: property.propertyId,
                    propertyName: property.displayName,
                    accountId: account.accountId,
                    accountName: account.displayName,
                  },
                  status: 'active',
                },
              });

              console.log(`[GA Import] 连接器已创建`);
              siteForSync = site;
            }
          }

          // 同步数据（对所有站点：已存在的、已恢复的、新建的）
          try {
            console.log(`[GA Import] 正在同步 ${syncDays} 天的数据...`);

            // 计算日期范围
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - syncDays);

            // 格式化日期为 YYYY-MM-DD
            const formatDate = (date: Date) => date.toISOString().split('T')[0];
            const startDateStr = formatDate(startDate);
            const endDateStr = formatDate(endDate);

            console.log(`[GA Import] 获取 ${property.propertyId} 的数据，日期范围: ${startDateStr} 到 ${endDateStr}`);

            // 获取每日数据
            const dailyMetricsData = await gaClient.getDailyMetrics(property.propertyId, startDateStr, endDateStr);

            console.log(`[GA Import] 获取到 ${dailyMetricsData.length} 天的指标数据`);

            // 显示前几天的数据样本用于调试
            if (dailyMetricsData.length > 0) {
              console.log('[GA Import] 首日数据样本:', JSON.stringify(dailyMetricsData[0], null, 2));
            }

            // 为每一天更新或创建记录（使用 upsert 策略：如果数据已存在则更新，否则创建新数据）
            // 这样可以保留站点列表中其他来源的数据，同时更新 GA 数据
            if (dailyMetricsData.length > 0) {
              await Promise.all(
                dailyMetricsData.map((dayData) =>
                  prisma.trafficData.upsert({
                    where: {
                      siteId_date: {
                        siteId: siteForSync.id,
                        date: new Date(dayData.date + 'T00:00:00Z'),
                      },
                    },
                    update: {
                      pv: dayData.screenPageViews || 0,
                      sessions: dayData.sessions || 0,
                      uv: dayData.newUsers || 0,  // ✅ 修复：UV应该是新用户数
                      activeUsers: dayData.activeUsers || 0,
                      newUsers: dayData.newUsers || 0,
                      events: dayData.events || 0,  // ✅ 这个是从GA的keyEvents映射过来的
                      bounceRate: dayData.bounceRate ? parseFloat(dayData.bounceRate.toString()) : 0,
                      engagementRate: dayData.engagementRate ? parseFloat(dayData.engagementRate.toString()) : null,
                      engagedSessions: dayData.engagedSessions || null,
                      averageSessionDuration: dayData.sessionDuration ? parseFloat(dayData.sessionDuration.toString()) : null,
                      metricsData: dayData.metricsData || {},
                    },
                    create: {
                      id: randomUUID(),
                      siteId: siteForSync.id,
                      date: new Date(dayData.date + 'T00:00:00Z'),
                      pv: dayData.screenPageViews || 0,
                      sessions: dayData.sessions || 0,
                      uv: dayData.newUsers || 0,  // ✅ 修复：UV应该是新用户数
                      activeUsers: dayData.activeUsers || 0,
                      newUsers: dayData.newUsers || 0,
                      events: dayData.events || 0,  // ✅ 这个是从GA的keyEvents映射过来的
                      bounceRate: dayData.bounceRate ? parseFloat(dayData.bounceRate.toString()) : 0,
                      engagementRate: dayData.engagementRate ? parseFloat(dayData.engagementRate.toString()) : null,
                      engagedSessions: dayData.engagedSessions || null,
                      averageSessionDuration: dayData.sessionDuration ? parseFloat(dayData.sessionDuration.toString()) : null,
                      metricsData: dayData.metricsData || {},
                    },
                  })
                )
              );
            }

            syncResults.push({
              siteId: siteForSync.id,
              propertyId: property.propertyId,
              syncSuccess: true,
              syncedDays: syncDays,
            });

            console.log(`[GA Import] 数据同步成功: 已创建 ${dailyMetricsData.length} 条日数据记录`);
          } catch (syncError) {
            console.error(`[GA Import] 数据同步失败: ${syncError}`);
            syncResults.push({
              siteId: siteForSync!.id,
              propertyId: property.propertyId,
              syncSuccess: false,
              error: syncError instanceof Error ? syncError.message : '同步失败',
            });
          }
        } catch (propertyError) {
          console.error(`[GA Import] 属性导入失败: ${propertyError}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        importedSites,
        totalImported: importedSites.length,
        syncResults,
      },
    });
  } catch (error) {
    console.error('[GA Import] 导入失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '导入失败',
      },
      { status: 500 }
    );
  }
}
