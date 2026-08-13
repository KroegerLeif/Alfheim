import React from 'react';

interface AlfheimLogoProps {
  className?: string;
  size?: number;
}

export const AlfheimLogo: React.FC<AlfheimLogoProps> = ({ className = 'w-8 h-8', size = 32 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="alfheim-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#60beff" />
          <stop offset="100%" stopColor="#0077cc" />
        </linearGradient>
        <linearGradient id="alfheim-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#3eb1ff" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#3eb1ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Outer Hex Shield */}
      <polygon
        points="50,6 90,28 90,72 50,94 10,72 10,28"
        stroke="url(#alfheim-grad)"
        strokeWidth="4"
        fill="#111b33"
        fillOpacity="0.6"
      />
      {/* Inner Rune / Core Monogram */}
      <path
        d="M50 20 L76 68 L24 68 Z"
        stroke="#3eb1ff"
        strokeWidth="4.5"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="50" cy="52" r="8" fill="url(#alfheim-grad)" />
      <line x1="50" y1="20" x2="50" y2="44" stroke="#60beff" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
};
