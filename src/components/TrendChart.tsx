'use client';

import { useState, useRef } from 'react';
import { useTheme } from './ThemeContext';

interface DailyData {
  date: string;
  pv?: number;
  uv?: number;
  activeUsers?: number;
  newUsers?: number;
  events?: number;
  sessions?: number;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface TrendChartProps {
  data: DailyData[];
  includeGSC?: boolean; // Show GSC clicks instead of GA PV
}

export default function TrendChart({ data, includeGSC = false }: TrendChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { isDark } = useTheme();

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // 转换到SVG坐标系
    const svgX = (x / rect.width) * 140;

    const padding = 2;
    const chartWidth = 140 - padding * 2;
    const pointSpacing = chartWidth / (data.length - 1 || 1);

    // 找到最近的数据点
    const index = Math.round((svgX - padding) / pointSpacing);
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      setMouseX(padding + index * pointSpacing);
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setMouseX(null);
  };

  const maxPv = Math.max(...data.map((d) => d.pv || 0), 1);
  const maxClicks = Math.max(...data.map((d) => d.clicks || 0), 1);
  const maxActiveUsers = Math.max(...data.map((d) => d.activeUsers || 0), 1);
  const padding = 2;
  const chartWidth = 140 - padding * 2;
  const chartHeight = 40 - padding * 2;
  const pointSpacing = chartWidth / (data.length - 1 || 1);

  // 生成主线路径和点（PV或Clicks）
  const mainMetric = includeGSC ? 'clicks' : 'pv';
  const mainMax = includeGSC ? maxClicks : maxPv;

  const mainPoints = data.map((day, idx) => {
    const x = padding + idx * pointSpacing;
    const value = includeGSC ? (day.clicks || 0) : (day.pv || 0);
    const y = padding + chartHeight - (value / mainMax) * chartHeight;
    return { x, y, ...day };
  });

  const mainPathData = mainPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // 生成副线路径和点（AU或Impressions）
  const secondaryMetric = includeGSC ? 'impressions' : 'activeUsers';
  const secondaryMax = includeGSC
    ? Math.max(...data.map((d) => d.impressions || 0), 1)
    : maxActiveUsers;

  const secondaryPoints = data.map((day, idx) => {
    const x = padding + idx * pointSpacing;
    const value = includeGSC ? (day.impressions || 0) : (day.activeUsers || 0);
    const y = padding + chartHeight - (value / secondaryMax) * chartHeight;
    return { x, y, ...day };
  });

  const secondaryPathData = secondaryPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const points = mainPoints;
  const pathData = mainPathData;

  const hoveredPoint = hoveredIndex !== null ? points[hoveredIndex] : null;

  const mainColor = isDark ? '#6366f1' : '#3b82f6';
  const secondaryColor = isDark ? '#f59e0b' : '#ef4444';
  const gridColor = isDark ? '#475569' : '#cbd5e1';

  return (
    <div className="relative inline-block">
      <svg
        ref={svgRef}
        width="120"
        height="35"
        className="inline-block cursor-crosshair"
        viewBox="0 0 140 40"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* 背景 */}
        <rect width="140" height="40" fill="none" />

        {/* 渐变区域 */}
        <defs>
          <linearGradient id="gradient-pv" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={mainColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={mainColor} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient-au" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={secondaryColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={secondaryColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* 主指标填充区域 */}
        <path
          d={`${pathData} L ${points[points.length - 1].x} ${padding + chartHeight} L ${points[0].x} ${padding + chartHeight} Z`}
          fill="url(#gradient-pv)"
        />

        {/* 主指标折线 */}
        <path
          d={pathData}
          stroke={mainColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 副指标折线 */}
        <path
          d={secondaryPathData}
          stroke={secondaryColor}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 数据点 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIndex === i ? '3.5' : '2.5'}
            fill={mainColor}
            opacity={hoveredIndex === i ? '1' : '0.8'}
            className="transition-all"
          />
        ))}

        {/* 跟随鼠标的竖线 */}
        {mouseX !== null && (
          <line
            x1={mouseX}
            y1={padding}
            x2={mouseX}
            y2={padding + chartHeight}
            stroke={gridColor}
            strokeWidth="1"
            opacity="0.6"
          />
        )}
      </svg>

      {/* 数据提示框 */}
      {hoveredPoint && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-50 pointer-events-none">
          <div>{hoveredPoint.date}</div>
          <div style={{ color: '#3b82f6' }}>
            {includeGSC ? 'Clicks' : 'PV'}: {includeGSC ? hoveredPoint.clicks || 0 : hoveredPoint.pv || 0}
          </div>
          <div style={{ color: '#ef4444' }}>
            {includeGSC ? 'Impr' : 'AU'}: {includeGSC ? hoveredPoint.impressions || 0 : hoveredPoint.activeUsers || 0}
          </div>
        </div>
      )}
    </div>
  );
}
