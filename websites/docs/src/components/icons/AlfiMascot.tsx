import React from 'react';
import { AlfiState, ALFI_MASCOT_ASSETS } from '@alfheim/shared';

interface AlfiMascotProps {
  className?: string;
  size?: number;
  state?: AlfiState;
  onClick?: () => void;
}

export const AlfiMascot: React.FC<AlfiMascotProps> = ({
  className = 'w-48 h-48',
  size = 192,
  state = 'idle',
  onClick,
}) => {
  const assetPath = ALFI_MASCOT_ASSETS[state] || ALFI_MASCOT_ASSETS.idle;

  // Theme color maps for states
  const stateTheme = {
    idle: { glow: '#3eb1ff', ring: '#3eb1ff', ringRotate: -15, eyeVisor: ['#00d2ff', '#3eb1ff'], body: ['#182542', '#0f172a'] },
    thinking: { glow: '#a855f7', ring: '#a855f7', ringRotate: -30, eyeVisor: ['#c084fc', '#a855f7'], body: ['#241b47', '#0f172a'] },
    loading: { glow: '#00f0ff', ring: '#00f0ff', ringRotate: 25, eyeVisor: ['#38f4ff', '#00f0ff'], body: ['#0e2a47', '#071728'] },
    sleeping: { glow: '#1e293b', ring: '#334155', ringRotate: -5, eyeVisor: ['#3eb1ff', '#3eb1ff'], body: ['#131b2e', '#090e1a'] },
    curious: { glow: '#f59e0b', ring: '#fbbf24', ringRotate: -8, eyeVisor: ['#fbbf24', '#3eb1ff'], body: ['#1f293d', '#0f172a'] },
  }[state];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} cursor-pointer transition-all duration-300`}
      onClick={onClick}
      data-state={state}
      data-asset={assetPath}
    >
      <defs>
        <radialGradient id={`alfi-glow-${state}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={stateTheme.glow} stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0b1326" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`body-grad-${state}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={stateTheme.body[0]} />
          <stop offset="100%" stopColor={stateTheme.body[1]} />
        </linearGradient>
        <linearGradient id={`visor-grad-${state}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stateTheme.eyeVisor[0]} />
          <stop offset="100%" stopColor={stateTheme.eyeVisor[1]} />
        </linearGradient>
      </defs>

      {/* Ambient background glow */}
      <circle cx="120" cy="120" r="100" fill={`url(#alfi-glow-${state})`} />

      {/* Outer Floating Orbit Ring */}
      <ellipse
        cx="120"
        cy="120"
        rx="105"
        ry="38"
        stroke={stateTheme.ring}
        strokeWidth="2"
        strokeDasharray="6 8"
        strokeOpacity={state === 'sleeping' ? '0.4' : '0.7'}
        transform={`rotate(${stateTheme.ringRotate} 120 120)`}
      />

      {/* Antenna & Beacon */}
      <line
        x1="120"
        y1={state === 'curious' ? '42' : '42'}
        x2={state === 'curious' ? '114' : '120'}
        y2="70"
        stroke={stateTheme.ring}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="120" cy="38" r={state === 'thinking' ? 9 : 7} fill={stateTheme.ring} />

      {/* Bot Chassis */}
      <rect
        x="65"
        y="68"
        width="110"
        height="100"
        rx="36"
        fill={`url(#body-grad-${state})`}
        stroke={stateTheme.ring}
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
        stroke={stateTheme.ring}
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />

      {/* Visor Expressions based on state */}
      {state === 'idle' && (
        <>
          <rect x="94" y="104" width="18" height="16" rx="5" fill={`url(#visor-grad-${state})`} />
          <rect x="128" y="104" width="18" height="16" rx="5" fill={`url(#visor-grad-${state})`} />
          <circle cx="106" cy="108" r="2.5" fill="#ffffff" />
          <circle cx="140" cy="108" r="2.5" fill="#ffffff" />
        </>
      )}

      {state === 'thinking' && (
        <>
          <rect x="94" y="102" width="18" height="16" rx="5" fill={`url(#visor-grad-${state})`} transform="rotate(-6 94 102)" />
          <rect x="128" y="106" width="18" height="16" rx="5" fill={`url(#visor-grad-${state})`} transform="rotate(6 128 106)" />
          <circle cx="104" cy="107" r="2.5" fill="#ffffff" />
          <circle cx="138" cy="111" r="2.5" fill="#ffffff" />
        </>
      )}

      {state === 'loading' && (
        <>
          <rect x="92" y="108" width="56" height="8" rx="4" fill={`url(#visor-grad-${state})`} />
          <circle cx="106" cy="112" r="5" fill="#ffffff" />
          <circle cx="134" cy="112" r="5" fill="#ffffff" />
        </>
      )}

      {state === 'sleeping' && (
        <>
          <path d="M94 114 Q103 120 112 114" stroke="#3eb1ff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
          <path d="M128 114 Q137 120 146 114" stroke="#3eb1ff" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.8" />
          <text x="175" y="65" fill="#3eb1ff" fontFamily="monospace" fontSize="14" fontWeight="bold" opacity="0.6">z</text>
          <text x="188" y="50" fill="#60beff" fontFamily="monospace" fontSize="18" fontWeight="bold" opacity="0.8">Z</text>
        </>
      )}

      {state === 'curious' && (
        <>
          <circle cx="102" cy="112" r="11" fill={`url(#visor-grad-${state})`} />
          <circle cx="136" cy="112" r="7.5" fill={`url(#visor-grad-${state})`} />
          <circle cx="104" cy="110" r="3.5" fill="#ffffff" />
          <circle cx="137" cy="111" r="2.5" fill="#ffffff" />
        </>
      )}

      {/* Ear Pylons */}
      <rect x="52" y="98" width="14" height="30" rx="6" fill={`url(#body-grad-${state})`} stroke={stateTheme.ring} strokeWidth="2" />
      <rect x="174" y="98" width="14" height="30" rx="6" fill={`url(#body-grad-${state})`} stroke={stateTheme.ring} strokeWidth="2" />

      {/* Thruster Base */}
      <ellipse cx="120" cy="180" rx="28" ry="8" fill={stateTheme.glow} fillOpacity="0.4" />
      <path d="M102 168 L120 188 L138 168 Z" fill={`url(#body-grad-${state})`} stroke={stateTheme.ring} strokeWidth="2" />
    </svg>
  );
};
