'use client';

import { useState } from 'react';
import { Modal, Input, Button, message, Table, Space, Spin, Alert } from 'antd';
import { quickImportBacklinks } from '@/api/backlinks';
import { DeleteOutlined } from '@ant-design/icons';

interface QuickImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  siteId?: string;
}

interface DomainItem {
  key: string;
  domain: string;
}

export default function QuickImportModal({ visible, onClose, onSuccess, siteId }: QuickImportModalProps) {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [domainInput, setDomainInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAddDomain = () => {
    const domain = domainInput.trim();
    if (!domain) {
      message.warning('请输入域名');
      return;
    }

    if (domains.some((d) => d.domain === domain)) {
      message.warning('域名已存在');
      return;
    }

    const newItem: DomainItem = {
      key: `${domain}-${Date.now()}`,
      domain,
    };
    setDomains([...domains, newItem]);
    setDomainInput('');
  };

  // 处理批量粘贴
  const handlePasteDomains = (text: string) => {
    const lines = text.split('\n');
    const newDomains: DomainItem[] = [];

    for (const line of lines) {
      const domain = line.trim();
      if (!domain) continue;

      // 提取域名（可能包含 URL 或其他信息）
      let cleanDomain = domain;

      // 如果是完整 URL，提取域名
      if (domain.startsWith('http')) {
        try {
          const url = new URL(domain);
          cleanDomain = url.hostname;
        } catch {
          cleanDomain = domain;
        }
      } else {
        // 去掉常见的前缀
        cleanDomain = domain.replace(/^https?:\/\/(www\.)?/, '');
      }

      // 检查是否已存在
      if (!domains.some((d) => d.domain === cleanDomain) && !newDomains.some((d) => d.domain === cleanDomain)) {
        newDomains.push({
          key: `${cleanDomain}-${Date.now()}-${Math.random()}`,
          domain: cleanDomain,
        });
      }
    }

    if (newDomains.length > 0) {
      setDomains([...domains, ...newDomains]);
      message.success(`已添加 ${newDomains.length} 个域名`);
    } else {
      message.warning('未找到新域名');
    }
  };

  const handleRemoveDomain = (key: string) => {
    setDomains(domains.filter((d) => d.key !== key));
  };

  const handleImport = async () => {
    if (domains.length === 0) {
      message.warning('请至少添加一个域名');
      return;
    }

    setLoading(true);
    try {
      const result = await quickImportBacklinks(
        domains.map((d) => ({
          domain: d.domain,
        })),
        siteId
      );

      if (result.success) {
        message.success(
          `导入成功：新增 ${result.stats.created}，更新 ${result.stats.updated}，失败 ${result.stats.failed}`
        );
        if (result.stats.errors && result.stats.errors.length > 0) {
          console.warn('Import errors:', result.stats.errors);
        }
        setDomains([]);
        setDomainInput('');
        onSuccess();
        onClose();
      } else {
        message.error(result.message || '导入失败');
      }
    } catch (error: any) {
      message.error(error?.message || '导入失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="快速导入外链"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="import"
          type="primary"
          loading={loading}
          onClick={handleImport}
          disabled={domains.length === 0}
        >
          导入 ({domains.length})
        </Button>,
      ]}
    >
      <Spin spinning={loading}>
        <div className="space-y-4">
          <Alert
            message="快速导入外链"
            description="支持逐行输入或粘贴多个域名，可以是域名、URL 或任何格式"
            type="info"
            showIcon
          />

          <div>
            <label className="block text-sm font-medium mb-2">
              输入或粘贴域名（每行一个）
            </label>
            <textarea
              placeholder="例如:
example.com
https://test.io
github.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onBlur={(e) => {
                if (e.target.value.includes('\n')) {
                  handlePasteDomains(e.target.value);
                  setDomainInput('');
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
            />
            <div className="flex gap-2 mt-2">
              <Button onClick={handleAddDomain} type="primary" size="small">
                添加单个
              </Button>
              <Button
                onClick={() => {
                  handlePasteDomains(domainInput);
                  setDomainInput('');
                }}
                size="small"
              >
                批量添加
              </Button>
            </div>
          </div>

          {domains.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                待导入的域名 ({domains.length})
              </label>
              <Table<DomainItem>
                columns={[
                  {
                    title: '域名',
                    dataIndex: 'domain',
                    key: 'domain',
                    width: 600,
                  },
                  {
                    title: '操作',
                    key: 'action',
                    width: 80,
                    align: 'center' as const,
                    render: (_, record) => (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveDomain(record.key)}
                      />
                    ),
                  },
                ]}
                dataSource={domains}
                pagination={false}
                rowKey="key"
                size="small"
                scroll={{ y: 300 }}
              />
            </div>
          )}

          <Alert
            message="说明"
            description="支持多种格式输入：域名、完整 URL、或从表格粘贴。系统会自动识别并标准化格式。"
            type="warning"
            showIcon
          />
        </div>
      </Spin>
    </Modal>
  );
}
