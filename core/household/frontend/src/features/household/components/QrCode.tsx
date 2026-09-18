'use client';

import { useMemo } from 'react';
import { encode } from 'uqr';

interface QrCodeProps {
  value: string;
  label: string;
  className?: string;
}

/**
 * Scannable QR code rendered as an inline SVG from the `uqr` module matrix.
 * Drawn as a single path (one sub-path per dark module) so it stays crisp at
 * any size. Colors are fixed black-on-white: themed colors can break scanning.
 */
export function QrCode({ value, label, className = 'w-44 h-44' }: QrCodeProps) {
  const { size, path } = useMemo(() => {
    // Medium error correction, 2-module quiet zone (the wrapper adds padding).
    const qr = encode(value, { ecc: 'M', border: 2 });
    let d = '';
    qr.data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { size: qr.size, path: d };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label}
      data-qr-value={value}
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={size} height={size} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
