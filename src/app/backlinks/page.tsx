'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable, ModalForm, ProFormText } from '@ant-design/pro-components';
import { Button, Tag, Space, Typography, message, Tooltip, Progress, Modal, Table, Badge, Input } from 'antd';
import { Copy } from 'lucide-react';
import { Star, TrendingUp } from 'lucide-react';
import { createBacklink, importBacklinksFromDocs, listBacklinks, BacklinkSite, deleteBacklink, updateBacklink, getBacklinkSubmissions, BacklinkSubmissionDetail, toggleFavorite } from '@/api/backlinks';
import SemrushImportModal from '@/components/SemrushImportModal';
import GSCImportModal from '@/components/GSCImportModal';
import QuickImportModal from '@/components/QuickImportModal';

// 获取重要程度标签
function getImportanceLevel(score: number | null | undefined) {
  if (!score) return { label: '未评估', color: 'default', icon: '⚪' };
  if (score >= 80) {
    return { label: '非常重要', color: 'red', icon: '🔴' };
  } else if (score >= 60) {
    return { label: '重要', color: 'orange', icon: '🟠' };
  } else if (score >= 40) {
    return { label: '中等', color: 'blue', icon: '🔵' };
  } else if (score >= 20) {
    return { label: '一般', color: 'green', icon: '🟢' };
  } else {
    return { label: '较低', color: 'default', icon: '⚪' };
  }
}

