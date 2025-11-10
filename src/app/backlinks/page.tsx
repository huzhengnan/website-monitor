'use client';

import { useRef } from 'react';
import Link from 'next/link';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable, ModalForm, ProFormText } from '@ant-design/pro-components';
import { Button, Tag, Space, Typography, message, Tooltip, Progress } from 'antd';
import { Star, TrendingUp } from 'lucide-react';
import { createBacklink, importBacklinksFromDocs, listBacklinks, BacklinkSite, deleteBacklink } from '@/api/backlinks';

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
  const actionRef = useRef<ActionType | undefined>(undefined);

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
      width: 260,
      ellipsis: true,
      copyable: true,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      width: 420,
      render: (_, r) => (
        <Link href={r.url} target="_blank" rel="noopener noreferrer">
          {r.url}
        </Link>
      ),
    },
    {
      title: 'DR',
      dataIndex: 'dr',
      width: 80,
      align: 'center',
      render: (_, r) =>
        r.dr == null || r.dr === '' ? (
          <Typography.Text type="secondary">-</Typography.Text>
        ) : (
          <Tag color="geekblue">{typeof r.dr === 'string' ? r.dr : Number(r.dr).toFixed(1)}</Tag>
        ),
    },
    {
      title: '重要程度',
      dataIndex: 'importanceScore',
      width: 160,
      align: 'center',
      // 注意：排序功能需要在数据库迁移完成后启用
      // sorter: true,
      // defaultSortOrder: 'descend',
      render: (_, r) => {
        const score = r.importanceScore || 0;
        const level = getImportanceLevel(score);
        return (
          <Tooltip title={`评分: ${score}/100`}>
            <div className="flex flex-col items-center gap-1">
              <Tag color={level.color}>
                {level.icon} {level.label}
              </Tag>
              <Progress
                type="circle"
                percent={score}
                size={40}
                strokeColor={
                  score >= 80
                    ? '#ff4d4f'
                    : score >= 60
                      ? '#faad14'
                      : score >= 40
                        ? '#1890ff'
                        : score >= 20
                          ? '#52c41a'
                          : '#bfbfbf'
                }
              />
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: '备注',
      dataIndex: 'note',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'date',
      width: 140,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      render: (_, r) => [
        <Link key="open" href={r.url} target="_blank">打开</Link>,
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
        const sortOrder = sortKey ? ((sorter as any)[sortKey] === 'ascend' ? 'asc' : 'desc') : undefined;
        const keyword = (params as any).keyword || (params as any).domain || (params as any).url || (params as any).note || undefined;
        const res = await listBacklinks({ page, pageSize, keyword, sortField: (sortKey as any) || 'createdAt', sortOrder: (sortOrder as any) });
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
  );
}
