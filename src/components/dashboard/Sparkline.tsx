'use client';

import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string; // hex or tailwind stroke e.g. '#10B981', '#246BFD', '#F59E0B'
  height?: number;
  width?: number;
  className?: string;
}

export function Sparkline({
  data = [10, 15, 8, 22, 18, 25, 30],
  color = '#246BFD',
  height = 36,
  width = 110,
  className = '',
}: SparklineProps) {
  if (!data || data.length < 2) {
    data = [5, 10, 8, 15, 12, 18, 20];
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const paddingY = 4;
  const effectiveHeight = height - paddingY * 2;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * (width - 4) + 2;
    const y = height - paddingY - ((val - min) / range) * effectiveHeight;
    return { x, y };
  });

  // Build smooth Bezier SVG curve
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const midX = (p0.x + p1.x) / 2;
    pathD += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  const gradientId = `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className={`relative shrink-0 overflow-hidden ${className}`} style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gradient fill underneath */}
        <path d={areaD} fill={`url(#${gradientId})`} />

        {/* Glowing stroke line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-700"
        />

        {/* Last Point Pulse Dot */}
        {points.length > 0 && (
          <>
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="4"
              fill={color}
              className="animate-ping opacity-75"
            />
            <circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r="3"
              fill="#ffffff"
              stroke={color}
              strokeWidth="2"
            />
          </>
        )}
      </svg>
    </div>
  );
}
