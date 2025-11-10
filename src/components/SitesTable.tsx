'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ExternalLink, Trash2, Copy, Check } from 'lucide-react';
import TrendChart from './TrendChart';

export interface Site {
  id: string;
  name: string;
  status: 'online' | 'maintenance' | 'offline';
}

export interface TrafficMetrics {
  totalActiveUsers: number;
  totalNewUsers: number;
  totalEvents: number;
  totalSessions: number;
  totalPv: number;
  dailyData: Array<{
    date: string;
    [key: string]: any;
  }>;
}

export interface GSCMetrics {
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
  dailyData: Array<{
    date: string;
    [key: string]: any;
  }>;
}

interface Row {
  site: Site;
  traffic: TrafficMetrics | null;
  gsc: GSCMetrics | null;
  loadingTraffic: boolean;
  loadingGsc: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  copiedId: string | null;
  setCopiedId: (id: string | null) => void;
}

const columnHelper = createColumnHelper<Row>();

export interface SitesTableProps {
  sites: Site[];
  trafficData: Record<string, TrafficMetrics>;
  gscData: Record<string, GSCMetrics>;
  loadingTraffic: Record<string, boolean>;
  loadingGsc: Record<string, boolean>;
  selectedIds: Set<string>;
  copiedId: string | null;
  onSelectAll: (checked: boolean) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  setCopiedId: (id: string | null) => void;
}

