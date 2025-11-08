'use client';

import { useState } from 'react';
import { createConnector, updateConnector, type Connector } from '@/api/connectors';

interface GAConnectorFormProps {
  siteId: string;
  connector?: Connector;
  onSuccess?: (connector: Connector) => void;
  onCancel?: () => void;
}

export function GAConnectorForm({
  siteId,
  connector,
  onSuccess,
  onCancel,
}: GAConnectorFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jsonInput, setJsonInput] = useState<string>(
    connector?.credentials ? JSON.stringify(connector.credentials, null, 2) : ''
  );
  const [showJsonInput, setShowJsonInput] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // 验证 JSON 格式
      let credentials;
      try {
        credentials = JSON.parse(jsonInput);
      } catch {
        throw new Error('无效的 JSON 格式。请检查输入。');
      }

      // 验证必填字段
      if (!credentials.propertyId) {
        throw new Error('Property ID 是必填项');
      }

      if (
        !credentials.type ||
        !credentials.project_id ||
        !credentials.private_key ||
        !credentials.client_email
      ) {
        throw new Error('缺少必填的 Service Account 字段');
      }

      if (connector?.id) {
        // 更新现有连接器
        const result = await updateConnector(connector.id, {
          credentials,
        });
        if (result.success) {
          onSuccess?.(result.data);
        } else {
          throw new Error((result as any).error || '更新失败');
        }
      } else {
        // 创建新连接器
        const result = await createConnector({
          siteId,
          type: 'GoogleAnalytics',
          credentials,
        });
        if (result.success) {
          onSuccess?.(result.data);
          setJsonInput('');
        } else {
          throw new Error((result as any).error || '创建失败');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">如何获取 Service Account JSON？</h3>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>访问 <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
          <li>选择或创建一个项目</li>
          <li>启用 Google Analytics Data API (Analytics API v1)</li>
          <li>创建服务账户：IAM & Admin → Service Accounts → Create Service Account</li>
          <li>为服务账户创建 JSON 密钥：Service Account → Keys → Add Key → JSON</li>
          <li>在 Google Analytics 4 属性中，为该服务账户添加&quot;分析师&quot;角色</li>
          <li>复制你的 GA4 Property ID（数字形式）</li>
          <li>将 JSON 内容粘贴到下方，并添加 &quot;propertyId&quot; 字段</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Account JSON 信息
          </label>
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowJsonInput(!showJsonInput)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {showJsonInput ? '隐藏' : '显示'} JSON 编辑器
            </button>
          </div>

          {showJsonInput && (
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={`{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n",
  "client_email": "your-service-account@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "...",
  "propertyId": "123456789"
}`}
              className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          )}

          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            <strong>重要：</strong> 粘贴完整的 Service Account JSON（从 Google Cloud Console 下载的文件）后，
            请在最后添加一个新字段 <code className="bg-yellow-100 px-1 rounded">&quot;propertyId&quot;: &quot;你的GA4属性ID&quot;</code>
          </div>
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
            disabled={loading || !jsonInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? '处理中...' : connector?.id ? '更新连接器' : '添加连接器'}
          </button>
        </div>
      </form>
    </div>
  );
}
