'use client';

import React, { useState } from 'react';
import { TrendingUp, Calendar, DollarSign, Receipt } from 'lucide-react';

interface DailyTrendItem {
  date: string;
  label: string;
  sales: number;
  count: number;
}

interface SalesTrendChartProps {
  data: DailyTrendItem[];
  currency?: string;
  isRtl?: boolean;
}

export function SalesTrendChart({
  data = [],
  currency = 'ج.م',
  isRtl = true,
}: SalesTrendChartProps) {
  const [metric, setMetric] = useState<'sales' | 'count'>('sales');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Fallback data if empty
  const chartData = data.length > 0 ? data : [
    { date: '1', label: 'السبت', sales: 1200, count: 8 },
    { date: '2', label: 'الأحد', sales: 1850, count: 14 },
    { date: '3', label: 'الإثنين', sales: 2400, count: 18 },
    { date: '4', label: 'الثلاثاء', sales: 2100, count: 15 },
    { date: '5', label: 'الأربعاء', sales: 3200, count: 24 },
    { date: '6', label: 'الخميس', sales: 4800, count: 35 },
    { date: '7', label: 'الجمعة', sales: 3900, count: 28 },
  ];

  const values = chartData.map(d => metric === 'sales' ? d.sales : d.count);
  const maxVal = Math.max(...values, 10);
  const minVal = 0;
  const range = maxVal - minVal;

  const totalValue = values.reduce((sum, v) => sum + v, 0);
  const avgValue = Math.round(totalValue / values.length);

  // SVG Coordinates calculation
  const width = 640;
  const height = 210;
  const paddingX = 40;
  const paddingY = 25;
  const effectiveWidth = width - paddingX * 2;
  const effectiveHeight = height - paddingY * 2;

  const points = chartData.map((d, i) => {
    const val = metric === 'sales' ? d.sales : d.count;
    const x = paddingX + (i / (chartData.length - 1)) * effectiveWidth;
    const y = height - paddingY - (val / maxVal) * effectiveHeight;
    return { x, y, val, label: d.label, date: d.date };
  });

  // Curve Generator
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    pathD += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  const themeColor = metric === 'sales' ? '#246BFD' : '#10B981';

  return (
    <div className="bg-white rounded-2xl border border-[#E5EAF2] p-5 shadow-2xs hover:shadow-md transition-all duration-300">
      
      {/* Header & Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#246BFD]">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#0B1730]">
                {isRtl ? 'حركة المبيعات خلال الـ 7 أيام الماضية' : 'Sales & Revenue 7-Day Trend'}
              </h3>
              <p className="text-[11px] text-[#687386]">
                {isRtl ? `إجمالي الفترة: ${totalValue.toLocaleString()} ${metric === 'sales' ? currency : 'فاتورة'}` : `Period Total: ${totalValue.toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Selector Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F4F6F9] rounded-xl self-start sm:self-auto border border-[#E5EAF2]">
          <button
            type="button"
            onClick={() => setMetric('sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              metric === 'sales'
                ? 'bg-white text-[#246BFD] shadow-xs'
                : 'text-[#687386] hover:text-[#0B1730]'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الإيرادات المالية' : 'Revenue'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMetric('count')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              metric === 'count'
                ? 'bg-white text-[#10B981] shadow-xs'
                : 'text-[#687386] hover:text-[#0B1730]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{isRtl ? 'عدد الفواتير' : 'Invoices'}</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative w-full overflow-hidden" onMouseLeave={() => setHoveredIdx(null)}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-48 sm:h-56 select-none overflow-visible"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.28" />
              <stop offset="60%" stopColor={themeColor} stopOpacity="0.08" />
              <stop offset="100%" stopColor={themeColor} stopOpacity="0.0" />
            </linearGradient>
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Horizontal Grid Lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = height - paddingY - pct * effectiveHeight;
            const gridVal = Math.round(minVal + pct * range);
            return (
              <g key={idx}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#EEF2F6"
                  strokeDasharray={pct === 0 ? 'none' : '3 3'}
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="10"
                  fill="#94A3B8"
                  className="font-mono font-medium"
                >
                  {gridVal >= 1000 ? `${(gridVal / 1000).toFixed(1)}k` : gridVal}
                </text>
              </g>
            );
          })}

          {/* Average Reference Line */}
          {avgValue > 0 && (
            <line
              x1={paddingX}
              y1={height - paddingY - (avgValue / maxVal) * effectiveHeight}
              x2={width - paddingX}
              y2={height - paddingY - (avgValue / maxVal) * effectiveHeight}
              stroke="#CBD5E1"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          )}

          {/* Shaded Area Under Curve */}
          <path d={areaD} fill="url(#trendGradient)" />

          {/* Smooth Curve Line */}
          <path
            d={pathD}
            fill="none"
            stroke={themeColor}
            strokeWidth="2.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glowEffect)"
          />

          {/* Data Points and Interaction Circles */}
          {points.map((p, i) => {
            const isHovered = hoveredIdx === i;
            return (
              <g
                key={i}
                className="cursor-pointer group"
                onMouseEnter={() => setHoveredIdx(i)}
              >
                {/* Vertical Cursor on hover */}
                {isHovered && (
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={height - paddingY}
                    stroke={themeColor}
                    strokeDasharray="2 2"
                    strokeWidth="1.5"
                    opacity="0.6"
                  />
                )}

                {/* Outer halo */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isHovered ? 8 : 4.5}
                  fill={isHovered ? themeColor : '#ffffff'}
                  stroke={themeColor}
                  strokeWidth="2.5"
                  className="transition-all duration-200"
                />

                {/* Center dot */}
                {isHovered && (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3"
                    fill="#ffffff"
                  />
                )}

                {/* X-axis Day Label */}
                <text
                  x={p.x}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fill={isHovered ? '#0B1730' : '#64748B'}
                >
                  {p.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIdx !== null && points[hoveredIdx] && (
          <div
            className="absolute pointer-events-none -translate-x-1/2 -translate-y-full bg-gray-900/95 text-white px-3 py-1.5 rounded-xl text-xs shadow-xl backdrop-blur-md transition-all duration-150 z-20 border border-gray-700"
            style={{
              left: `${(points[hoveredIdx].x / width) * 100}%`,
              top: `${(points[hoveredIdx].y / height) * 100}%`,
              marginTop: '-10px',
            }}
          >
            <p className="font-bold text-gray-300 text-[10px]">{points[hoveredIdx].label} ({points[hoveredIdx].date})</p>
            <p className="font-extrabold text-sm text-white">
              {metric === 'sales'
                ? `${points[hoveredIdx].val.toLocaleString()} ${currency}`
                : `${points[hoveredIdx].val} ${isRtl ? 'فاتورة' : 'bills'}`}
            </p>
          </div>
        )}
      </div>

      {/* Footer Info / Average Tag */}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-[#F1F4F9] text-xs text-[#687386]">
        <span>
          {isRtl ? 'المتوسط اليومي للفترة:' : 'Daily Average:'} <strong className="text-[#0B1730]">{avgValue.toLocaleString()} {metric === 'sales' ? currency : (isRtl ? 'فاتورة' : 'bills')}</strong>
        </span>
        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
          ● {isRtl ? 'تحديث لحظي' : 'Live Updated'}
        </span>
      </div>

    </div>
  );
}
