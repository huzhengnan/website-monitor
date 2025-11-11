'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { Button, Tag, Segmented, Space, Typography, message, Tooltip } from 'antd';
import { listSites, Site, deleteSite } from '@/api/sites';
import client from '@/api/client';

type Days = 1 | 2 | 7 | 30;

export default function SitesPage() {
  const actionRef = useRef<ActionType | undefined>(undefined);
  const [days, setDays] = useState<Days>(7);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [deleting, setDeleting] = useState(false);
  // 记录最近一次有效的排序器（避免列显隐后残留旧键干扰）
  const lastSorterRef = useRef<any>(null);
  // 受控排序状态，消除列持久化导致的排序不可切换问题
  const [sortKey, setSortKey] = useState<string>('pv');
  const [sortOrder, setSortOrder] = useState<'ascend' | 'descend'>('descend');

  const columns: ProColumns<Site & { metrics?: any }>[] = [
    {
      title: '关键词',
      dataIndex: 'keyword',
      valueType: 'text',
      hideInTable: true,
      fieldProps: { placeholder: '名称/域名' },
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 140,
      ellipsis: true,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      render: (_, r) => <Link href={`/sites/${r.id}`}>{r.name}</Link>,
    },
    { title: 'ID', dataIndex: 'id', key: 'id', width: 160, copyable: true, ellipsis: true, hideInTable: true },
    {
      title: '域名',
      dataIndex: 'domain',
      key: 'domain',
      width: 240,
      copyable: true,
      ellipsis: true,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
      hideInTable: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      valueType: 'select',
      valueEnum: {
        online: { text: '在线' },
        maintenance: { text: '维护中' },
        offline: { text: '离线' },
      },
      hideInTable: true,
      render: (_, r) => {
        const status = r.status;
        const map: any = {
          online: { color: 'green', text: '在线' },
          maintenance: { color: 'gold', text: '维护中' },
          offline: { color: 'red', text: '离线' },
        };
        return <Tag color={map[status].color}>{map[status].text}</Tag>;
      },
    },
    {
      title: '分类',
      dataIndex: ['category', 'name'],
      hideInTable: true,
      render: (_, r) => r.category?.name || '-',
    },
    {
      title: '平台',
      dataIndex: 'platform',
      hideInTable: true,
      render: (_, r) => r.platform || '-',
    },
    {
      title: () => (<Tag color="geekblue">GA</Tag>),
      onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
      children: [
        {
          key: 'pv',
          title: 'PV',
          dataIndex: ['metrics', 'traffic', 'totalPv'],
          width: 60,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
          onCell: () => ({ className: 'bg-indigo-50 dark:bg-indigo-900/10' }),
          render: (_, r) => r.metrics?.traffic?.totalPv ?? '-',
        },
        {
          key: 'uv',
          title: 'UV',
          dataIndex: ['metrics', 'traffic', 'totalUv'],
          width: 50,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
          onCell: () => ({ className: 'bg-indigo-50 dark:bg-indigo-900/10' }),
          render: (_, r) => r.metrics?.traffic?.totalUv ?? '-',
        },
        {
          key: 'au',
          title: 'AU',
          dataIndex: ['metrics', 'traffic', 'totalActiveUsers'],
          width: 50,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
          onCell: () => ({ className: 'bg-indigo-50 dark:bg-indigo-900/10' }),
          render: (_, r) => r.metrics?.traffic?.totalActiveUsers ?? '-',
        },
        {
          key: 'sessions',
          title: 'Sessions',
          dataIndex: ['metrics', 'traffic', 'totalSessions'],
          width: 60,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
          onCell: () => ({ className: 'bg-indigo-50 dark:bg-indigo-900/10' }),
          render: (_, r) => r.metrics?.traffic?.totalSessions ?? '-',
        },
        {
          key: 'avgSessionDuration',
          title: '停留',
          dataIndex: ['metrics', 'traffic', 'avgSessionDuration'],
          width: 60,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
          onCell: () => ({ className: 'bg-indigo-50 dark:bg-indigo-900/10' }),
          render: (_, r) => {
            const duration = r.metrics?.traffic?.avgSessionDuration;
            if (duration === undefined || duration === null || duration === '-') return '-';
            const val = typeof duration === 'number' ? duration : parseFloat(duration);
            if (isNaN(val)) return '-';

            // 自动切换单位
            if (val >= 60) {
              // 显示为分钟
              return `${(val / 60).toFixed(1)}m`;
            } else {
              // 显示为秒
              return `${val.toFixed(0)}s`;
            }
          },
        },
        {
          key: 'bounceRate',
          title: () => (
            <Tooltip title="用户在浏览网站后未进行任何交互就离开的百分比，数值越低越好">
              <Space size={2}>
                <span>跳出率</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#e6f7ff',
                  color: '#1890ff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'help',
                  lineHeight: '18px',
                }}>?</span>
              </Space>
            </Tooltip>
          ),
          dataIndex: ['metrics', 'traffic', 'avgBounceRate'],
          width: 60,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-indigo-100 dark:bg-indigo-900/20' }),
          onCell: () => ({ className: 'bg-indigo-50 dark:bg-indigo-900/10' }),
          render: (_, r) => {
            const bounceRate = r.metrics?.traffic?.avgBounceRate;
            if (bounceRate === undefined || bounceRate === null || bounceRate === '-') return '-';
            const rate = typeof bounceRate === 'number' ? bounceRate : parseFloat(bounceRate);
            // 如果值小于 2，说明是 0-1 之间的小数，需要乘以 100
            const percentageValue = rate < 2 ? rate * 100 : rate;
            return isNaN(percentageValue) ? '-' : `${percentageValue.toFixed(1)}%`;
          },
        },
      ],
    },
    {
      title: () => (<Tooltip title="Google Search Console 指标"><Tag color="gold">GSC</Tag></Tooltip>),
      onHeaderCell: () => ({ className: 'bg-amber-100 dark:bg-amber-900/20' }),
      children: [
        {
          key: 'clicks',
          title: 'Clicks',
          dataIndex: ['metrics', 'gsc', 'totalClicks'],
          width: 50,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-amber-100 dark:bg-amber-900/20' }),
          onCell: () => ({ className: 'bg-amber-50 dark:bg-amber-900/10' }),
          render: (_, r) => r.metrics?.gsc?.totalClicks ?? '-',
        },
        {
          key: 'impr',
          title: 'Impr',
          dataIndex: ['metrics', 'gsc', 'totalImpressions'],
          width: 60,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-amber-100 dark:bg-amber-900/20' }),
          onCell: () => ({ className: 'bg-amber-50 dark:bg-amber-900/10' }),
          render: (_, r) => r.metrics?.gsc?.totalImpressions ?? '-',
        },
        {
          key: 'ctr',
          title: 'CTR',
          dataIndex: ['metrics', 'gsc', 'avgCtr'],
          width: 50,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-amber-100 dark:bg-amber-900/20' }),
          onCell: () => ({ className: 'bg-amber-50 dark:bg-amber-900/10' }),
          render: (_, r) => (r.metrics?.gsc?.avgCtr ?? '-') as any,
        },
        {
          key: 'avgpos',
          title: 'AvgPos',
          dataIndex: ['metrics', 'gsc', 'avgPosition'],
          width: 50,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-amber-100 dark:bg-amber-900/20' }),
          onCell: () => ({ className: 'bg-amber-50 dark:bg-amber-900/10' }),
          render: (_, r) => (r.metrics?.gsc?.avgPosition ?? '-') as any,
        },
        {
          key: 'backlinks',
          title: '外链数量',
          dataIndex: ['metrics', 'backlinksCount'],
          width: 40,
          sorter: true,
          sortDirections: ['descend', 'ascend'],
          onHeaderCell: () => ({ className: 'bg-amber-100 dark:bg-amber-900/20' }),
          onCell: () => ({ className: 'bg-amber-50 dark:bg-amber-900/10' }),
          render: (_, r) => (
            <Link href={`/sites/${r.id}?tab=backlinks`} className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium">
              {r.metrics?.backlinksCount ?? '-'}
            </Link>
          ),
        },
      ],
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      valueType: 'date',
      width: 140,
      sorter: true,
      sortDirections: ['descend', 'ascend'],
    },
    {
      title: '操作',
      valueType: 'option',
      width: 140,
      render: (_, r) => [
        <Link key="open" href={`/sites/${r.id}`}>详情</Link>,
        <a
          key="del"
          onClick={async () => {
            try {
              setDeleting(true);
              await deleteSite(r.id);
              message.success('已删除');
              actionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.message || '删除失败');
            } finally {
              setDeleting(false);
            }
          }}
        >删除</a>,
      ],
    },
  ];

  return (
    <ProTable<Site & { metrics?: any }>
      rowKey="id"
      columns={columns}
      actionRef={actionRef}
      cardBordered
      pagination={{ pageSize: 20 }}
      columnsState={{ persistenceKey: 'sites-columns-v3', persistenceType: 'localStorage' }}
      sticky
      columnEmptyText="-"
      rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
      options={{ setting: { draggable: true }, reload: true, density: true, fullScreen: true }}
      tableAlertRender={({ selectedRowKeys }) => (
        <Space>
          <span>已选 {selectedRowKeys.length} 项</span>
        </Space>
      )}
      tableAlertOptionRender={() => [
        <a key="clear" onClick={() => setSelectedRowKeys([])}>清空选择</a>,
        <a
          key="batch-del"
          onClick={async () => {
            if (selectedRowKeys.length === 0) return;
            try {
              setDeleting(true);
              for (const id of selectedRowKeys) {
                await deleteSite(String(id));
              }
              message.success(`已删除 ${selectedRowKeys.length} 项`);
              setSelectedRowKeys([]);
              actionRef.current?.reload();
            } catch (e: any) {
              message.error(e?.message || '删除失败');
            } finally {
              setDeleting(false);
            }
          }}
        >批量删除</a>,
      ]}
      headerTitle={
        <Space>
          <span>我的站点</span>
          <Typography.Text type="secondary">时间范围</Typography.Text>
          <Segmented
            size="small"
            value={days}
            options={[
              { label: '今天', value: 1 },
              { label: '昨天', value: 2 },
              { label: '7天', value: 7 },
              { label: '30天', value: 30 },
            ]}
            onChange={(v) => {
              setDays(v as Days);
              actionRef.current?.reload();
            }}
          />
        </Space>
      }
      toolBarRender={() => [
        <Link key="new" href="/sites/new">
          <Button type="primary">新增站点</Button>
        </Link>,
        <Button
          key="sync-backlinks"
          onClick={async () => {
            const hide = message.loading('正在同步外链来源…', 0);
            try {
              const r: any = await client.post('/ga-sources/sync', undefined, { params: { days } });
              if (r?.success) {
                message.success('同步完成');
                actionRef.current?.reload();
              } else {
                message.error(r?.error || '同步失败');
              }
            } catch (e: any) {
              message.error(e?.message || '同步失败');
            } finally {
              hide();
            }
          }}
        >同步外链来源</Button>,
        <Button key="export" onClick={() => { window.open('/api/sites/export', '_blank', 'noopener,noreferrer'); }}>导出 CSV</Button>,
      ]}
      // 记录变更时的排序器，确保 request 使用最近一次点击
      onChange={(_, __, sorterArg) => {
        // 统一解析 sorter（支持单个、数组、映射）
        const normalizeKey = (k: string) => {
          const s = (k || '').toLowerCase();
          if (s === 'pv' || s.includes('totalpv')) return 'pv';
          if (s === 'uv' || s.includes('totaluv')) return 'uv';
          if (s === 'au' || s.includes('totalactiveusers')) return 'au';
          if (s === 'sessions' || s.includes('totalsessions')) return 'sessions';
          if (s === 'bouncerate' || s.includes('bouncerate')) return 'bouncerate';
          if (s === 'clicks' || s.includes('totalclicks')) return 'clicks';
          if (s === 'impr' || s.includes('totalimpressions')) return 'impr';
          if (s === 'ctr' || s.includes('avgctr')) return 'ctr';
          if (s === 'avgpos' || s.includes('avgposition')) return 'avgpos';
          if (s === 'backlinks' || s.includes('backlink')) return 'backlinks';
          if (s === 'createdat' || s === 'created_at') return 'createdat';
          return s || 'pv';
        };
        let order: 'ascend' | 'descend' | undefined;
        let key: string | undefined;
        let s: any = sorterArg as any;
        if (Array.isArray(s)) {
          const withOrder = s.filter((i) => i?.order);
          s = withOrder.length > 0 ? withOrder[withOrder.length - 1] : s[s.length - 1];
        }
        if (s && typeof s === 'object' && ('order' in s || 'columnKey' in s || 'field' in s)) {
          key = String(s.columnKey || s.field || '').toLowerCase();
          order = s.order as any;
        } else if (s && typeof s === 'object') {
          // 映射形态：{ 'metrics,traffic,totalUv': 'ascend' }
          for (const [k, v] of Object.entries(s)) {
            if (v === 'ascend' || v === 'descend') { key = k; order = v as any; }
          }
        }
        if (!key) return; // 列显隐等情况可能传入空 key
        const nk = normalizeKey(key);

        if (order) {
          // 有明确的排序方向
          setSortKey(nk);
          setSortOrder(order);
          lastSorterRef.current = { columnKey: nk, order };
        } else {
          // order 为 undefined，说明用户要清除排序（第三次点击）
          // 清空排序状态
          setSortKey('');
          setSortOrder('descend');
          lastSorterRef.current = null;
        }
        // 不强制 reload，交由 ProTable 内部触发 request
      }}
      request={async (params, sorter) => {
        const page = Number(params.current) || 1;
        const pageSize = Number(params.pageSize) || 20;
        const filters: any = {};
        if ((params as any).keyword) filters.search = (params as any).keyword;
        if ((params as any).status) filters.status = (params as any).status;
        const res = await listSites({ page, pageSize, ...filters });
        const items = res.data.items;
        // 解析排序键（兼容对象/映射两种形态）
        const parseSorter = (s: any): { key: string; order: 'ascend' | 'descend'; had: boolean } => {
          if (!s) return { key: 'pv', order: 'descend', had: false };
          // 形态1（Table SorterResult）：{ order, columnKey, field }
          if (
            typeof s === 'object' &&
            (Object.prototype.hasOwnProperty.call(s, 'order') ||
              Object.prototype.hasOwnProperty.call(s, 'columnKey') ||
              Object.prototype.hasOwnProperty.call(s, 'field'))
          ) {
            const k = (s.columnKey || s.field || 'pv') as string;
            const o = ((s.order as any) || 'descend') as 'ascend' | 'descend';
            return { key: String(k), order: o, had: Boolean(s.order) };
          }
          // 形态2（ProTable 推荐）：{ [columnKey]: 'ascend'|'descend', ... }
          let foundKey: string | undefined;
          let foundOrder: 'ascend' | 'descend' | undefined;
          for (const [k, v] of Object.entries(s)) {
            if (v === 'ascend' || v === 'descend') {
              // 取最后一个有序的键，优先用户最新点击
              foundKey = k;
              foundOrder = v as any;
            } else if (typeof v === 'object' && (v as any)?.order) {
              foundKey = k;
              foundOrder = (v as any).order;
            }
          }
          if (foundKey && foundOrder) return { key: String(foundKey), order: foundOrder, had: true };
          return { key: 'pv', order: 'descend', had: false };
        };
        // 优先使用受控状态（lastSorterRef.current 是最新的用户交互）
        // 如果 lastSorterRef.current 显式被设置为 null，说明用户清除了排序
        let hadSorter = false;
        let rawKeyServer = '';
        let sortOrderServer: 'ascend' | 'descend' = 'descend';

        if (lastSorterRef.current) {
          // 有明确的排序记录
          rawKeyServer = lastSorterRef.current.columnKey;
          sortOrderServer = lastSorterRef.current.order;
          hadSorter = true;
        } else if (sortKey) {
          // 使用状态中的值（初始状态或其他来源）
          rawKeyServer = sortKey;
          sortOrderServer = (sortOrder as any) || 'descend';
          hadSorter = true;
        } else {
          // 无排序，使用默认值
          hadSorter = false;
        }
        const normalizeKey = (k: string) => {
          const s = (k || '').toLowerCase();
          if (!s) return ''; // 空值返回空
          if (s === 'pv' || s.includes('totalpv')) return 'pv';
          if (s === 'uv' || s.includes('totaluv')) return 'uv';
          if (s === 'au' || s.includes('totalactiveusers')) return 'au';
          if (s === 'sessions' || s.includes('totalsessions')) return 'sessions';
          if (s === 'bouncerate' || s.includes('bouncerate')) return 'bouncerate';
          if (s === 'clicks' || s.includes('totalclicks')) return 'clicks';
          if (s === 'impr' || s.includes('totalimpressions')) return 'impr';
          if (s === 'ctr' || s.includes('avgctr')) return 'ctr';
          if (s === 'avgpos' || s.includes('avgposition')) return 'avgpos';
          if (s === 'backlinks' || s.includes('backlink')) return 'backlinks';
          if (s === 'createdat' || s === 'created_at') return 'createdat';
          return s; // name/domain/createdat 等
        };
        const sortFieldServer = normalizeKey(String(rawKeyServer));
        const sortOrderParam = sortOrderServer === 'ascend' ? 'asc' : sortOrderServer === 'descend' ? 'desc' : 'desc';
        // 调试日志（仅开发）
        if (process.env.NODE_ENV !== 'production') {
          console.log('[Sites request] sorter raw:', sorter);
          console.log('[Sites request] parsed:', { sortFieldServer, sortOrderParam, hadSorter, state: { sortKey, sortOrder } });
        }

        // 批量加载指标（服务端排序，仅对指标类字段生效）
        const metricKeys = new Set(['pv','uv','au','sessions','avgsessionduration','bouncerate','clicks','impr','ctr','avgpos','backlinks']);
        const metricsRes: any = await client.get(`/sites/metrics`, {
          params: { page, pageSize, days }
        });
        const metricsMap = (metricsRes as any).data?.metrics || {};
        let data = (items as Site[]).map((s: Site) => ({ ...s, metrics: (metricsMap as any)[s.id] }));
        if (metricKeys.has(sortFieldServer) && hadSorter) {
          // 在客户端按指标字段排序（当前页内排序，避免受持久化状态影响）
          const orderAsc = sortOrderParam === 'asc';
          const getVal = (row: any) => {
            const m = row.metrics || {};
            switch (sortFieldServer) {
              case 'pv': return m?.traffic?.totalPv ?? null;
              case 'uv': return m?.traffic?.totalUv ?? null;
              case 'au': return m?.traffic?.totalActiveUsers ?? null;
              case 'sessions': return m?.traffic?.totalSessions ?? null;
              case 'avgsessionduration': return Number(m?.traffic?.avgSessionDuration ?? 0);
              case 'bouncerate': {
                const rate = Number(m?.traffic?.avgBounceRate ?? 0);
                // 转换为百分比用于排序
                return rate < 2 ? rate * 100 : rate;
              }
              case 'clicks': return m?.gsc?.totalClicks ?? null;
              case 'impr': return m?.gsc?.totalImpressions ?? null;
              case 'ctr': return Number(m?.gsc?.avgCtr ?? 0);
              case 'avgpos': return Number(m?.gsc?.avgPosition ?? 0);
              case 'backlinks': return Number(m?.backlinksCount ?? 0);
              default: return null;
            }
          };
          data = data.sort((a, b) => {
            const av = getVal(a);
            const bv = getVal(b);
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') return orderAsc ? av - bv : bv - av;
            const as = String(av); const bs = String(bv);
            return orderAsc ? as.localeCompare(bs) : bs.localeCompare(as);
          });
        } else if (!metricKeys.has(sortFieldServer) && hadSorter) {
          // 非指标字段，本地排序兜底（name/domain/createdAt）
          const key = sortFieldServer;
          const orderAsc = sortOrderParam === 'asc';
          data = data.sort((a: any, b: any) => {
            let av: any;
            let bv: any;
            if (key === 'name') { av = a.name; bv = b.name; }
            else if (key === 'domain') { av = a.domain; bv = b.domain; }
            else if (key === 'createdat' || key === 'created_at' || key === 'createdtime') { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
            else { return 0; }
            if (av == null && bv == null) return 0;
            if (av == null) return 1;
            if (bv == null) return -1;
            if (typeof av === 'number' && typeof bv === 'number') return orderAsc ? av - bv : bv - av;
            const as = String(av); const bs = String(bv);
            return orderAsc ? as.localeCompare(bs) : bs.localeCompare(as);
          });
        } else if (!hadSorter) {
          // 默认：按 PV 降序（仅当用户未主动排序时）
          data = data.sort((a: any, b: any) => {
            const av = a?.metrics?.traffic?.totalPv ?? 0;
            const bv = b?.metrics?.traffic?.totalPv ?? 0;
            return bv - av;
          });
        }

        return { data, success: true, total: res.data.total } as any;
      }}
    />
  );
}
