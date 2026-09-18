'use client';

import { useState } from 'react';
import { useTranslation, Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { InviteCodeResponse } from '@/shared/types';

interface InviteModalProps {
  isOpen: boolean;
  invite: InviteCodeResponse | null;
  onClose: () => void;
}

/**
 * Invite Modal component.
 * Renders stylized vector matrix QR code and copy controls for household invite tokens.
 */
export function InviteModal({ isOpen, invite, onClose }: InviteModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!isOpen || !invite) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(invite.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-sm flex flex-col items-center text-center">
        {/* Header */}
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] mb-3 shadow-[0_0_15px_var(--accent-glow)]">
          <span className="material-symbols-outlined text-2xl">qr_code_2</span>
        </div>
        <DialogTitle className="text-lg font-bold text-[var(--text-main)]">{t('household.qr_code_title')}</DialogTitle>
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
        <div className="w-full p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between font-mono mb-4 overflow-hidden gap-2">
          <span className="text-sm font-bold text-[var(--primary-main)] tracking-wider truncate overflow-hidden min-w-0 flex-1 text-left">
            {invite.token}
          </span>
          <button
            onClick={handleCopy}
            className="px-2.5 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] cursor-pointer transition-all duration-150 flex items-center gap-1 shrink-0"
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
      </DialogContent>
    </Dialog>
  );
}
