'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ConnectorManager } from '@/components/ConnectorManager';
import { GAQuickSetup } from '@/components/GAQuickSetup';
import { GAAutoImport } from '@/components/GAAutoImport';
import { GSCSyncManager } from '@/components/GSCSyncManager';
import { SiteIdInput } from '@/components/SiteIdInput';

export default function SettingsPage() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [setupMode, setSetupMode] = useState<'manual' | 'quick' | 'auto-import'>('quick');
  const [setupComplete, setSetupComplete] = useState(false);

  const handleQuickSetupSuccess = () => {
    setSetupComplete(true);
    setTimeout(() => {
      setSetupMode('manual');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">设置</h1>
          <p className="text-muted-foreground mt-2">管理你的分析和数据源连接</p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {/* Google Search Console 同步部分 */}
          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Google Search Console 数据同步</h2>
            <p className="text-muted-foreground mb-6">
              为所有站点自动同步 GSC 搜索分析数据（点击数、展示数、排名等）。
            </p>
            <GSCSyncManager />
          </div>

          {/* Google Analytics 连接器部分 */}
          <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border p-6">
            <h2 className="text-xl font-semibold mb-4">Google Analytics 配置</h2>
            <p className="text-muted-foreground mb-6">
              连接你的 Google Analytics 账户，自动同步站点数据。
            </p>

            {/* 设置模式选择 */}
            {!selectedSiteId && (
              <div className="mb-6 flex gap-3 flex-col">
                <button
                  onClick={() => setSetupMode('auto-import')}
                  className={`px-4 py-3 rounded-lg border-2 transition ${
                    setupMode === 'auto-import'
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20'
                      : 'border-border hover:border-foreground'
                  }`}
                >
                  <div className="font-semibold text-sm">✨ 自动导入所有 GA 站点（新用户推荐）</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    自动为每个 GA4 属性创建站点并生成 UUID，一步完成
                  </div>
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => setSetupMode('quick')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                      setupMode === 'quick'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <div className="font-semibold text-sm">🚀 快速同步已有站点</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      为已创建的站点同步 GA 属性
                    </div>
                  </button>
                  <button
                    onClick={() => setSetupMode('manual')}
                    className={`flex-1 px-4 py-3 rounded-lg border-2 transition ${
                      setupMode === 'manual'
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-border hover:border-foreground'
                    }`}
                  >
                    <div className="font-semibold text-sm">⚙️ 手动配置</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      逐个配置每个 GA 属性
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* 快速设置模式 */}
            {setupMode === 'quick' && !selectedSiteId && (
              <div className="mb-6">
                <SiteIdInput value={selectedSiteId} onChange={setSelectedSiteId} />
              </div>
            )}

            {/* 自动导入模式 */}
            {setupMode === 'auto-import' && (
              <GAAutoImport
                onSuccess={() => {
                  setSetupComplete(true);
                  setTimeout(() => {
                    setSetupMode('quick');
                  }, 3000);
                }}
                onCancel={() => {
                  setSetupMode('quick');
                  setSetupComplete(false);
                }}
              />
            )}

            {/* 快速设置表单 */}
            {setupMode === 'quick' && selectedSiteId && (
              <GAQuickSetup
                siteId={selectedSiteId}
                onSuccess={handleQuickSetupSuccess}
                onCancel={() => {
                  setSelectedSiteId('');
                  setSetupComplete(false);
                }}
              />
            )}

            {/* 手动配置模式 */}
            {setupMode === 'manual' && (
              <>
                {!selectedSiteId && (
                  <SiteIdInput value={selectedSiteId} onChange={setSelectedSiteId} />
                )}

                {selectedSiteId && <ConnectorManager siteId={selectedSiteId} />}
              </>
            )}

            {/* 建议提示 */}
            {!selectedSiteId && (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                <p>请输入站点 ID 来配置 Analytics 连接</p>
                <Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline mt-2 inline-block">
                  返回首页查看站点
                </Link>
              </div>
            )}
          </div>

          {/* 常见问题和说明 */}
          <div className="rounded-lg p-6 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-900/40">
            <h3 className="text-lg font-semibold text-foreground mb-4">📚 帮助中心</h3>
            <div className="space-y-4 text-sm text-amber-900 dark:text-amber-200/90">
              <div>
                <h4 className="font-semibold mb-2">数据同步方式</h4>
                <ul className="space-y-2 ml-2">
                  <li>
                    <strong>GSC 数据同步：</strong> 自动为所有站点获取 Google Search Console 数据（点击数、展示数、排名等）
                  </li>
                  <li>
                    <strong>GA 自动导入：</strong> 一次性导入所有 GA4 属性，自动为每个属性创建站点
                  </li>
                  <li>
                    <strong>GA 快速同步：</strong> 为已创建的站点快速关联 GA 属性
                  </li>
                  <li>
                    <strong>GA 手动配置：</strong> 逐个配置每个 GA 属性，更灵活控制
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">同步的数据类型</h4>
                <div className="grid grid-cols-2 gap-3 ml-2">
                  <div>
                    <strong className="text-amber-900 dark:text-amber-200">GA 数据：</strong>
                    <ul className="text-xs list-disc list-inside mt-1">
                      <li>活跃用户数、新用户数</li>
                      <li>事件数、Sessions、PV、UV</li>
                      <li>13+ 项详细指标</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="text-amber-900 dark:text-amber-200">GSC 数据：</strong>
                    <ul className="text-xs list-disc list-inside mt-1">
                      <li>总点击数、展示数</li>
                      <li>平均点击率（CTR）</li>
                      <li>平均排名位置</li>
                    </ul>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">💡 建议</h4>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>首次使用建议先用 GSC 数据同步补充历史数据（选择"最近30天"）</li>
                  <li>然后用 GA 自动导入一次性设置所有属性</li>
                  <li>之后可以在站点列表中查看完整的流量和搜索数据</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
