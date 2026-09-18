'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { describeApiError } from '@/lib/apiErrors';
import { InviteCodeResponse } from '@/shared/types';
import { useHouseholdInvites, useRevokeInvite, useCreateInvite } from '../hooks/queries';
import { StatusBanner } from './StatusBanner';

interface InviteListProps {
  householdId: string;
  /** Opens the QR / share modal for an invite. */
  onShowInvite: (invite: InviteCodeResponse) => void;
}

const INVITE_ROLES = ['MEMBER', 'ADMIN', 'GUEST'] as const;

function isExpired(invite: InviteCodeResponse): boolean {
  return new Date(invite.expires_at).getTime() < Date.now();
}

/**
 * Lists a household's active invites with revoke + QR actions and lets
 * OWNER/ADMIN generate new invites for a chosen role. Only rendered for
 * callers allowed to manage invites.
 */
export function InviteList({ householdId, onShowInvite }: InviteListProps) {
  const { t } = useTranslation();
  const { data: invites, isLoading, error } = useHouseholdInvites(householdId);
  const revokeMutation = useRevokeInvite(householdId);
  const createMutation = useCreateInvite();
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>('MEMBER');
  const [status, setStatus] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const handleRevoke = (token: string) => {
    if (!confirm(t('household_app.invites.confirm_revoke'))) return;
    setStatus(null);
    revokeMutation.mutate(token, {
      onSuccess: () => setStatus({ kind: 'success', text: t('household_app.invites.revoked') }),
      onError: (err) => setStatus({ kind: 'error', text: describeApiError(err, t, 'invite') }),
    });
  };

  const handleGenerate = () => {
    setStatus(null);
    createMutation.mutate(
      { household_id: householdId, role, ttl_minutes: 60, max_uses: 5 },
      {
        onSuccess: (invite) => onShowInvite(invite),
        onError: (err) => setStatus({ kind: 'error', text: describeApiError(err, t) }),
      },
    );
  };

  return (
    <section
      aria-labelledby="household-invites-title"
      className="col-span-12 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
        <h2 id="household-invites-title" className="text-sm font-mono uppercase tracking-wide text-[var(--text-muted)]">
          {t('household_app.invites.title')}
        </h2>
        <div className="flex items-center gap-2">
          <label htmlFor="invite-role" className="sr-only">{t('household_app.invites.role_label')}</label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof INVITE_ROLES)[number])}
            className="bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] rounded px-1.5 py-1 cursor-pointer"
          >
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={createMutation.isPending}
            className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs flex items-center gap-1 hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">qr_code_2</span>
            {t('household_app.invites.generate')}
          </button>
        </div>
      </div>

      {status && <StatusBanner kind={status.kind}>{status.text}</StatusBanner>}
      {error && <StatusBanner kind="error">{describeApiError(error, t)}</StatusBanner>}

      {isLoading ? (
        <div className="h-12 rounded-xl bg-[var(--surface-elevated)] animate-pulse" />
      ) : invites && invites.length > 0 ? (
        <ul className="space-y-2">
          {invites.map((invite) => {
            const expired = isExpired(invite);
            return (
              <li
                key={invite.token}
                className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-mono font-bold text-[var(--primary-main)] truncate">{invite.token}</div>
                  <div className="text-[10px] font-mono text-[var(--text-muted)] flex flex-wrap gap-x-3">
                    <span>{invite.role}</span>
                    <span>{t('household_app.invites.uses', { uses: invite.uses ?? 0, max: invite.max_uses })}</span>
                    <span>
                      {expired
                        ? t('household_app.invites.expired')
                        : t('household_app.invites.expires', { time: new Date(invite.expires_at).toLocaleString() })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onShowInvite(invite)}
                    className="px-2 py-1 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] cursor-pointer"
                  >
                    {t('household_app.invites.show_qr')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRevoke(invite.token)}
                    disabled={revokeMutation.isPending}
                    aria-label={t('household_app.invites.revoke_label', { token: invite.token })}
                    className="px-2 py-1 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-red-400 hover:border-red-400/40 cursor-pointer disabled:opacity-50"
                  >
                    {t('household_app.invites.revoke')}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        !error && (
          <p className="p-4 text-center text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-elevated)] border border-dashed border-[var(--border-subtle)] rounded-xl">
            {t('household_app.invites.empty')}
          </p>
        )
      )}
    </section>
  );
}
