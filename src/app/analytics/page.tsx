'use client';

import { ProCard } from '@ant-design/pro-components';

export default function AnalyticsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-2">数据分析</h1>
      <p className="text-muted-foreground mb-8">全站数据分析和统计</p>

      <ProCard direction="column" ghost gutter={[16, 16]}>
        <ProCard gutter={16}>
          <ProCard title="全站概览" colSpan={{ xs: 24, md: 24, lg: 12 }} bordered>
            <div className="text-muted-foreground">概览图表区域（待接入）</div>
          </ProCard>
          <ProCard title="来源分布" colSpan={{ xs: 24, md: 24, lg: 12 }} bordered>
            <div className="text-muted-foreground">来源饼图/条形图（待接入）</div>
          </ProCard>
        </ProCard>
        <ProCard gutter={16}>
          <ProCard title="设备分布" colSpan={{ xs: 24, md: 12, lg: 8 }} bordered>
            <div className="text-muted-foreground">设备占比（待接入）</div>
          </ProCard>
          <ProCard title="Top 页面" colSpan={{ xs: 24, md: 12, lg: 8 }} bordered>
            <div className="text-muted-foreground">热门页面列表（待接入）</div>
          </ProCard>
          <ProCard title="趋势" colSpan={{ xs: 24, md: 24, lg: 8 }} bordered>
            <div className="text-muted-foreground">最近 30 天趋势（待接入）</div>
          </ProCard>
        </ProCard>
      </ProCard>
    </div>
  );
}
