'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, Globe, TrendingUp, Award, Users, Activity, ExternalLink } from 'lucide-react';
import { listSites, Site } from '@/api/sites';
import client from '@/api/client';

interface Stats {
  totalSites: number;
  activeSites: number;
  totalPvToday: number;
  totalUvToday: number;
  totalEventsToday: number;
  totalPvYesterday: number;
  totalUvYesterday: number;
  totalEventsYesterday: number;
}

// Calculate percentage change and format display
function getChangeDisplay(today: number, yesterday: number) {
  if (yesterday === 0) {
    return { percentage: 0, isPositive: true, display: '新增' };
  }
  const percentage = ((today - yesterday) / yesterday) * 100;
  const isPositive = percentage >= 0;
  const displayValue = Math.abs(percentage).toFixed(1);
  return {
    percentage,
    isPositive,
    display: `${isPositive ? '+' : '-'}${displayValue}%`,
  };
}

// Format metric value - show exact number if < 1000, otherwise show K
function formatMetricValue(value: number): string {
  if (value < 1000) {
    return value.toString();
  }
  return (value / 1000).toFixed(1) + 'K';
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSites, setRecentSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await listSites({ page: 1, pageSize: 100 });
        const sites = response.data.items || [];
        const total = response.data.total || 0;

        // Get the first 5 recent sites (most recently created)
        const recentItems = sites.slice(0, 5);
        setRecentSites(recentItems);

        // Calculate today and yesterday dates
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const todayStr = today.toISOString().split('T')[0];
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Calculate stats for today and yesterday
        let totalPvToday = 0;
        let totalUvToday = 0;
        let totalEventsToday = 0;
        let totalPvYesterday = 0;
        let totalUvYesterday = 0;
        let totalEventsYesterday = 0;

        for (const site of sites) {
          try {
            // Get today's data
            const todayResponse = await client.get(`/sites/${site.id}/traffic`, {
              params: {
                startDate: todayStr,
                endDate: todayStr,
              },
            });
            const todayData = (todayResponse as any).data;
            totalPvToday += todayData?.totalPv || 0;
            totalUvToday += todayData?.totalUv || 0;
            totalEventsToday += todayData?.totalEvents || 0;

            // Get yesterday's data
            const yesterdayResponse = await client.get(`/sites/${site.id}/traffic`, {
              params: {
                startDate: yesterdayStr,
                endDate: yesterdayStr,
              },
            });
            const yesterdayData = (yesterdayResponse as any).data;
            totalPvYesterday += yesterdayData?.totalPv || 0;
            totalUvYesterday += yesterdayData?.totalUv || 0;
            totalEventsYesterday += yesterdayData?.totalEvents || 0;
          } catch (err) {
            // Skip if traffic data fails to load
          }
        }

        setStats({
          totalSites: total,
          activeSites: sites.filter((s: any) => s.status === 'online').length,
          totalPvToday,
          totalUvToday,
          totalEventsToday,
          totalPvYesterday,
          totalUvYesterday,
          totalEventsYesterday,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-semibold">加载失败</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">网站管理平台</h1>
        <p className="text-gray-600 mt-2">统一管理你的网站数据，流量与评分一览无余</p>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 flex-wrap">
        <Link
          href="/sites/new"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
        >
          + 添加站点
        </Link>
        <Link
          href="/sites"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-50 transition"
        >
          查看所有站点
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sites */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">站点总数</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalSites || 0}</p>
            </div>
            <Globe className="w-10 h-10 text-indigo-600 opacity-20" />
          </div>
        </div>

        {/* Active Sites */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">活跃站点</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.activeSites || 0}</p>
            </div>
            <Activity className="w-10 h-10 text-green-600 opacity-20" />
          </div>
        </div>

        {/* Today PV */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">今日PV</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatMetricValue(stats?.totalPvToday || 0)}
              </p>
              <p className={`text-sm mt-1 font-medium ${getChangeDisplay(stats?.totalPvToday || 0, stats?.totalPvYesterday || 0).isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {getChangeDisplay(stats?.totalPvToday || 0, stats?.totalPvYesterday || 0).display}
              </p>
            </div>
            <BarChart3 className="w-10 h-10 text-blue-600 opacity-20" />
          </div>
        </div>

        {/* Today New Users (replacing UV) */}
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">新用户数</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {formatMetricValue(stats?.totalUvToday || 0)}
              </p>
              <p className={`text-sm mt-1 font-medium ${getChangeDisplay(stats?.totalUvToday || 0, stats?.totalUvYesterday || 0).isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {getChangeDisplay(stats?.totalUvToday || 0, stats?.totalUvYesterday || 0).display}
              </p>
            </div>
            <Users className="w-10 h-10 text-purple-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Recent Sites */}
      {recentSites.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">最近添加的站点</h3>
            <Link href="/sites" className="text-indigo-600 hover:text-indigo-700 text-sm font-medium">
              查看全部 →
            </Link>
          </div>
          <div className="space-y-2">
            {recentSites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div>
                    <p className="font-medium text-gray-900">{site.name}</p>
                    <p className="text-sm text-gray-600">{site.domain}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      site.status === 'online'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {site.status === 'online' ? '在线' : '离线'}
                  </span>
                  <Link href={`/sites/${site.id}`} className="text-gray-400 hover:text-indigo-600">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">流量分析</h3>
          <p className="text-gray-600 text-sm">
            实时追踪网站流量，支持 PV、UV、来源、设备等多维度分析
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-4">⭐</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">五维评价</h3>
          <p className="text-gray-600 text-sm">
            市场、质量、SEO、流量、收益五个维度全面评估网站表现
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-4">🏆</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">智能排行</h3>
          <p className="text-gray-600 text-sm">
            多维度排行榜，帮助你对比网站表现，发现优化机会
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">快速开始</h3>
        <div className="space-y-3">
          <p className="text-gray-600">
            <span className="font-semibold">1. 添加站点</span> - 点击上方按钮，输入站点信息
          </p>
          <p className="text-gray-600">
            <span className="font-semibold">2. 录入数据</span> - 手动录入或连接第三方数据源
          </p>
          <p className="text-gray-600">
            <span className="font-semibold">3. 评估评分</span> - 填写五维评价，获取综合评分
          </p>
          <p className="text-gray-600">
            <span className="font-semibold">4. 生成报告</span> - 查看排行榜和趋势报告
          </p>
        </div>
      </div>
    </div>
  );
}
