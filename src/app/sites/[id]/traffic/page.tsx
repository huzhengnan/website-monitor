'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, TrendingUp, Users, Activity, BarChart3 } from 'lucide-react';
import { getSiteTrafficAnalytics, TrafficAnalytics } from '@/api/traffic';
import TrafficChart from '@/components/TrafficChart';

interface DateRange {
  startDate: string;
  endDate: string;
}

export default function TrafficPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [analytics, setAnalytics] = useState<TrafficAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
  });

  useEffect(() => {
    if (!id) return;

    const loadTrafficData = async () => {
      try {
        setLoading(true);
        const data = await getSiteTrafficAnalytics(id, {
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        });
        setAnalytics(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load traffic data');
      } finally {
        setLoading(false);
      }
    };

    loadTrafficData();
  }, [id, dateRange]);

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePrevious30Days = () => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 30);
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    });
  };

  const handleThisMonth = () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    });
  };

  const handleLastMonth = () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endDate = new Date(today.getFullYear(), today.getMonth(), 0);
    setDateRange({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    });
  };

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

  if (!analytics) {
    return (
      <div className="bg-gray-50 rounded-lg p-12 text-center">
        <p className="text-gray-600 text-lg">暂无流量数据</p>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">流量分析</h1>
          <p className="text-gray-600 mt-1">详细的网站流量数据分析</p>
        </div>
      </div>

      {/* Date Range Selector */}
      <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">开始日期</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateChange('startDate', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">结束日期</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateChange('endDate', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Quick date range buttons */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handlePrevious30Days}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            最近30天
          </button>
          <button
            onClick={handleThisMonth}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            本月
          </button>
          <button
            onClick={handleLastMonth}
            className="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
          >
            上月
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-indigo-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">总浏览量 (PV)</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analytics.totalPv.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-10 h-10 text-indigo-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">独立用户 (UV)</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analytics.totalUv.toLocaleString()}
              </p>
            </div>
            <Users className="w-10 h-10 text-green-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">会话数</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analytics.totalSessions.toLocaleString()}
              </p>
            </div>
            <Activity className="w-10 h-10 text-blue-600 opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-amber-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">平均跳出率</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {analytics.avgBounceRate.toFixed(1)}%
              </p>
            </div>
            <BarChart3 className="w-10 h-10 text-amber-600 opacity-20" />
          </div>
        </div>
      </div>

      {/* Charts and Trends */}
      <div className="space-y-6">
        {/* Daily Trend Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">日均趋势</h2>
          <TrafficChart data={analytics.dailyTrend} type="trend" />
        </div>

        {/* Top Sources and Devices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Traffic Sources */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">流量来源 TOP 10</h2>
            {analytics.topSources.length > 0 ? (
              <div className="space-y-2">
                {analytics.topSources.map((source, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{source.source}</p>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-indigo-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${(source.count / Math.max(...analytics.topSources.map((s) => s.count))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="ml-4 text-sm font-semibold text-gray-900">{source.count.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">暂无数据</p>
            )}
          </div>

          {/* Top Devices */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">设备分布 TOP 10</h2>
            {analytics.topDevices.length > 0 ? (
              <div className="space-y-2">
                {analytics.topDevices.map((device, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{device.device}</p>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${(device.count / Math.max(...analytics.topDevices.map((d) => d.count))) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="ml-4 text-sm font-semibold text-gray-900">{device.count.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-4">暂无数据</p>
            )}
          </div>
        </div>

        {/* Top Pages */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">热门页面 TOP 10</h2>
          {analytics.topPages.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">页面URL</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">PV</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">UV</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">PV/UV 比</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics.topPages.map((page, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">{page.url}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">
                        {page.pv.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">
                        {page.uv.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-right font-medium">
                        {(page.pv / Math.max(page.uv, 1)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600 text-center py-4">暂无数据</p>
          )}
        </div>
      </div>
    </div>
  );
}
