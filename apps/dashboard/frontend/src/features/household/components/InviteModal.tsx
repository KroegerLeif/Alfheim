'use client';

import { useState } from 'react';
import { useTranslation } from '@loeger-os/shared';
import { InviteCodeResponse } from '@/shared/types';

interface InviteModalProps {
  invite: InviteCodeResponse;
  onClose: () => void;
}

/**
 * Invite Modal component.
 * Renders stylized vector matrix QR code and copy controls for household invite tokens.
 */
export function InviteModal({ invite, onClose }: InviteModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(invite.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] p-6 shadow-2xl relative flex flex-col items-center text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          aria-label={t('common.close')}
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {/* Header */}
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] mb-3 shadow-[0_0_15px_var(--accent-glow)]">
          <span className="material-symbols-outlined text-2xl">qr_code_2</span>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-main)]">{t('household.qr_code_title')}</h3>
        <p className="text-xs text-[var(--text-muted)] font-mono mt-1 mb-5">
          {t('household.qr_code_desc')}
        </p>

        {/* Stylized QR Code Graphic Container */}
        <div className="p-4 rounded-2xl bg-white border-4 border-[var(--primary-main)]/40 shadow-[0_0_25px_var(--accent-glow)] mb-5">
          <svg
            className="w-44 h-44"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Position Detection Markers */}
            <rect x="5" y="5" width="25" height="25" fill="var(--surface-canvas)" rx="3" />
            <rect x="9" y="9" width="17" height="17" fill="#ffffff" rx="2" />
            <rect x="13" y="13" width="9" height="9" fill="var(--primary-main)" rx="1.5" />

            <rect x="70" y="5" width="25" height="25" fill="var(--surface-canvas)" rx="3" />
            <rect x="74" y="9" width="17" height="17" fill="#ffffff" rx="2" />
            <rect x="78" y="13" width="9" height="9" fill="var(--primary-main)" rx="1.5" />

            <rect x="5" y="70" width="25" height="25" fill="var(--surface-canvas)" rx="3" />
            <rect x="9" y="74" width="17" height="17" fill="#ffffff" rx="2" />
            <rect x="13" y="78" width="9" height="9" fill="var(--primary-main)" rx="1.5" />

            {/* Matrix Payload Pattern */}
            <rect x="35" y="10" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="48" y="10" width="8" height="8" fill="var(--primary-main)" />
            <rect x="35" y="23" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="48" y="23" width="8" height="8" fill="var(--surface-canvas)" />

            <rect x="10" y="35" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="23" y="35" width="8" height="8" fill="var(--primary-main)" />
            <rect x="35" y="35" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="48" y="35" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="61" y="35" width="8" height="8" fill="var(--primary-main)" />
            <rect x="74" y="35" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="87" y="35" width="8" height="8" fill="var(--surface-canvas)" />

            <rect x="35" y="48" width="8" height="8" fill="var(--primary-main)" />
            <rect x="48" y="48" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="61" y="48" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="74" y="48" width="8" height="8" fill="var(--primary-main)" />

            <rect x="35" y="61" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="48" y="61" width="8" height="8" fill="var(--primary-main)" />
            <rect x="61" y="61" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="74" y="61" width="8" height="8" fill="var(--surface-canvas)" />

            <rect x="35" y="74" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="48" y="74" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="61" y="74" width="8" height="8" fill="var(--primary-main)" />
            <rect x="74" y="74" width="8" height="8" fill="var(--surface-canvas)" />
            <rect x="87" y="74" width="8" height="8" fill="var(--primary-main)" />
          </svg>
        </div>

        {/* Token Code Display & Copy Action */}
        <div className="w-full p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between font-mono mb-4">
          <span className="text-sm font-bold text-[var(--primary-main)] tracking-wider">
            {invite.token}
          </span>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] cursor-pointer transition-all duration-150 flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span>{copied ? t('household.copied') : t('household.copy')}</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-[var(--text-muted)]">
          {t('household.max_uses_expiry', { max: invite.max_uses, time: new Date(invite.expires_at).toLocaleTimeString() })}
        </div>
      </div>
    </div>
  );
}
