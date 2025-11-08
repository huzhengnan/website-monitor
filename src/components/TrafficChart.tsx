'use client';

import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';

interface DailyTrendData {
  date: string;
  pv: number;
  uv: number;
  sessions: number;
  bounceRate: number;
}

interface TrafficChartProps {
  data: DailyTrendData[];
  type: 'trend' | 'compare';
}

export default function TrafficChart({ data, type }: TrafficChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    const chart = echarts.init(chartRef.current);

    if (type === 'trend') {
      const option = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderColor: '#666',
          borderWidth: 1,
          textStyle: { color: '#fff', fontSize: 12 },
          axisPointer: {
            type: 'cross',
            lineStyle: {
              color: '#999',
              width: 2,
              type: 'solid',
            },
            crossStyle: {
              color: '#999',
              width: 1,
            },
          },
          formatter: (params: any) => {
            if (Array.isArray(params) && params.length > 0) {
              let result = `<div style="margin-bottom: 8px; font-weight: bold; color: #fff;">${params[0].axisValue}</div>`;
              params.forEach((param) => {
                if (param.value !== undefined && param.value !== null) {
                  result += `<div style="color: ${param.color}; margin: 4px 0;">
                    ${param.seriesName}: <strong>${param.value.toLocaleString()}</strong>
                  </div>`;
                }
              });
              return result;
            }
            return '';
          },
          confine: true,
          transitionDuration: 0,
        },
        legend: {
          data: ['PV', 'UV', '会话数', '跳出率'],
          bottom: 0,
          textStyle: { color: '#666', fontSize: 12 },
        },
        grid: {
          left: '3%',
          right: '3%',
          top: '10%',
          bottom: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: data.map((d) => d.date),
          boundaryGap: false,
          axisLine: { lineStyle: { color: '#ddd' } },
          axisLabel: { color: '#666', fontSize: 11 },
        },
        yAxis: [
          {
            type: 'value',
            name: 'PV / UV / 会话',
            position: 'left',
            axisLine: { lineStyle: { color: '#ddd' } },
            axisLabel: { color: '#666', fontSize: 11 },
            splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
          },
          {
            type: 'value',
            name: '跳出率 (%)',
            position: 'right',
            axisLine: { lineStyle: { color: '#ddd' } },
            axisLabel: { color: '#666', fontSize: 11 },
            splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
          },
        ],
        series: [
          {
            name: 'PV',
            data: data.map((d) => d.pv),
            type: 'line',
            smooth: true,
            yAxisIndex: 0,
            lineStyle: { width: 2.5 },
            itemStyle: { color: '#4F46E5', borderColor: '#fff', borderWidth: 1 },
            areaStyle: { color: 'rgba(79, 70, 229, 0.15)' },
            symbolSize: 5,
            emphasis: { itemStyle: { borderWidth: 2 } },
          },
          {
            name: 'UV',
            data: data.map((d) => d.uv),
            type: 'line',
            smooth: true,
            yAxisIndex: 0,
            lineStyle: { width: 2.5 },
            itemStyle: { color: '#10B981', borderColor: '#fff', borderWidth: 1 },
            areaStyle: { color: 'rgba(16, 185, 129, 0.15)' },
            symbolSize: 5,
            emphasis: { itemStyle: { borderWidth: 2 } },
          },
          {
            name: '会话数',
            data: data.map((d) => d.sessions),
            type: 'line',
            smooth: true,
            yAxisIndex: 0,
            lineStyle: { width: 2.5 },
            itemStyle: { color: '#3B82F6', borderColor: '#fff', borderWidth: 1 },
            areaStyle: { color: 'rgba(59, 130, 246, 0.15)' },
            symbolSize: 5,
            emphasis: { itemStyle: { borderWidth: 2 } },
          },
          {
            name: '跳出率',
            data: data.map((d) => d.bounceRate),
            type: 'line',
            smooth: true,
            yAxisIndex: 1,
            lineStyle: { width: 2, type: 'dashed' },
            itemStyle: { color: '#F59E0B', borderColor: '#fff', borderWidth: 1 },
            symbolSize: 4,
            emphasis: { itemStyle: { borderWidth: 2 } },
          },
        ],
      };

      chart.setOption(option);
    } else if (type === 'compare') {
      const option = {
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          borderColor: '#666',
          borderWidth: 1,
          textStyle: { color: '#fff', fontSize: 12 },
          axisPointer: {
            type: 'shadow',
            shadowStyle: { color: 'rgba(150, 150, 150, 0.1)' },
          },
          formatter: (params: any) => {
            if (Array.isArray(params) && params.length > 0) {
              let result = `<div style="margin-bottom: 8px; font-weight: bold; color: #fff;">${params[0].axisValue}</div>`;
              params.forEach((param) => {
                if (param.value !== undefined && param.value !== null) {
                  result += `<div style="color: ${param.color}; margin: 4px 0;">
                    ${param.seriesName}: <strong>${param.value.toLocaleString()}</strong>
                  </div>`;
                }
              });
              return result;
            }
            return '';
          },
          confine: true,
        },
        legend: {
          data: ['PV', 'UV'],
          bottom: 0,
          textStyle: { color: '#666', fontSize: 12 },
        },
        grid: {
          left: '3%',
          right: '3%',
          top: '10%',
          bottom: '15%',
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: data.map((d) => d.date),
          axisLine: { lineStyle: { color: '#ddd' } },
          axisLabel: { color: '#666', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: '#ddd' } },
          axisLabel: { color: '#666', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
        },
        series: [
          {
            name: 'PV',
            data: data.map((d) => d.pv),
            type: 'bar',
            itemStyle: { color: '#4F46E5', borderRadius: [4, 4, 0, 0] },
            emphasis: { itemStyle: { color: '#6366f1', opacity: 0.9 } },
          },
          {
            name: 'UV',
            data: data.map((d) => d.uv),
            type: 'bar',
            itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] },
            emphasis: { itemStyle: { color: '#059669', opacity: 0.9 } },
          },
        ],
      };

      chart.setOption(option);
    }

    // Handle window resize
    const handleResize = () => {
      chart.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
    };
  }, [data, type]);

  return <div ref={chartRef} style={{ width: '100%', height: '400px' }} />;
}
