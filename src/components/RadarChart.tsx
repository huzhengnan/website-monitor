'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';
import * as echarts from 'echarts';

interface RadarChartProps {
  data: {
    composite: number;
    market: number;
    quality: number;
    seo: number;
    traffic: number;
    revenue: number;
  };
  height?: number;
  showLegend?: boolean;
}

export default function RadarChart({
  data,
  height = 400,
  showLegend = true,
}: RadarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const { isDark } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize chart
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }

    // Chart configuration
    const gridColor = isDark ? '#334155' : '#e5e7eb';
    const axisColor = isDark ? '#64748b' : '#94a3b8';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const mainColor = '#3b82f6';
    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}',
      },
      legend: showLegend
        ? {
            orient: 'vertical',
            right: 10,
            top: 'center',
            data: ['Score'],
          }
        : undefined,
      radar: {
        indicator: [
          { name: 'Market', max: 100 },
          { name: 'Quality', max: 100 },
          { name: 'SEO', max: 100 },
          { name: 'Traffic', max: 100 },
          { name: 'Revenue', max: 100 },
        ],
        shape: 'polygon',
        splitNumber: 4,
        name: {
          textStyle: {
            color: textColor as any,
            fontSize: 12,
          },
        } as any,
        splitLine: {
          lineStyle: {
            color: [gridColor, gridColor, gridColor, gridColor],
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: isDark
              ? ['rgba(30,41,59,0.10)', 'rgba(30,41,59,0.12)', 'rgba(30,41,59,0.14)', 'rgba(30,41,59,0.16)']
              : ['rgba(240,240,240,0.10)', 'rgba(240,240,240,0.12)', 'rgba(240,240,240,0.14)', 'rgba(240,240,240,0.16)'],
          },
        },
        axisLine: {
          lineStyle: {
            color: axisColor,
          },
        },
      },
      series: [
        {
          name: 'Score',
          type: 'radar',
          data: [
            {
              value: [
                data.market,
                data.quality,
                data.seo,
                data.traffic,
                data.revenue,
              ],
              name: 'Evaluation',
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  {
                    offset: 0,
                    color: isDark ? 'rgba(99, 102, 241, 0.45)' : 'rgba(59, 130, 246, 0.5)',
                  },
                  {
                    offset: 1,
                    color: isDark ? 'rgba(99, 102, 241, 0.08)' : 'rgba(59, 130, 246, 0.1)',
                  },
                ]),
              },
              lineStyle: {
                color: isDark ? '#6366f1' : mainColor,
                width: 2,
              },
              itemStyle: {
                color: isDark ? '#6366f1' : mainColor,
                borderColor: isDark ? '#0b1220' : '#fff',
                borderWidth: 2,
              },
            },
          ],
        },
      ],
    };

    chartRef.current.setOption(option);

    // Handle window resize
    const handleResize = () => {
      chartRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, showLegend]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px` }}
      className="rounded-lg bg-card"
    />
  );
}
