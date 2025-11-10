'use client';

import { useState } from 'react';
import { Modal, Input, Button, message, Table, Space, Spin, Alert } from 'antd';
import { importGSCSubmissions } from '@/api/backlinks';
import { DeleteOutlined } from '@ant-design/icons';

interface GSCImportModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  siteId?: string;
  siteName?: string;
}

interface DomainItem {
  key: string;
  domain: string;
  indexedDate?: string;
}

export default function GSCImportModal({ visible, onClose, onSuccess, siteId, siteName }: GSCImportModalProps) {
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
      indexedDate: new Date().toISOString().split('T')[0],
    };
    setDomains([...domains, newItem]);
    setDomainInput('');
  };

  const handleRemoveDomain = (key: string) => {
    setDomains(domains.filter((d) => d.key !== key));
  };

  const handleImport = async () => {
    if (!siteId) {
      message.error('未获取到网站ID');
      return;
    }

    if (domains.length === 0) {
      message.warning('请至少添加一个域名');
      return;
    }

    setLoading(true);
    try {
      const result = await importGSCSubmissions(
        siteId,
        domains.map((d) => ({
          domain: d.domain,
          indexedDate: d.indexedDate,
        }))
      );

      if (result.success) {
        message.success(
          `导入成功：新增 ${result.stats.created}，更新 ${result.stats.updated}，失败 ${result.stats.failed}`
        );
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
      title="从 GSC 导入外链提交"
      open={visible}
      onCancel={onClose}
      width={700}
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
          {siteName && (
            <Alert
              message={`正在导入到: ${siteName}`}
              type="info"
              showIcon
            />
          )}

          <div>
            <label className="block text-sm font-medium mb-2">
              添加域名 (Google Search Console 中已收录的外链)
            </label>
            <Space.Compact className="w-full">
              <Input
                placeholder="输入域名 (如: example.com)"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onPressEnter={handleAddDomain}
              />
              <Button type="primary" onClick={handleAddDomain}>
                添加
              </Button>
            </Space.Compact>
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
                    width: 300,
                  },
                  {
                    title: '收录日期',
                    dataIndex: 'indexedDate',
                    key: 'indexedDate',
                    width: 150,
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
              />
            </div>
          )}

          <Alert
            message="说明"
            description='此操作将从 Google Search Console 导入已收录的外链，标记状态为"已收录"，便于后续跟踪和管理。'
            type="warning"
            showIcon
          />
        </div>
      </Spin>
    </Modal>
  );
}
