'use client';

import { useState, useEffect } from 'react';
import { getConnectors, deleteConnector, triggerSync, type Connector } from '@/api/connectors';
import { GAConnectorForm } from './GAConnectorForm';

interface ConnectorManagerProps {
  siteId: string;
}

export function ConnectorManager({ siteId }: ConnectorManagerProps) {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConnector, setEditingConnector] = useState<Connector | undefined>();
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadConnectors = async () => {
    try {
      setLoading(true);
      const response = await getConnectors(siteId);
      if (response.success) {
        setConnectors(response.data.items);
        setError(null);
      } else {
        setError('加载连接器失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnectors();
  }, [siteId]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除此连接器吗？')) return;

    try {
      const response = await deleteConnector(id);
      if (response.success) {
        setConnectors(connectors.filter((c) => c.id !== id));
      } else {
        setError('删除失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生错误');
    }
  };

  const handleSync = async (id: string) => {
    try {
      setSyncing(id);
      setSyncMessage(null);
      const response = await triggerSync({
        connectorId: id,
        days: 7,
      });
      if (response.success) {
        setSyncMessage(
          `✓ 同步成功！已同步 ${response.data.syncedDays} 天的数据`
        );
        // 重新加载连接器以更新 lastSyncAt 时间
        setTimeout(loadConnectors, 1000);
      } else {
        setSyncMessage(`✗ 同步失败: ${(response as any).error || '未知错误'}`);
      }
    } catch (err) {
      setSyncMessage(
        `✗ 同步失败: ${err instanceof Error ? err.message : '发生错误'}`
      );
    } finally {
      setSyncing(null);
    }
  };

  const handleFormSuccess = (connector: Connector) => {
    if (editingConnector?.id) {
      // 更新现有连接器
      setConnectors(connectors.map((c) => (c.id === connector.id ? connector : c)));
    } else {
      // 添加新连接器
      setConnectors([...connectors, connector]);
    }
    setShowForm(false);
    setEditingConnector(undefined);
  };

  if (loading) {
    return <div className="text-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Analytics 连接器</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + 添加连接器
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {syncMessage && (
        <div
          className={`rounded-lg p-4 ${
            syncMessage.startsWith('✓')
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {syncMessage}
        </div>
      )}

      {showForm && (
        <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">
            {editingConnector?.id ? '编辑连接器' : '添加新连接器'}
          </h3>
          <GAConnectorForm
            siteId={siteId}
            connector={editingConnector}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingConnector(undefined);
            }}
          />
        </div>
      )}

      <div className="space-y-3">
        {connectors.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>还没有添加任何连接器</p>
            <p className="text-sm">点击&quot;添加连接器&quot;按钮开始配置 Google Analytics</p>
          </div>
        ) : (
          connectors.map((connector) => (
            <div
              key={connector.id}
              className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{connector.type}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        connector.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : connector.status === 'error'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {connector.status === 'active' ? '活跃' : connector.status === 'error' ? '错误' : '未活跃'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      Property ID:{' '}
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {(connector.credentials as any)?.propertyId || '未设置'}
                      </code>
                    </p>
                    <p>
                      客户端邮箱:{' '}
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {(connector.credentials as any)?.client_email || '未设置'}
                      </code>
                    </p>
                    {connector.lastSyncAt && (
                      <p>
                        最后同步: {new Date(connector.lastSyncAt).toLocaleString('zh-CN')}
                      </p>
                    )}
                    {connector.lastError && (
                      <p className="text-red-600">错误: {connector.lastError}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleSync(connector.id)}
                    disabled={syncing === connector.id}
                    className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    {syncing === connector.id ? '同步中...' : '立即同步'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingConnector(connector);
                      setShowForm(true);
                    }}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(connector.id)}
                    className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
