'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Globe, Calendar, Search } from 'lucide-react';
import { getSiteById, Site } from '@/api/sites';

export default function SiteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchData, setSearchData] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const loadSite = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const response = await getSiteById(id);
        setSite(response.data || response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load site');
      } finally {
        setLoading(false);
      }
    };

    loadSite();
  }, [id]);

  // Load search console data
  useEffect(() => {
    const loadSearchData = async () => {
      if (!site?.domain) return;
      try {
        setSearchLoading(true);
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 30); // Last 30 days

        const response = await fetch(
          `/api/search-console?domain=${encodeURIComponent(site.domain)}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
        );

        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setSearchData(result.data);
          }
        }
      } catch (err) {
        console.error('Failed to load search console data:', err);
      } finally {
        setSearchLoading(false);
      }
    };

    loadSearchData();
  }, [site?.domain]);

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

  if (!site) {
    return (
      <div className="bg-gray-50 rounded-lg p-12 text-center">
        <p className="text-gray-600 text-lg">站点不存在</p>
      </div>
    );
  }

  const createdDate = new Date(site.createdAt).toLocaleDateString('zh-CN');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{site.name}</h1>
          <p className="text-gray-600 mt-1">{site.domain}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">基本信息</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-600">站点名称</label>
                <p className="text-gray-900 mt-1">{site.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">网址</label>
                <a
                  href={site.domain}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-700 mt-1 flex items-center gap-2"
                >
                  {site.domain}
                  <Globe className="w-4 h-4" />
                </a>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">分类</label>
                  <p className="text-gray-900 mt-1">{site.category?.name || '未分类'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">状态</label>
                  <div className="mt-1">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        site.status === 'online'
                          ? 'bg-green-100 text-green-800'
                          : site.status === 'maintenance'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {site.status === 'online'
                        ? '在线'
                        : site.status === 'maintenance'
                          ? '维护中'
                          : '离线'}
                    </span>
                  </div>
                </div>
              </div>
              {site.description && (
                <div>
                  <label className="text-sm font-medium text-gray-600">描述</label>
                  <p className="text-gray-900 mt-1">{site.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Search Console Data */}
          {searchLoading ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">搜索流量</h2>
              </div>
              <div className="text-gray-600">加载中...</div>
            </div>
          ) : searchData ? (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <Search className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">搜索流量</h2>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg">
                  <div className="text-sm text-blue-600 font-medium">点击次数</div>
                  <div className="text-3xl font-bold text-blue-900 mt-2">
                    {searchData.totalClicks?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg">
                  <div className="text-sm text-purple-600 font-medium">展现次数</div>
                  <div className="text-3xl font-bold text-purple-900 mt-2">
                    {searchData.totalImpressions?.toLocaleString() || 0}
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg">
                  <div className="text-sm text-amber-600 font-medium">点击率</div>
                  <div className="text-3xl font-bold text-amber-900 mt-2">
                    {searchData.avgCtr?.toFixed(2) || 0}%
                  </div>
                </div>
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg">
                  <div className="text-sm text-emerald-600 font-medium">平均排名</div>
                  <div className="text-3xl font-bold text-emerald-900 mt-2">
                    {searchData.avgPosition?.toFixed(1) || 0}
                  </div>
                </div>
              </div>

              {/* Top Queries */}
              {searchData.topQueries && searchData.topQueries.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">热门搜索词</h3>
                  <div className="space-y-2">
                    {searchData.topQueries.slice(0, 5).map((query: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{query.query}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            点击: {query.clicks} | 展现: {query.impressions} | 排名: {query.position?.toFixed(1)}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-blue-600 ml-2">{query.ctr?.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Pages */}
              {searchData.topPages && searchData.topPages.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">热门页面</h3>
                  <div className="space-y-2">
                    {searchData.topPages.slice(0, 5).map((page: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{page.page}</div>
                          <div className="text-xs text-gray-600 mt-1">
                            点击: {page.clicks} | 展现: {page.impressions}
                          </div>
                        </div>
                        <div className="text-sm font-semibold text-purple-600 ml-2">{page.ctr?.toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Tags */}
          {site.tags && site.tags.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">标签</h2>
              <div className="flex flex-wrap gap-2">
                {site.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium"
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href={`/sites/${site.id}/traffic`}
                className="p-3 bg-white rounded-lg border border-gray-200 text-center hover:bg-gray-50 transition"
              >
                <div className="text-sm font-semibold text-gray-900">查看流量</div>
                <div className="text-xs text-gray-600">流量分析</div>
              </Link>
              <Link
                href={`/sites/${site.id}/evaluations`}
                className="p-3 bg-white rounded-lg border border-gray-200 text-center hover:bg-gray-50 transition"
              >
                <div className="text-sm font-semibold text-gray-900">五维评价</div>
                <div className="text-xs text-gray-600">评分记录</div>
              </Link>
              <Link
                href={`/sites/${site.id}/edit`}
                className="p-3 bg-white rounded-lg border border-gray-200 text-center hover:bg-gray-50 transition"
              >
                <div className="text-sm font-semibold text-gray-900">编辑信息</div>
                <div className="text-xs text-gray-600">修改设置</div>
              </Link>
              <button className="p-3 bg-white rounded-lg border border-gray-200 text-center hover:bg-gray-50 transition">
                <div className="text-sm font-semibold text-gray-900">生成报告</div>
                <div className="text-xs text-gray-600">导出数据</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Stats */}
        <div className="space-y-6">
          {/* Creation Info */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-sm font-medium">创建时间</span>
            </div>
            <p className="text-gray-900 font-semibold">{createdDate}</p>
          </div>

          {/* Placeholder Stats */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-4">站点统计</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">最近7天PV</div>
                <div className="text-2xl font-bold text-gray-900">-</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">平均评分</div>
                <div className="text-2xl font-bold text-gray-900">-</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">评价次数</div>
                <div className="text-2xl font-bold text-gray-900">0</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
