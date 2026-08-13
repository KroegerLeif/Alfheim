import React from 'react';

interface AlfiMascotProps {
  className?: string;
  size?: number;
}

export const AlfiMascot: React.FC<AlfiMascotProps> = ({ className = 'w-48 h-48', size = 192 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <radialGradient id="alfi-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3eb1ff" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0b1326" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="body-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#182542" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="visor-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00d2ff" />
          <stop offset="50%" stopColor="#3eb1ff" />
          <stop offset="100%" stopColor="#00f0ff" />
        </linearGradient>
        <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Ambient background glow */}
      <circle cx="120" cy="120" r="100" fill="url(#alfi-glow)" />

      {/* Outer Floating Ring (Orbit) */}
      <ellipse
        cx="120"
        cy="120"
        rx="105"
        ry="38"
        stroke="#3eb1ff"
        strokeWidth="2"
        strokeDasharray="6 8"
        strokeOpacity="0.6"
        transform="rotate(-15 120 120)"
      />

      {/* Satellite Node */}
      <circle cx="30" cy="140" r="4.5" fill="#60beff" filter="url(#neon-glow)" />
      <circle cx="210" cy="100" r="3.5" fill="#3eb1ff" filter="url(#neon-glow)" />

      {/* Antenna & Beacon */}
      <line x1="120" y1="42" x2="120" y2="70" stroke="#3eb1ff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="120" cy="38" r="7" fill="#60beff" filter="url(#neon-glow)" />

      {/* Bot Head / Chassis */}
      <rect
        x="65"
        y="68"
        width="110"
        height="100"
        rx="36"
        fill="url(#body-grad)"
        stroke="#3eb1ff"
        strokeWidth="3"
        strokeOpacity="0.8"
      />

      {/* Visor Area */}
      <rect
        x="80"
        y="92"
        width="80"
        height="42"
        rx="16"
        fill="#080e1e"
        stroke="rgba(62, 177, 255, 0.4)"
        strokeWidth="1.5"
      />

      {/* Expressive Visor Glowing Eyes */}
      <rect x="94" y="104" width="18" height="16" rx="5" fill="url(#visor-grad)" filter="url(#neon-glow)" />
      <rect x="128" y="104" width="18" height="16" rx="5" fill="url(#visor-grad)" filter="url(#neon-glow)" />
      
      {/* Eye Highlights */}
      <circle cx="106" cy="108" r="2.5" fill="#ffffff" />
      <circle cx="140" cy="108" r="2.5" fill="#ffffff" />

      {/* Ear Pylons / Audio Sensors */}
      <rect x="52" y="98" width="14" height="30" rx="6" fill="#182542" stroke="#3eb1ff" strokeWidth="2" />
      <rect x="174" y="98" width="14" height="30" rx="6" fill="#182542" stroke="#3eb1ff" strokeWidth="2" />

      {/* Floating Thruster Base Aura */}
      <ellipse cx="120" cy="180" rx="28" ry="8" fill="#3eb1ff" fillOpacity="0.4" filter="url(#neon-glow)" />
      <path
        d="M102 168 L120 188 L138 168 Z"
        fill="#182542"
        stroke="#3eb1ff"
        strokeWidth="2"
      />
    </svg>
  );
};
