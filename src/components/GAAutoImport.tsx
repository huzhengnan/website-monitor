'use client';

import { useState, useEffect } from 'react';
import client from '@/api/client';

interface GAAutoImportProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function GAAutoImport({ onSuccess, onCancel }: GAAutoImportProps) {
  const [step, setStep] = useState<'input' | 'importing' | 'result'>('input');
  const [jsonInput, setJsonInput] = useState('');
  const [syncDays, setSyncDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [credentialsAvailable, setCredentialsAvailable] = useState(false);

  // 加载凭证文件
  useEffect(() => {
    const loadCredentialsFile = async () => {
      try {
        const response = await fetch('/google-cloud-acount.json');
        if (response.ok) {
          const credentials = await response.json();
          setJsonInput(JSON.stringify(credentials, null, 2));
          setCredentialsAvailable(true);
        }
      } catch (err) {
        // 文件不可用，没关系
      }
    };

    loadCredentialsFile();
  }, []);

  const handleImport = async () => {
    setError(null);
    setImporting(true);

    try {
      // 验证 JSON 格式
      let credentials;
      try {
        credentials = JSON.parse(jsonInput);
      } catch {
        throw new Error('无效的 JSON 格式。请检查输入。');
      }

      // 验证必填字段
      if (
        !credentials.type ||
        !credentials.project_id ||
        !credentials.private_key ||
        !credentials.client_email
      ) {
        throw new Error('缺少必填的 Service Account 字段');
      }

      setStep('importing');

      // 调用导入 API
      // 注意：axios client 的响应拦截器已经返回 response.data，所以 response 就是实际的数据
      const response = await client.post<any>('/ga-import', {
        credentials,
        syncDays,
      });

      // response 已经是解析后的数据，直接使用
      const apiResponse = response as any;
      if (apiResponse.success) {
        setResult(apiResponse.data);
        setStep('result');
        onSuccess?.();
      } else {
        throw new Error(apiResponse.error || '导入失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误');
      setStep('input');
    } finally {
      setImporting(false);
    }
  };

  if (step === 'result' && result) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">✓ 导入成功！</h3>
          <div className="text-sm text-green-800 space-y-2">
            <p>
              <strong>导入的站点数：</strong> {result.totalImported}
            </p>
            <p>
              <strong>已同步数据的属性：</strong>{' '}
              {result.syncResults?.filter((r: any) => r.syncSuccess).length || 0}
            </p>
          </div>
        </div>

        {/* 显示导入的站点 */}
        <div className="space-y-3">
          <h4 className="font-semibold">导入的站点和 UUID：</h4>
          {result.importedSites.map((site: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              <p className="font-medium text-gray-900">{site.name}</p>
              <p className="text-xs text-gray-500">域名: {site.domain}</p>
              <p className="text-xs text-gray-500">GA Property ID: {site.propertyId}</p>
              <div className="mt-2 bg-gray-50 p-2 rounded font-mono text-xs text-gray-700 break-all">
                UUID: {site.id}
              </div>
            </div>
          ))}
        </div>

        {/* 显示同步结果 */}
        {result.syncResults && result.syncResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">数据同步结果：</h4>
            {result.syncResults.map((sync: any, idx: number) => (
              <div
                key={idx}
                className={`text-sm p-2 rounded ${
                  sync.syncSuccess
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {sync.syncSuccess
                  ? `✓ Property ${sync.propertyId}: 已同步 ${sync.syncedDays} 天`
                  : `✗ Property ${sync.propertyId}: ${sync.error}`}
              </div>
            ))}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <strong>✅ 完成！</strong>
          <p className="mt-2">
            所有 GA4 属性已自动导入为站点，每个站点都有唯一的 UUID，你可以在站点列表中查看。
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              完成
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
          <p className="text-gray-600 mt-4">正在导入 GA4 属性并创建站点...</p>
          <p className="text-xs text-gray-500 mt-2">这可能需要 30 秒到几分钟，请不要关闭此页面</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className={`border rounded-lg p-4 ${
          credentialsAvailable
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}
      >
        <h3
          className={`font-semibold mb-2 ${
            credentialsAvailable ? 'text-green-900' : 'text-blue-900'
          }`}
        >
          {credentialsAvailable
            ? '✅ Service Account 已加载'
            : '🚀 自动导入 Google Analytics 属性'}
        </h3>
        <p
          className={`text-sm ${
            credentialsAvailable ? 'text-green-800' : 'text-blue-800'
          }`}
        >
          {credentialsAvailable
            ? 'Service Account 凭证已从项目文件自动加载。直接点击"开始导入"即可自动为所有 GA4 属性创建站点。'
            : '将你的 Google Cloud Service Account JSON 粘贴到下面，系统会自动为每个 GA4 属性创建一个站点，并生成唯一的 UUID。'}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleImport();
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Account JSON
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder={`{\n  "type": "service_account",\n  "project_id": "your-project",\n  "private_key": "-----BEGIN PRIVATE KEY-----\\\\n...\\\\n-----END PRIVATE KEY-----\\\\n",\n  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",\n  ...\n}`}
            className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            从 Google Cloud Console 下载的原始 JSON 文件内容
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            同步天数
          </label>
          <input
            type="number"
            min="1"
            max="365"
            value={syncDays}
            onChange={(e) => setSyncDays(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            选择要同步多少天的流量数据（推荐 30 天）
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            disabled={importing || !jsonInput.trim()}
            className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed ${
              credentialsAvailable ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {importing ? '导入中...' : credentialsAvailable ? '开始导入' : '导入所有属性'}
          </button>
        </div>
      </form>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        <strong>💡 工作原理：</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          {credentialsAvailable ? (
            <>
              <li>✅ Service Account 已自动从项目文件加载</li>
              <li>直接点击"开始导入"即可</li>
            </>
          ) : (
            <>
              <li>粘贴你的 Google Cloud Service Account JSON</li>
              <li>系统会自动连接到你的 Google Analytics 账户</li>
              <li>发现所有你有权限访问的 GA4 属性</li>
              <li>为每个属性自动创建一个站点并生成 UUID</li>
              <li>自动同步指定天数的流量数据</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
