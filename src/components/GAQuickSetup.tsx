'use client';

import { useState, useEffect } from 'react';
import client from '@/api/client';

interface GAQuickSetupProps {
  siteId: string;
  onSuccess?: (data: any) => void;
  onCancel?: () => void;
}

export function GAQuickSetup({ siteId, onSuccess, onCancel }: GAQuickSetupProps) {
  const [step, setStep] = useState<'input' | 'discovering' | 'result'>('input');
  const [jsonInput, setJsonInput] = useState('');
  const [autoSync, setAutoSync] = useState(true);
  const [syncDays, setSyncDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [credentialsAvailable, setCredentialsAvailable] = useState(false);
  const [useAutoCredentials, setUseAutoCredentials] = useState(false);

  // Load credentials from file on mount
  useEffect(() => {
    const loadCredentialsFile = async () => {
      try {
        const response = await fetch('/google-cloud-acount.json');
        if (response.ok) {
          const credentials = await response.json();
          setJsonInput(JSON.stringify(credentials, null, 2));
          setCredentialsAvailable(true);
          setUseAutoCredentials(true);
        }
      } catch (err) {
        // File not available, that's okay
      }
    };

    loadCredentialsFile();
  }, []);

  const handleDiscover = async () => {
    setError(null);
    setDiscovering(true);

    try {
      // 验证 UUID 格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(siteId)) {
        throw new Error(
          `站点 ID 格式无效。应该是有效的 UUID 格式（如：550e8400-e29b-41d4-a716-446655440000）。\n\n你输入的是："${siteId}"\n\n请返回首页，从站点列表中复制正确的 UUID。`
        );
      }

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

      setStep('discovering');

      // 调用发现 API
      const response = await client.post<{ success: boolean; data: any }>(
        '/connectors/discover',
        {
          siteId,
          credentials,
          autoSync,
          days: syncDays,
        }
      );

      // response 已经是 { success, data } 对象
      const apiResponse = response as any;
      if (apiResponse.success) {
        setResult(apiResponse.data);
        setStep('result');
        onSuccess?.(apiResponse.data);
      } else {
        throw new Error(apiResponse.error || '发现失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误');
      setStep('input');
    } finally {
      setDiscovering(false);
    }
  };

  if (step === 'result' && result) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">✓ 发现成功！</h3>
          <div className="text-sm text-green-800 space-y-2">
            <p>
              <strong>找到的属性数：</strong> {result.totalProperties}
            </p>
            <p>
              <strong>创建的连接器：</strong> {result.creatorsConnectors}
            </p>
            {result.autoSync && (
              <p>
                <strong>自动同步状态：</strong> {result.syncResults?.length || 0} 个已同步
              </p>
            )}
          </div>
        </div>

        {/* 显示发现的属性 */}
        <div className="space-y-3">
          <h4 className="font-semibold">发现的 GA4 属性：</h4>
          {result.accounts.map((account: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-3">
              <p className="font-medium text-gray-900">{account.displayName}</p>
              <div className="ml-4 mt-2 space-y-1">
                {account.properties.map((prop: any, pidx: number) => (
                  <div key={pidx} className="text-sm text-gray-700">
                    <p>
                      <strong>📊 {prop.displayName}</strong>
                    </p>
                    <p className="text-xs text-gray-500">Property ID: {prop.propertyId}</p>
                    {prop.websiteUrl && (
                      <p className="text-xs text-gray-500">URL: {prop.websiteUrl}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* 显示同步结果 */}
        {result.syncResults && result.syncResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold">同步结果：</h4>
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
                  : `✗ Property ${sync.propertyId}: ${sync.syncError}`}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => {
              setStep('input');
              setResult(null);
              setJsonInput('');
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            返回
          </button>
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

  return (
    <div className="space-y-6">
      <div className={`border rounded-lg p-4 ${
        credentialsAvailable
          ? 'bg-green-50 border-green-200'
          : 'bg-blue-50 border-blue-200'
      }`}>
        <h3 className={`font-semibold mb-2 ${
          credentialsAvailable
            ? 'text-green-900'
            : 'text-blue-900'
        }`}>
          {credentialsAvailable ? '✅ Service Account 已加载' : '🚀 快速同步所有 GA 站点'}
        </h3>
        <p className={`text-sm ${
          credentialsAvailable
            ? 'text-green-800'
            : 'text-blue-800'
        }`}>
          {credentialsAvailable
            ? 'Service Account 凭证已从项目文件自动加载。直接点击"发现所有属性"开始同步。'
            : '只需输入一个 Service Account，自动发现并同步你所有的 Google Analytics 4 属性。无需手动输入每个属性的 ID！'}
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
          handleDiscover();
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
            placeholder={`{
  "type": "service_account",
  "project_id": "your-project",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  ...
}`}
            className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            从 Google Cloud Console 下载的原始 JSON 文件内容（不需要添加 propertyId）
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoSync}
              onChange={(e) => setAutoSync(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">
              自动同步所有发现的属性的数据
            </span>
          </label>

          {autoSync && (
            <div>
              <label className="block text-sm text-gray-700 mb-2">
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
            </div>
          )}
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
            disabled={discovering || !jsonInput.trim()}
            className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed ${
              credentialsAvailable && useAutoCredentials
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {discovering ? '发现中...' : credentialsAvailable ? '立即发现' : '发现所有属性'}
          </button>
        </div>
      </form>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
        <strong>💡 提示：</strong>
        <ul className="list-disc list-inside mt-2 space-y-1">
          {credentialsAvailable ? (
            <>
              <li>✅ Service Account 已自动从项目文件加载</li>
              <li>直接点击"立即发现"开始同步</li>
              <li>如需更换凭证，可编辑上面的文本框</li>
            </>
          ) : (
            <>
              <li>只需粘贴从 Google Cloud 下载的 JSON 文件内容</li>
              <li>无需手动添加 Property ID</li>
              <li>自动发现所有有权限访问的 GA4 属性</li>
              <li>可选自动同步所有属性的数据</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
