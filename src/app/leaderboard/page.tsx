'use client';

import { useRef, useState } from 'react';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Segmented, Space, Typography } from 'antd';
import Link from 'next/link';
import { getLeaderboard, type LeaderboardEntry } from '@/api/evaluations';
import RadarChart from '@/components/RadarChart';

type Dimension = 'composite' | 'market' | 'quality' | 'seo' | 'traffic' | 'revenue';

export default function LeaderboardPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [dimension, setDimension] = useState<Dimension>('composite');

  const columns: ProColumns<LeaderboardEntry>[] = [
    { title: '排名', dataIndex: 'rank', width: 80, sorter: true },
    { title: '站点', dataIndex: 'siteName', render: (_, r) => <Link href={`/sites/${r.siteId}`}>{r.siteName}</Link> },
    { title: '域名', dataIndex: 'domain', copyable: true },
    { title: '状态', dataIndex: 'status', width: 100 },
    { title: '得分', dataIndex: 'score', width: 100, sorter: true },
    { title: '时间', dataIndex: 'evaluationDate', valueType: 'date', width: 140 },
  ];

  return (
    <ProTable<LeaderboardEntry>
      rowKey={(r) => r.siteId + '-' + r.evaluationDate}
      columns={columns}
      actionRef={actionRef}
      cardBordered
      pagination={{ pageSize: 20 }}
      options={{ setting: { draggable: true }, reload: true, density: true, fullScreen: true }}
      headerTitle={
        <Space>
          <span>Leaderboard</span>
          <Typography.Text type="secondary">维度</Typography.Text>
          <Segmented
            size="small"
            value={dimension}
            options={[
              { label: '综合', value: 'composite' },
              { label: '市场', value: 'market' },
              { label: '质量', value: 'quality' },
              { label: 'SEO', value: 'seo' },
              { label: '流量', value: 'traffic' },
              { label: '收益', value: 'revenue' },
            ]}
            onChange={(v) => { setDimension(v as Dimension); actionRef.current?.reload(); }}
          />
        </Space>
      }
      toolBarRender={() => [
        <a key="export" href={`/api/leaderboard/export?dimension=${dimension}`} target="_blank" rel="noopener noreferrer">导出 CSV</a>
      ]}
      expandable={{
        expandedRowRender: (r) => (
          <div style={{ padding: 12 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Score Distribution</div>
            <RadarChart data={r.scores} height={280} showLegend={false} />
          </div>
        ),
      }}
      request={async (params) => {
        const page = Number(params.current) || 1;
        const pageSize = Number(params.pageSize) || 20;
        const res = await getLeaderboard(dimension, { page, pageSize });
        return { data: res.items, success: true, total: res.total } as any;
      }}
    />
  );
}
