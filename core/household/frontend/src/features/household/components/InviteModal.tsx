'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@alfheim/shared';
import { useTranslation } from '@/i18n';
import { buildJoinUrl } from '@/lib/routes';
import { InviteCodeResponse } from '@/shared/types';
import { QrCode } from './QrCode';

interface InviteModalProps {
  isOpen: boolean;
  invite: InviteCodeResponse | null;
  onClose: () => void;
  /** Override for the join URL origin (tests / SSR). Defaults to window.location.origin. */
  origin?: string;
}

/**
 * Invite Modal component.
 * Renders a scannable QR code for `https://<host>/household/join?token=<token>`
 * plus copy controls for both the raw token and the join link.
 */
export function InviteModal({ isOpen, invite, onClose, origin }: InviteModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'token' | 'link' | null>(null);

  if (!isOpen || !invite) return null;

  const joinUrl = buildJoinUrl(invite.token, origin);

  const handleCopy = (value: string, which: 'token' | 'link') => {
    void navigator.clipboard?.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--surface-card)] w-full max-w-sm flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] mb-3 shadow-[0_0_15px_var(--accent-glow)]">
          <span className="material-symbols-outlined text-2xl">qr_code_2</span>
        </div>
        <DialogTitle className="text-lg font-bold text-[var(--text-main)]">{t('household.qr_code_title')}</DialogTitle>
        <p className="text-xs text-[var(--text-muted)] font-mono mt-1 mb-5">
          {t('household.qr_code_desc')}
        </p>

        <div className="p-3 rounded-2xl bg-white border-4 border-[var(--primary-main)]/40 shadow-[0_0_25px_var(--accent-glow)] mb-5">
          <QrCode value={joinUrl} label={t('household_app.invites.qr_label')} />
        </div>

        <div className="w-full p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between font-mono mb-2 overflow-hidden gap-2">
          <span className="text-sm font-bold text-[var(--primary-main)] tracking-wider truncate overflow-hidden min-w-0 flex-1 text-left">
            {invite.token}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(invite.token, 'token')}
            className="px-2.5 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-semibold text-xs hover:bg-[var(--primary-hover)] cursor-pointer transition-all duration-150 flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">{copied === 'token' ? 'check' : 'content_copy'}</span>
            <span>{copied === 'token' ? t('household.copied') : t('household.copy')}</span>
          </button>
        </div>

        <div className="w-full p-3 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-between font-mono mb-4 overflow-hidden gap-2">
          <span className="text-[10px] text-[var(--text-muted)] truncate min-w-0 flex-1 text-left" title={joinUrl}>
            <span className="sr-only">{t('household_app.invites.join_link')}: </span>
            {joinUrl}
          </span>
          <button
            type="button"
            onClick={() => handleCopy(joinUrl, 'link')}
            className="px-2.5 py-1 rounded bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)] font-semibold text-xs cursor-pointer flex items-center gap-1 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">{copied === 'link' ? 'check' : 'link'}</span>
            <span>{copied === 'link' ? t('household.copied') : t('household_app.invites.copy_link')}</span>
          </button>
        </div>

        <div className="text-[10px] font-mono text-[var(--text-muted)]">
          {t('household.max_uses_expiry', { max: invite.max_uses, time: new Date(invite.expires_at).toLocaleString() })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
