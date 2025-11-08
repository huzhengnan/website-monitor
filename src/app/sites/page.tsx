'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { listSites, Site, deleteSite } from '@/api/sites';
import client from '@/api/client';
import SitesTable from '@/components/SitesTable';

export default function SitesPage() {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [trafficData, setTrafficData] = useState<Record<string, any>>({});
  const [loadingTraffic, setLoadingTraffic] = useState<Record<string, boolean>>({});
  const [selectedDays, setSelectedDays] = useState<1 | 2 | 7 | 30>(7);
  const [gscData, setGscData] = useState<Record<string, any>>({});
  const [loadingGsc, setLoadingGsc] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadSites = async () => {
      try {
        console.log(`[Sites Page] useEffect triggered with page=${page}, pageSize=${pageSize}, selectedDays=${selectedDays}`);
        setLoading(true);
        const response = await listSites({ page, pageSize });
        setSites(response.data.items);
        setTotal(response.data.total);

        // 用一个接口加载所有站点的指标数据
        console.log(`[Sites Page] Loading all metrics for ${response.data.items.length} sites with selectedDays=${selectedDays}`);
        loadAllMetrics(page, pageSize, selectedDays);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sites');
      } finally {
        setLoading(false);
      }
    };

    loadSites();
  }, [page, pageSize, selectedDays]);

  const loadAllMetrics = useCallback(async (page: number, pageSize: number, days: number) => {
    try {
      console.log(`[Batch Metrics] Loading metrics for page ${page}, pageSize ${pageSize}, days=${days}`);

      // 一个接口返回所有站点的流量和GSC数据
      const response = await client.get(`/sites/metrics`, {
        params: {
          page,
          pageSize,
          days,
        },
      });

      const data = (response as any).data;

      console.log(`[Batch Metrics] Loaded metrics for all sites:`, {
        siteCount: Object.keys(data?.metrics || {}).length,
        dateRange: data?.dateRange,
      });

      // 处理所有站点的数据
      const newTrafficData: Record<string, any> = {};
      const newGscData: Record<string, any> = {};

      for (const [siteId, metrics] of Object.entries(data?.metrics || {})) {
        const siteMetrics = metrics as any;
        if (siteMetrics?.traffic) {
          newTrafficData[siteId] = siteMetrics.traffic;
        }
        if (siteMetrics?.gsc) {
          newGscData[siteId] = siteMetrics.gsc;
        }
      }

      setTrafficData(newTrafficData);
      setGscData(newGscData);
    } catch (err) {
      console.error(`Failed to load batch metrics:`, err);
      // 设置空数据而不是让组件卡在加载状态
      setTrafficData({});
      setGscData({});
    }
  }, []);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (confirm(`确认删除站点 "${name}" 吗？`)) {
      try {
        await deleteSite(id);
        setSites(prevSites => prevSites.filter((s) => s.id !== id));
        setTotal(prevTotal => prevTotal - 1);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete site');
      }
    }
  }, []);

  const handleBatchDelete = useCallback(async () => {
    if (selectedIds.size === 0) {
      alert('请先选择要删除的站点');
      return;
    }

    if (!confirm(`确认删除 ${selectedIds.size} 个站点吗？此操作不可恢复`)) {
      return;
    }

    try {
      setDeleting(true);
      const idsToDelete = Array.from(selectedIds);

      for (const id of idsToDelete) {
        await deleteSite(id);
      }

      setSites(prevSites => prevSites.filter((s) => !selectedIds.has(s.id)));
      setTotal(prevTotal => prevTotal - idsToDelete.length);
      setSelectedIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleting(false);
    }
  }, [selectedIds]);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sites.map((s) => s.id)));
    }
  }, [selectedIds, sites]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  // 按活跃用户数倒序排列站点（和 GA 后台一致）- 使用 useMemo 避免每次都重新排序
  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => {
      const activeUsersA = trafficData[a.id]?.totalActiveUsers || 0;
      const activeUsersB = trafficData[b.id]?.totalActiveUsers || 0;
      return activeUsersB - activeUsersA;
    });
  }, [sites, trafficData]);

  // 缩短 UUID 显示：显示前 5 + ... + 后 5
  const formatUuid = useCallback((uuid: string) => {
    if (uuid.length <= 10) return uuid;
    return `${uuid.slice(0, 5)}...${uuid.slice(-5)}`;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">我的站点</h1>
          <p className="text-gray-600 mt-1">管理和查看所有网站</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">时间范围：</label>
            <select
              value={selectedDays}
              onChange={(e) => {
                const newDays = parseInt(e.target.value) as 1 | 2 | 7 | 30;
                console.log('[Sites Page] Changing selectedDays from', selectedDays, 'to', newDays);
                console.log('[Sites Page] Clearing all data states before update');
                setSelectedDays(newDays);
                setTrafficData({});
                setGscData({});
                setLoadingTraffic({});
                setLoadingGsc({});
                console.log('[Sites Page] Data states cleared, waiting for useEffect to refetch...');
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:border-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer transition"
            >
              <option value={1}>今天</option>
              <option value={2}>昨天</option>
              <option value={7}>最近 7 天</option>
              <option value={30}>最近 30 天</option>
            </select>
          </div>
          <Link
            href="/sites/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4" />
            新增站点
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-600">加载中...</div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">加载失败</p>
          <p className="text-sm">{error}</p>
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <p className="text-gray-600 text-lg">还没有站点，点击上方按钮添加吧</p>
        </div>
      ) : (
        <>
          {/* Batch Actions */}
          {selectedIds.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-blue-900 font-semibold">
                  已选中 {selectedIds.size} 个站点
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  取消选择
                </button>
                <button
                  onClick={handleBatchDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {deleting ? '删除中...' : '批量删除'}
                </button>
              </div>
            </div>
          )}

          {/* Sites Table using TanStack Table */}
          <SitesTable
            sites={sortedSites}
            trafficData={trafficData}
            gscData={gscData}
            loadingTraffic={loadingTraffic}
            loadingGsc={loadingGsc}
            selectedIds={selectedIds}
            copiedId={copiedId}
            onSelectAll={toggleSelectAll}
            onSelect={toggleSelect}
            onDelete={handleDelete}
            setCopiedId={setCopiedId}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <span className="text-gray-600 text-sm">
                第 {page} / {totalPages} 页
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