function SitesTableComponent({
  sites,
  trafficData,
  gscData,
  loadingTraffic,
  loadingGsc,
  selectedIds,
  copiedId,
  onSelectAll,
  onSelect,
  onDelete,
  setCopiedId,
}: SitesTableProps) {
  const data: Row[] = useMemo(() => sites.map((site) => ({
    site,
    traffic: trafficData[site.id] || null,
    gsc: gscData[site.id] || null,
    loadingTraffic: loadingTraffic[site.id] || false,
    loadingGsc: loadingGsc[site.id] || false,
    isSelected: selectedIds.has(site.id),
    onSelect,
    onDelete,
    copiedId,
    setCopiedId,
  })), [sites, trafficData, gscData, loadingTraffic, loadingGsc, selectedIds, copiedId, onSelect, onDelete, setCopiedId]);

  const columns = useMemo(() => [
    // 复选框列
    columnHelper.accessor((row) => row.site.id, {
      id: 'select',
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={
              table.getState().rowSelection
                ? Object.keys(table.getState().rowSelection).length === table.getRowModel().rows.length
                : false
            }
            onChange={(e) => {
              onSelectAll(e.target.checked);
            }}
            className="w-4 h-4 rounded border-border cursor-pointer"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={row.original.isSelected}
            onChange={() => row.original.onSelect(row.original.site.id)}
            className="w-4 h-4 rounded border-border cursor-pointer"
          />
        </div>
      ),
      size: 48,
      minSize: 48,
      maxSize: 48,
    }),

    // 站点名称列
    columnHelper.accessor((row) => row.site.name, {
      id: 'name',
      header: '站点名称',
      cell: ({ row }) => (
        <Link
          href={`/sites/${row.original.site.id}`}
          className="font-semibold text-indigo-600 hover:text-indigo-700 truncate block"
          title={row.original.site.name}
        >
          {row.original.site.name}
        </Link>
      ),
      size: 160,
      minSize: 160,
      maxSize: 160,
    }),

    // UUID列
    columnHelper.accessor((row) => row.site.id, {
      id: 'uuid',
      header: 'UUID',
      cell: ({ row }) => {
        const formatUuid = (uuid: string) => {
          if (uuid.length <= 10) return uuid;
          return `${uuid.slice(0, 5)}...${uuid.slice(-5)}`;
        };
        return (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground truncate font-mono text-xs" title={row.original.site.id}>
              {formatUuid(row.original.site.id)}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(row.original.site.id);
                row.original.setCopiedId(row.original.site.id);
                setTimeout(() => row.original.setCopiedId(null), 2000);
              }}
              title="复制站点 ID"
              className="text-muted-foreground hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex-shrink-0"
            >
              {copiedId === row.original.site.id ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        );
      },
      size: 96,
      minSize: 96,
      maxSize: 96,
    }),

    // 状态列
    columnHelper.accessor((row) => row.site.status, {
      id: 'status',
      header: '状态',
      cell: ({ row }) => {
        const status = row.original.site.status;
        return (
          <span
            className={`px-2 py-1 rounded text-xs font-semibold whitespace-nowrap inline-block ${
              status === 'online'
                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                : status === 'maintenance'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
            }`}
          >
            {status === 'online' ? '在线' : status === 'maintenance' ? '维护中' : '离线'}
          </span>
        );
      },
      size: 64,
      minSize: 64,
      maxSize: 64,
    }),

    // GA: 活跃用户
    columnHelper.accessor((row) => row.traffic?.totalActiveUsers || 0, {
      id: 'activeUsers',
      header: '活跃用户',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.loadingTraffic ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.traffic?.totalActiveUsers || 0}
            </div>
          )}
        </div>
      ),
      size: 96,
      minSize: 96,
      maxSize: 96,
    }),

    // GA: 新用户
    columnHelper.accessor((row) => row.traffic?.totalNewUsers || 0, {
      id: 'newUsers',
      header: '新用户',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.loadingTraffic ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.traffic?.totalNewUsers || 0}
            </div>
          )}
        </div>
      ),
      size: 96,
      minSize: 96,
      maxSize: 96,
    }),

    // GA: 事件
    columnHelper.accessor((row) => row.traffic?.totalEvents || 0, {
      id: 'events',
      header: '事件',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.loadingTraffic ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.traffic?.totalEvents || 0}
            </div>
          )}
        </div>
      ),
      size: 80,
      minSize: 80,
      maxSize: 80,
    }),

    // GA: Sessions
    columnHelper.accessor((row) => row.traffic?.totalSessions || 0, {
      id: 'sessions',
      header: 'Sessions',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.loadingTraffic ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.traffic?.totalSessions || 0}
            </div>
          )}
        </div>
      ),
      size: 80,
      minSize: 80,
      maxSize: 80,
    }),

    // GA: PV
    columnHelper.accessor((row) => row.traffic?.totalPv || 0, {
      id: 'pv',
      header: 'PV',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.loadingTraffic ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.traffic?.totalPv || 0}
            </div>
          )}
        </div>
      ),
      size: 80,
      minSize: 80,
      maxSize: 80,
    }),

    // GSC: 点击数
    columnHelper.accessor((row) => row.gsc?.totalClicks || 0, {
      id: 'clicks',
      header: () => <div className="text-indigo-600 dark:text-indigo-400">点击数</div>,
      cell: ({ row }) => (
        <div className="text-center bg-indigo-50 dark:bg-indigo-900/20">
          {row.original.loadingGsc ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.gsc?.totalClicks || 0}
            </div>
          )}
        </div>
      ),
      size: 96,
      minSize: 96,
      maxSize: 96,
    }),

    // GSC: 展示数
    columnHelper.accessor((row) => row.gsc?.totalImpressions || 0, {
      id: 'impressions',
      header: () => <div className="text-indigo-600 dark:text-indigo-400">展示数</div>,
      cell: ({ row }) => (
        <div className="text-center bg-indigo-50 dark:bg-indigo-900/20">
          {row.original.loadingGsc ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.gsc?.totalImpressions || 0}
            </div>
          )}
        </div>
      ),
      size: 96,
      minSize: 96,
      maxSize: 96,
    }),

    // GSC: CTR
    columnHelper.accessor((row) => row.gsc?.avgCtr || 0, {
      id: 'ctr',
      header: () => <div className="text-indigo-600 dark:text-indigo-400">CTR</div>,
      cell: ({ row }) => (
        <div className="text-center bg-indigo-50 dark:bg-indigo-900/20">
          {row.original.loadingGsc ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.gsc?.avgCtr ? row.original.gsc.avgCtr.toFixed(2) : 0}%
            </div>
          )}
        </div>
      ),
      size: 80,
      minSize: 80,
      maxSize: 80,
    }),

    // GSC: 排名
    columnHelper.accessor((row) => row.gsc?.avgPosition || 0, {
      id: 'position',
      header: () => <div className="text-indigo-600 dark:text-indigo-400">排名</div>,
      cell: ({ row }) => (
        <div className="text-center bg-indigo-50 dark:bg-indigo-900/20">
          {row.original.loadingGsc ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : (
            <div className="font-semibold text-foreground text-sm">
              {row.original.gsc?.avgPosition ? row.original.gsc.avgPosition.toFixed(1) : 0}
            </div>
          )}
        </div>
      ),
      size: 80,
      minSize: 80,
      maxSize: 80,
    }),

    // 趋势图
    columnHelper.accessor((row) => row.traffic?.dailyData || [], {
      id: 'trend',
      header: '趋势',
      cell: ({ row }) => (
        <div className="text-center">
          {row.original.loadingTraffic ? (
            <div className="text-muted-foreground text-xs">加载中</div>
          ) : row.original.traffic?.dailyData && row.original.traffic.dailyData.length > 0 ? (
            <TrendChart data={row.original.traffic.dailyData} includeGSC={false} />
          ) : (
            <div className="text-muted-foreground text-xs">无数据</div>
          )}
        </div>
      ),
      size: 112,
      minSize: 112,
      maxSize: 112,
    }),

    // 操作
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <div className="flex items-center justify-center gap-2">
          <Link
            href={`/sites/${row.original.site.id}`}
            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            title="查看详情"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
          <button
            onClick={() => row.original.onDelete(row.original.site.id, row.original.site.name)}
            className="text-red-600 hover:text-red-700"
            title="删除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
      size: 64,
      minSize: 64,
      maxSize: 64,
    }),
  ], [onSelectAll, onSelect, onDelete, setCopiedId, copiedId]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="bg-card text-card-foreground rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-muted/30 sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap border-r border-border last:border-r-0"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: cell.column.getSize() }}
                    className="px-3 py-4 border-r border-border last:border-r-0 whitespace-nowrap"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default React.memo(SitesTableComponent);
