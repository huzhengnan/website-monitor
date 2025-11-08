'use client';

import { useEffect, useRef } from 'react';
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

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize chart
    if (!chartRef.current) {
      chartRef.current = echarts.init(containerRef.current);
    }

    // Chart configuration
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
            color: '#666' as any,
            fontSize: 12,
          },
        } as any,
        splitLine: {
          lineStyle: {
            color: ['#ddd', '#eee', '#f5f5f5', '#fafafa'],
          },
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: [
              'rgba(240, 240, 240, 0.1)',
              'rgba(240, 240, 240, 0.2)',
              'rgba(240, 240, 240, 0.3)',
              'rgba(240, 240, 240, 0.4)',
            ],
          },
        },
        axisLine: {
          lineStyle: {
            color: '#ccc',
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
                    color: 'rgba(59, 130, 246, 0.5)',
                  },
                  {
                    offset: 1,
                    color: 'rgba(59, 130, 246, 0.1)',
                  },
                ]),
              },
              lineStyle: {
                color: '#3b82f6',
                width: 2,
              },
              itemStyle: {
                color: '#3b82f6',
                borderColor: '#fff',
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
      className="rounded-lg bg-white"
    />
  );
}
