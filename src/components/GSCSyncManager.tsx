'use client';

import { useState, useEffect } from 'react';

interface Site {
  id: string;
  name: string;
  domain: string;
}

interface SyncResult {
  siteId: string;
  domain: string;
  success: boolean;
  clicks?: number;
  impressions?: number;
  error?: string;
  message?: string;
}

interface SyncResponse {
  success: boolean;
  data?: {
    total: number;
    successful: number;
    failed: number;
    dateRange: { startDate: string; endDate: string };
    results: SyncResult[];
  };
  error?: string;
}

type TimeRange = '1' | '2' | '7' | '30';
type SyncMode = 'all' | 'single';

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '1': '今天',
  '2': '昨天',
  '7': '最近7天',
  '30': '最近30天',
};

export function GSCSyncManager() {
  const [syncMode, setSyncMode] = useState<SyncMode>('all');
  const [selectedDays, setSelectedDays] = useState<TimeRange>('30');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [loadingSites, setLoadingSites] = useState(true);
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // 加载站点列表
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const response = await fetch('/api/sites?pageSize=100');
        const data = await response.json();
        const sitesList = data.data?.items || [];
        console.log('[GSCSyncManager] Fetched sites:', sitesList);
        setSites(sitesList);
        if (sitesList && sitesList.length > 0) {
          setSelectedSiteId(sitesList[0].id);
        }
      } catch (error) {
        console.error('[GSCSyncManager] Failed to fetch sites:', error);
      } finally {
        setLoadingSites(false);
      }
    };

    fetchSites();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    setShowResults(false);

    try {
      const payload: any = {
        days: useCustomDateRange ? undefined : parseInt(selectedDays),
      };

      // 添加自定义日期范围或站点ID
      if (useCustomDateRange) {
        if (!customStartDate || !customEndDate) {
          throw new Error('Please specify both start and end dates');
        }
        payload.startDate = customStartDate;
        payload.endDate = customEndDate;
      }

      if (syncMode === 'single') {
        if (!selectedSiteId) {
          throw new Error('Please select a site');
        }
        payload.siteId = selectedSiteId;
      }

      console.log('[GSCSyncManager] Starting sync with payload:', payload);

      const response = await fetch('/api/gsc-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data: SyncResponse = await response.json();
      setSyncResult(data);
      setShowResults(true);

      if (data.success) {
        console.log('[GSCSyncManager] Sync completed successfully', data.data);
      } else {
        console.error('[GSCSyncManager] Sync failed:', data.error);
      }
    } catch (error) {
      console.error('[GSCSyncManager] Error during sync:', error);
      setSyncResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      });
      setShowResults(true);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* 同步模式选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          选择同步模式
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setSyncMode('all')}
            disabled={isSyncing}
            className={`px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${
              syncMode === 'all'
                ? 'border-green-600 bg-green-50 text-green-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            同步所有站点
          </button>
          <button
            onClick={() => setSyncMode('single')}
            disabled={isSyncing}
            className={`px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${
              syncMode === 'single'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            同步单个站点
          </button>
        </div>
      </div>

      {/* 单个站点选择 */}
      {syncMode === 'single' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            选择要同步的站点
          </label>
          {loadingSites ? (
            <div className="text-sm text-gray-600">加载站点列表中...</div>
          ) : sites.length === 0 ? (
            <div className="text-sm text-red-600">未找到任何站点</div>
          ) : (
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              disabled={isSyncing}
              className={`w-full px-4 py-2 rounded-lg border-2 border-gray-300 focus:border-blue-600 focus:outline-none transition ${
                isSyncing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name} ({site.domain})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 时间范围选择 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          选择时间范围
        </label>
        {!useCustomDateRange ? (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-2">
              {(['1', '2', '7', '30'] as TimeRange[]).map((days) => (
                <button
                  key={days}
                  onClick={() => setSelectedDays(days)}
                  disabled={isSyncing}
                  className={`px-4 py-3 rounded-lg border-2 transition font-medium text-sm ${
                    selectedDays === days
                      ? 'border-green-600 bg-green-50 text-green-900'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  } ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {TIME_RANGE_LABELS[days]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setUseCustomDateRange(true)}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              或输入自定义日期范围
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  开始日期
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  结束日期
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  disabled={isSyncing}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => {
                setUseCustomDateRange(false);
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 underline"
            >
              返回预设时间范围
            </button>
          </div>
        )}
      </div>

      {/* 同步按钮 */}
      <div className="flex gap-3">
        <button
          onClick={handleSync}
          disabled={isSyncing || (syncMode === 'single' && !selectedSiteId)}
          className={`flex-1 px-6 py-3 rounded-lg font-medium transition ${
            isSyncing || (syncMode === 'single' && !selectedSiteId)
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {isSyncing ? (
            <>
              <span className="inline-block animate-spin mr-2">⟳</span>
              同步中...
            </>
          ) : syncMode === 'all' ? (
            '开始同步所有站点 GSC 数据'
          ) : (
            '开始同步该站点 GSC 数据'
          )}
        </button>
      </div>

      {/* 同步结果 */}
      {showResults && syncResult && (
        <div
          className={`rounded-lg border p-4 ${
            syncResult.success
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
        >
          {syncResult.success && syncResult.data ? (
            <>
              <div className="mb-4">
                <h3 className="font-semibold text-lg mb-2 text-gray-900">
                  ✓ 同步完成
                </h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="bg-white rounded p-3 border border-green-200">
                    <div className="text-sm text-gray-600">总站点数</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {syncResult.data.total}
                    </div>
                  </div>
                  <div className="bg-white rounded p-3 border border-green-200">
                    <div className="text-sm text-gray-600">成功</div>
                    <div className="text-2xl font-bold text-green-600">
                      {syncResult.data.successful}
                    </div>
                  </div>
                  <div className="bg-white rounded p-3 border border-green-200">
                    <div className="text-sm text-gray-600">失败</div>
                    <div className="text-2xl font-bold text-red-600">
                      {syncResult.data.failed}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-600 mb-3">
                  时间范围: {syncResult.data.dateRange.startDate} 至 {syncResult.data.dateRange.endDate}
                </div>
              </div>

              {/* 详细结果 */}
              {syncResult.data.results.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  <h4 className="font-semibold text-sm text-gray-900 mb-2">
                    同步详情
                  </h4>
                  {syncResult.data.results.map((result) => (
                    <div
                      key={result.siteId}
                      className={`p-3 rounded border text-sm ${
                        result.success
                          ? 'border-green-200 bg-white'
                          : 'border-red-200 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-medium text-gray-900">
                          {result.success ? '✓' : '✗'} {result.domain}
                        </div>
                        {result.success && (
                          <span className="text-xs text-gray-600">
                            {result.clicks} clicks / {result.impressions} impr
                          </span>
                        )}
                      </div>
                      {result.message && (
                        <div className="text-xs text-gray-600">
                          {result.message}
                        </div>
                      )}
                      {result.error && (
                        <div className="text-xs text-red-600">
                          错误: {result.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 className="font-semibold text-lg mb-2 text-red-900">
                ✗ 同步失败
              </h3>
              <p className="text-sm text-red-700">{syncResult.error}</p>
            </>
          )}
        </div>
      )}

      {/* 说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <h4 className="font-semibold mb-2">使用说明</h4>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li>
            选择时间范围并点击"开始同步"，系统会自动为所有站点获取 Google
            Search Console 数据
          </li>
          <li>同步包括：点击数、展示数、平均点击率、平均排名位置</li>
          <li>每个站点的同步结果会单独显示，失败的站点会显示具体错误信息</li>
          <li>同步数据会保存到数据库，可在站点列表中查看历史数据</li>
        </ul>
      </div>
    </div>
  );
}
