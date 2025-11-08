'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ProxyConfig {
  HTTP_PROXY: string;
  HTTPS_PROXY: string;
  USE_PROXY: string;
  PROXY_URL: string;
  effectiveProxy: string;
  isProxyEnabled: boolean;
}

export default function ProxyDebugPage() {
  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkProxy = async () => {
      try {
        const response = await fetch('/api/proxy-test');
        const data = await response.json();
        setConfig(data.proxyConfig);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取代理配置失败');
      } finally {
        setLoading(false);
      }
    };

    checkProxy();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-indigo-600 hover:text-indigo-700 text-sm font-semibold">
            ← 返回首页
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-4">代理配置检查</h1>
          <p className="text-gray-600 mt-2">验证 HTTP 代理配置是否正确</p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-600">加载中...</div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-8">
            <h2 className="text-red-900 font-semibold mb-2">获取配置失败</h2>
            <p className="text-red-700">{error}</p>
          </div>
        ) : config ? (
          <div className="space-y-6">
            {/* Status Card */}
            <div
              className={`rounded-lg p-8 ${
                config.isProxyEnabled
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {config.isProxyEnabled ? (
                  <>
                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                      ✓
                    </div>
                    <h2 className="text-2xl font-bold text-green-900">代理已配置</h2>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold">
                      !
                    </div>
                    <h2 className="text-2xl font-bold text-yellow-900">代理未配置</h2>
                  </>
                )}
              </div>
              <p
                className={config.isProxyEnabled ? 'text-green-700' : 'text-yellow-700'}
              >
                {config.isProxyEnabled
                  ? `代理地址: ${config.effectiveProxy}`
                  : '请在 .env.local 中设置 HTTP_PROXY 或 HTTPS_PROXY'}
              </p>
            </div>

            {/* Configuration Details */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-8 py-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">环境变量配置</h3>
              </div>
              <div className="px-8 py-6 space-y-4">
                <ConfigItem label="HTTP_PROXY" value={config.HTTP_PROXY} />
                <ConfigItem label="HTTPS_PROXY" value={config.HTTPS_PROXY} />
                <ConfigItem label="USE_PROXY" value={config.USE_PROXY} />
                <ConfigItem label="PROXY_URL" value={config.PROXY_URL} />
                <ConfigItem label="生效的代理地址" value={config.effectiveProxy} highlight />
              </div>
            </div>

            {/* Instructions */}
            {!config.isProxyEnabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-8">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">如何配置代理？</h3>
                <ol className="space-y-3 text-blue-800">
                  <li>
                    <strong>1. 编辑 .env.local 文件</strong>
                    <pre className="bg-white p-3 rounded mt-2 text-sm overflow-auto border border-blue-200">
HTTP_PROXY="http://localhost:7890"
HTTPS_PROXY="http://localhost:7890"
                    </pre>
                  </li>
                  <li className="mt-4">
                    <strong>2. 重启应用</strong>
                    <pre className="bg-white p-3 rounded mt-2 text-sm border border-blue-200">
# Ctrl+C 停止当前应用
# 然后运行：
npm run dev
                    </pre>
                  </li>
                  <li className="mt-4">
                    <strong>3. 刷新此页面验证配置</strong>
                  </li>
                </ol>
              </div>
            )}

            {/* Test Buttons */}
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">测试功能</h3>
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="block w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-semibold text-center"
                >
                  刷新检查代理配置
                </button>
                <a
                  href="/settings"
                  className="block w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold text-center"
                >
                  前往设置页面配置 GA
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// Helper Component
function ConfigItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`p-3 rounded ${highlight ? 'bg-green-50 border border-green-200' : 'bg-gray-50'}`}>
      <div className="text-sm font-semibold text-gray-700">{label}</div>
      <div
        className={`mt-1 font-mono text-sm ${
          value === 'not set' ? 'text-red-600' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
