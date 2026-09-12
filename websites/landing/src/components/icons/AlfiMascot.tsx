import React from 'react';
import { AlfiState, ALFI_MASCOT_ASSETS } from '@alfheim/shared';
import alfiIdle from '@alfheim/shared/assets/alfi/alfi-idle.svg';
import alfiThinking from '@alfheim/shared/assets/alfi/alfi-thinking.svg';
import alfiSleeping from '@alfheim/shared/assets/alfi/alfi-sleeping.svg';
import alfiSpeaking from '@alfheim/shared/assets/alfi/alfi-speaking.svg';
import alfiListening from '@alfheim/shared/assets/alfi/alfi-listening.svg';
import alfiEating from '@alfheim/shared/assets/alfi/alfi-eating.svg';
import alfiFixing from '@alfheim/shared/assets/alfi/alfi-fixing.svg';
import alfiChasing from '@alfheim/shared/assets/alfi/alfi-chasing.svg';

interface AlfiMascotProps {
  className?: string;
  size?: number;
  state?: AlfiState;
  onClick?: () => void;
}

const mascotSrcMap: Record<AlfiState, string> = {
  idle: alfiIdle,
  thinking: alfiThinking,
  sleeping: alfiSleeping,
  speaking: alfiSpeaking,
  listening: alfiListening,
  eating: alfiEating,
  fixing: alfiFixing,
  chasing: alfiChasing,
  loading: alfiSpeaking,
  curious: alfiListening,
};

export const AlfiMascot: React.FC<AlfiMascotProps> = ({
  className = 'w-48 h-48',
  size = 192,
  state = 'idle',
  onClick,
}) => {
  const assetPath = ALFI_MASCOT_ASSETS[state] || ALFI_MASCOT_ASSETS.idle;
  const src = mascotSrcMap[state] || alfiIdle;

  return (
    <img
      src={src}
      alt={`ALFI Companion (${state})`}
      width={size}
      height={size}
      className={`${className} object-contain cursor-pointer transition-all duration-300 drop-shadow-[0_0_24px_rgba(62,177,255,0.25)]`}
      onClick={onClick}
      data-state={state}
      data-asset={assetPath}
    />
  );
};
