import React from 'react';
import { BRAND_ASSETS } from '@alfheim/shared';
import logoMarkSvg from '@alfheim/shared/assets/brand/logo-mark.svg';
import logoMarkWhiteSvg from '@alfheim/shared/assets/brand/logo-mark-white.svg';

interface AlfheimLogoProps {
  className?: string;
  size?: number;
  variant?: 'mark' | 'white' | 'full';
}

export const AlfheimLogo: React.FC<AlfheimLogoProps> = ({
  className = 'w-8 h-8',
  size = 32,
  variant = 'mark',
}) => {
  if (variant === 'full') {
    return (
      <div className={`inline-flex items-center gap-3 ${className}`}>
        <img
          src={logoMarkSvg}
          alt="Alfheim Logo Mark"
          width={size}
          height={size}
          className="object-contain"
        />
        <div className="flex flex-col">
          <span className="font-bold text-base tracking-tight text-[#f0f6fc]">ALFHEIM</span>
          <span className="text-[10px] uppercase font-mono tracking-widest text-[#8b949e]">Sovereign OS</span>
        </div>
      </div>
    );
  }

  if (variant === 'white') {
    return (
      <img
        src={logoMarkWhiteSvg}
        alt="Alfheim Logo Mark White"
        width={size}
        height={size}
        className={`${className} object-contain`}
        data-asset={BRAND_ASSETS.logoMarkWhite}
      />
    );
  }

  return (
    <img
      src={logoMarkSvg}
      alt="Alfheim Logo Mark"
      width={size}
      height={size}
      className={`${className} object-contain`}
      data-asset={BRAND_ASSETS.logoMark}
    />
  );
};