export default function BacklinksPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [semrushModalVisible, setSemrushModalVisible] = useState(false);
  const [gscModalVisible, setGscModalVisible] = useState(false);
  const [quickImportVisible, setQuickImportVisible] = useState(false);
  const [submissionsModalVisible, setSubmissionsModalVisible] = useState(false);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsData, setSubmissionsData] = useState<BacklinkSubmissionDetail[]>([]);
  const [selectedBacklinkDomain, setSelectedBacklinkDomain] = useState<string>('');
  const [selectedBacklinkId, setSelectedBacklinkId] = useState<string>('');
  const [currentSiteId, setCurrentSiteId] = useState<string>('');

  // Load site ID from localStorage on mount
  useEffect(() => {
    const savedSiteId = localStorage.getItem('selectedSiteId');
    if (savedSiteId) {
      setCurrentSiteId(savedSiteId);
    }
  }, []);

  const columns: ProColumns<BacklinkSite>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      valueType: 'text',
      hideInTable: true,
      fieldProps: { placeholder: '域名/URL/备注' },
    },
    {
      title: '域名',
      dataIndex: 'domain',
      width: 220,
      ellipsis: true,
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <Tooltip title={r.isFavorite ? '取消收藏' : '收藏'}>
            <button
              onClick={async () => {
                try {
                  await toggleFavorite(r.id, !r.isFavorite);
                  messageApi.success(r.isFavorite ? '已取消收藏' : '已收藏');
                  actionRef.current?.reload();
                } catch (error: any) {
                  messageApi.error(error?.message || '操作失败');
                }
              }}
              className="p-1 hover:bg-gray-100 rounded transition"
            >
              <Star
                className={`w-4 h-4 ${r.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`}
              />
            </button>
          </Tooltip>
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 truncate">
            {r.domain}
          </a>
          <Tooltip title="复制域名">
            <button
              onClick={() => {
                navigator.clipboard.writeText(r.domain);
                messageApi.success('已复制');
              }}
              className="p-1 hover:bg-gray-100 rounded transition text-gray-500 hover:text-gray-700"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      width: 140,
      ellipsis: true,
      hideInTable: true,
      render: (_, r) => (
        <Tooltip title={r.url}>
          <Link href={r.url} target="_blank" rel="noopener noreferrer">
            {r.url.replace(/^https?:\/\/(www\.)?/, '')}
          </Link>
        </Tooltip>
      ),
    },
    {
      title: 'DR/Auth',
      dataIndex: 'dr',
      width: 95,
      align: 'center',
      hideInSearch: true,
      render: (_, r) => (
        <div className="space-y-1">
          <div>
            {r.dr == null || r.dr === '' ? (
              <Typography.Text type="secondary">-</Typography.Text>
            ) : (
              <Tag color="geekblue" style={{ fontSize: '12px' }}>
                {typeof r.dr === 'string' ? r.dr : Number(r.dr).toFixed(1)}
              </Tag>
            )}
          </div>
          <div>
            {r.authorityScore == null ? (
              <Typography.Text type="secondary">-</Typography.Text>
            ) : (
              <Tag color="cyan" style={{ fontSize: '12px' }}>
                {r.authorityScore}
              </Tag>
            )}
          </div>
        </div>
      ),
    },
    {
      title: '重要程度',
      dataIndex: 'importanceScore',
      width: 130,
      align: 'center',
      hideInSearch: true,
      sorter: true,
      defaultSortOrder: 'descend',
      sortDirections: ['ascend', 'descend'],
      render: (_, r) => {
        const score = r.importanceScore || 0;
        const level = getImportanceLevel(score);
        return (
          <Tooltip title={`${level.label} (${score}/100)`}>
            <div className="flex items-center justify-center gap-1">
              <Tag color={level.color} style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                {level.icon} {level.label}
              </Tag>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '标签',
      dataIndex: 'semrushTags',
      width: 120,
      ellipsis: true,
      hideInSearch: true,
      render: (_, r) => {
        if (!r.semrushTags || r.semrushTags.length === 0) {
          return <Typography.Text type="secondary">-</Typography.Text>;
        }
        return (
          <Space size={['small', 0]} wrap>
            {r.semrushTags.map((tag: string) => {
              // 根据标签类型设置颜色
              let color = 'default';
              const lowerTag = tag.toLowerCase();

              // 顶级标签（蓝色）
              if (lowerTag.includes('industry leader') ||
                  lowerTag.includes('market leader')) {
                color = 'blue';
              }
              // 危险标签（红色）
              else if (lowerTag.includes('farm') ||
                  lowerTag.includes('spam') ||
                  lowerTag.includes('malware') ||
                  lowerTag.includes('phishing')) {
                color = 'red';
              }
              // 警告标签（橙色）
              else if (lowerTag.includes('suspicious') ||
                       lowerTag.includes('adult') ||
                       lowerTag.includes('slow') ||
                       lowerTag.includes('server') ||
                       lowerTag.includes('ssl') ||
                       lowerTag.includes('lacks') ||
                       lowerTag.includes('outdated') ||
                       lowerTag.includes('duplicate')) {
                color = 'orange';
              }
              // 积极标签（绿色）
              else if (lowerTag.includes('good') ||
                       lowerTag.includes('mobile') ||
                       lowerTag.includes('friendly')) {
                color = 'green';
              }
              return (
                <Tooltip key={tag} title={tag}>
                  <Tag color={color} style={{ fontSize: '11px' }}>
                    {tag}
                  </Tag>
                </Tooltip>
              );
            })}
          </Space>
        );
      },
    },
    {
      title: '已提交',
      dataIndex: 'submissionCount',
      width: 60,
      align: 'center' as const,
      hideInSearch: true,
      render: (_, record: BacklinkSite) => {
        const count = record.submissionCount;
        if (count === undefined || count === null) return <Typography.Text type="secondary">-</Typography.Text>;
        return (
          <a
            onClick={async () => {
              setSelectedBacklinkDomain(record.domain);
              setSelectedBacklinkId(record.id);
              setSubmissionsLoading(true);
              try {
                const res = await getBacklinkSubmissions(record.id);
                if (res.success) {
                  setSubmissionsData(res.data);
                  setSubmissionsModalVisible(true);
                } else {
                  message.error('获取提交详情失败');
                }
              } catch (error: any) {
                message.error(error?.message || '获取提交详情失败');
              } finally {
                setSubmissionsLoading(false);
              }
            }}
          >
            <Tag color={count > 0 ? 'success' : 'default'}>
              {count}
            </Tag>
          </a>
        );
      },
    },
    {
      title: '流量',
      dataIndex: 'organicTraffic',
      width: 100,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => {
        if (!r.organicTraffic) return <Typography.Text type="secondary">-</Typography.Text>;
        const traffic = r.organicTraffic;
        if (traffic >= 1_000_000) {
          return <span className="text-sm font-semibold">{(traffic / 1_000_000).toFixed(1)}M</span>;
        }
        if (traffic >= 1_000) {
          return <span className="text-sm font-semibold">{(traffic / 1_000).toFixed(0)}K</span>;
        }
        return <span className="text-sm">{Math.round(traffic)}</span>;
      },
    },
    {
      title: '引域',
      dataIndex: 'refDomains',
      width: 90,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => {
        if (!r.refDomains) return <Typography.Text type="secondary">-</Typography.Text>;
        const domains = r.refDomains;
        if (domains >= 1_000_000) {
          return <span className="text-sm font-semibold text-orange-600">{(domains / 1_000_000).toFixed(1)}M</span>;
        }
        if (domains >= 1_000) {
          return <span className="text-sm font-semibold text-orange-600">{(domains / 1_000).toFixed(0)}K</span>;
        }
        return <span className="text-sm">{domains}</span>;
      },
    },
    {
      title: '外链',
      dataIndex: 'backlinks',
      width: 95,
      align: 'right',
      hideInSearch: true,
      render: (_, r) => {
        if (!r.backlinks) return <Typography.Text type="secondary">-</Typography.Text>;
        const backlinks = Number(r.backlinks);
        if (backlinks >= 1_000_000_000) {
          return <span className="text-sm font-semibold text-purple-600">{(backlinks / 1_000_000_000).toFixed(1)}B</span>;
        }
        if (backlinks >= 1_000_000) {
          return <span className="text-sm font-semibold text-purple-600">{(backlinks / 1_000_000).toFixed(1)}M</span>;
        }
        if (backlinks >= 1_000) {
          return <span className="text-sm font-semibold text-purple-600">{(backlinks / 1_000).toFixed(0)}K</span>;
        }
        return <span className="text-sm">{backlinks}</span>;
      },
    },
    {
      title: '备注',
      dataIndex: 'note',
      ellipsis: true,
      hideInSearch: false,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'date',
      width: 110,
      hideInSearch: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, r) => [
        <ModalForm
          key="edit"
          title="编辑外链"
          trigger={<a>编辑</a>}
          initialValues={{ url: r.url, note: r.note, dr: r.dr, submitUrl: r.submitUrl }}
          onFinish={async (v: any) => {
            const hide = message.loading('正在保存…', 0);
            try {
              await updateBacklink(r.id, { url: v.url, note: v.note, dr: v.dr, submitUrl: v.submitUrl });
              message.success('已保存');
              actionRef.current?.reload();
              return true;
            } catch (e: any) {
              message.error(e?.message || '保存失败');
              return false;
            } finally {
              hide();
            }
          }}
        >
          <ProFormText name="url" label="URL" placeholder="https://…" rules={[{ required: true }]} />
          <ProFormText name="dr" label="DR" placeholder="可选" />
          <ProFormText name="note" label="备注" placeholder="可选" />
          <ProFormText
            name="submitUrl"
            label="快捷提交"
            placeholder="https://…（提交网址）"
            extra="点击下方快速提交按钮可直接跳转"
          />
        </ModalForm>,
        r.submitUrl ? (
          <Button
            key="submit"
            type="primary"
            size="small"
            onClick={() => {
              window.open(r.submitUrl, '_blank');
            }}
            title="打开快捷提交链接"
          >
            提交
          </Button>
        ) : null,
        <a
          key="del"
          onClick={async () => {
            const hide = message.loading('正在删除…', 0);
            try {
              await deleteBacklink(r.id);
              message.success('已删除');
              actionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.message || '删除失败');
            } finally {
              hide();
            }
          }}
        >删除</a>,
      ],
    },
  ];

  return (
    <>
      {contextHolder}
      <ProTable<BacklinkSite>
        rowKey="id"
        columns={columns}
        actionRef={actionRef}
        cardBordered
        options={{
          setting: { draggable: true },
          reload: true,
          density: true,
          fullScreen: true,
        }}
        columnsState={{ persistenceKey: 'backlinks-columns', persistenceType: 'localStorage' }}
        search={{
          labelWidth: 'auto',
        }}
        pagination={{ pageSize: 20 }}
        request={async (params, sorter) => {
          const page = Number(params.current) || 1;
          const pageSize = Number(params.pageSize) || 20;
          const sortKey = Object.keys(sorter || {})[0] as keyof BacklinkSite | undefined;
          const sortOrder = sortKey ? ((sorter as any)[sortKey] === 'ascend' ? 'asc' : 'desc') : 'desc'; // 默认降序
          const keyword = (params as any).keyword || (params as any).domain || (params as any).url || (params as any).note || undefined;
          // 默认按重要程度降序排列
          const res = await listBacklinks({ page, pageSize, keyword, sortField: (sortKey as any) || 'importanceScore', sortOrder: (sortOrder as any) });
          if (!res.success) return { data: [], success: false } as any;
          return { data: res.data, success: true, total: res.total } as any;
        }}
        headerTitle={
          <Space>
            <span>外链管理</span>
            <Typography.Text type="secondary">来源：docs/外链提交网站.txt</Typography.Text>
          </Space>
        }
        toolBarRender={() => [
          <ModalForm
            key="add"
            title="新增外链"
            trigger={<Button type="primary">新增外链</Button>}
            onFinish={async (v: any) => {
              await createBacklink({ url: v.url, note: v.note });
              message.success('已添加');
              actionRef.current?.reload();
              return true;
            }}
          >
            <ProFormText name="url" label="URL" placeholder="https://…" rules={[{ required: true }]} />
            <ProFormText name="note" label="备注" placeholder="可选" />
          </ModalForm>,
          <Button key="quick" onClick={() => setQuickImportVisible(true)}>⚡ 快速导入</Button>,
          <Button key="semrush" onClick={() => setSemrushModalVisible(true)}>📊 Semrush 数据</Button>,
          <Button key="gsc" onClick={() => setGscModalVisible(true)} disabled={!currentSiteId}>🔍 从 GSC 导入</Button>,
          <Button key="export" onClick={() => { window.open('/api/backlinks/export', '_blank', 'noopener,noreferrer'); }}>导出 CSV</Button>,
          <Button key="import" onClick={async () => {
            const hide = message.loading('正在导入…', 0);
            try {
              const r = await importBacklinksFromDocs();
              if (r.success) message.success(`导入完成：新增 ${r.stats.created}，更新 ${r.stats.updated ?? 0}，跳过 ${r.stats.skipped}`);
              else message.error('导入失败');
              actionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.message || '导入失败');
            } finally {
              hide();
            }
          }}>导入文档数据</Button>
        ]}
      />
      <SemrushImportModal
        visible={semrushModalVisible}
        onClose={() => setSemrushModalVisible(false)}
        onSuccess={() => actionRef.current?.reload()}
      />
      <Modal
        title={`${selectedBacklinkDomain} 的提交记录`}
        open={submissionsModalVisible}
        onCancel={() => setSubmissionsModalVisible(false)}
        width={900}
        footer={null}
        styles={{ body: { paddingBottom: '100px' } }}
      >
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            borderRadius: '6px',
            border: '1px solid #e0e6f2',
          }}
        >
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: 600, color: '#262626' }}>
              ➕ 快速添加提交记录
            </h3>
            <p style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>添加向此外链网站的提交记录</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Input
              id="quickSubmissionDomain"
              placeholder="输入备注信息 (如: 已提交到首页、待回复等)"
              allowClear
              size="large"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (document.querySelector('[data-quick-add-btn]') as HTMLElement)?.click();
                }
              }}
              style={{ flex: 1 }}
            />
            <Button
              data-quick-add-btn="true"
              type="primary"
              size="large"
              onClick={async () => {
                const input = document.getElementById('quickSubmissionDomain') as HTMLInputElement;
                const notes = input?.value?.trim();
                if (!notes) {
                  message.warning('请输入备注');
                  return;
                }

                const hide = message.loading('正在添加...', 0);
                try {
                  const response = await fetch(`/api/backlink-sites/${selectedBacklinkId}/submissions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      status: 'submitted',
                      submitDate: new Date().toISOString(),
                      notes,
                    }),
                  });

                  const result = await response.json();
                  if (result.success) {
                    message.success(`已添加提交记录`);
                    input.value = '';
                    input.focus();
                    // 刷新提交记录
                    const res = await getBacklinkSubmissions(selectedBacklinkId!);
                    if (res.success) {
                      setSubmissionsData(res.data);
                    }
                  } else {
                    message.error(result.message || '添加失败');
                  }
                } catch (error: any) {
                  message.error(error?.message || '添加失败');
                } finally {
                  hide();
                }
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              快速添加
            </Button>
          </div>
        </div>

        <Table<BacklinkSubmissionDetail>
          columns={[
            {
              title: '网站域名',
              dataIndex: ['site', 'domain'],
              key: 'domain',
              width: 200,
              render: (_, record) => (
                <a href={`https://${record.site.domain}`} target="_blank" rel="noopener noreferrer">
                  {record.site.domain}
                </a>
              ),
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              width: 120,
              render: (status: string) => {
                const statusMap: Record<string, { label: string; color: string }> = {
                  pending: { label: '待提交', color: 'processing' },
                  submitted: { label: '已提交', color: 'success' },
                  indexed: { label: '已收录', color: 'success' },
                  failed: { label: '失败', color: 'error' },
                  contacted: { label: '已联系', color: 'default' },
                };
                const s = statusMap[status] || { label: status, color: 'default' };
                return <Badge status={s.color as any} text={s.label} />;
              },
            },
            {
              title: '提交时间',
              dataIndex: 'submitDate',
              key: 'submitDate',
              width: 150,
              render: (date: string | null | undefined) => {
                if (!date) return '-';
                return new Date(date).toLocaleDateString('zh-CN');
              },
            },
            {
              title: '收录时间',
              dataIndex: 'indexedDate',
              key: 'indexedDate',
              width: 150,
              render: (date: string | null | undefined) => {
                if (!date) return '-';
                return new Date(date).toLocaleDateString('zh-CN');
              },
            },
            {
              title: '备注',
              dataIndex: 'notes',
              key: 'notes',
              render: (notes: string | null | undefined) => notes || '-',
            },
            {
              title: '操作',
              key: 'action',
              width: 100,
              render: (_, record: BacklinkSubmissionDetail) => {
                if (record.status === 'indexed') {
                  return <span className="text-xs text-muted-foreground">已收录</span>;
                }
                return (
                  <a
                    onClick={async () => {
                      const hide = message.loading('更新中...', 0);
                      try {
                        const today = new Date().toISOString().split('T')[0];
                        const response = await fetch(`/api/backlinks/${record.id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            status: 'indexed',
                            indexedDate: today,
                          }),
                        });
                        if (response.ok) {
                          message.success('已标记为已收录');
                          // 重新加载提交记录
                          const res = await getBacklinkSubmissions(record.backlinkSiteId);
                          if (res.success) {
                            setSubmissionsData(res.data);
                          }
                        } else {
                          message.error('更新失败');
                        }
                      } catch (error: any) {
                        message.error(error?.message || '更新失败');
                      } finally {
                        hide();
                      }
                    }}
                  >
                    <span className="text-blue-600 hover:text-blue-800">标记收录</span>
                  </a>
                );
              },
            },
          ]}
          dataSource={submissionsData}
          loading={submissionsLoading}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Modal>
      <GSCImportModal
        visible={gscModalVisible}
        onClose={() => setGscModalVisible(false)}
        onSuccess={() => actionRef.current?.reload()}
        siteId={currentSiteId}
      />
      <QuickImportModal
        visible={quickImportVisible}
        onClose={() => setQuickImportVisible(false)}
        onSuccess={() => actionRef.current?.reload()}
      />
    </>
  );
}
