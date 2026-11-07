'use client';

import React, { useMemo } from 'react';
import { encodeCode128 } from '@/lib/barcode/code128';

interface BarcodeSvgProps {
  value: string;
  height?: number;
  showText?: boolean;
  className?: string;
}

export function BarcodeSvg({
  value,
  height = 50,
  showText = true,
  className = '',
}: BarcodeSvgProps) {
  const { totalWidth, bars } = useMemo(() => {
    return encodeCode128(value);
  }, [value]);

  if (!value) return null;

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full h-auto max-h-[60px]"
        preserveAspectRatio="none"
        shapeRendering="crispEdges"
      >
        <rect x="0" y="0" width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y="0"
            width={bar.width}
            height={height}
            fill="#000000"
          />
        ))}
      </svg>
      {showText && (
        <span className="font-mono text-[11px] tracking-[0.2em] font-bold text-black mt-0.5 text-center">
          {value}
        </span>
      )}
    </div>
  );
}
