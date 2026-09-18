'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/i18n';
import { describeApiError } from '@/lib/apiErrors';
import { setActiveHousehold } from '@/lib/activeHousehold';
import { Household } from '@/shared/types';
import { useJoinHousehold } from '../hooks/queries';
import { StatusBanner } from './StatusBanner';

interface JoinHouseholdFormProps {
  /** Pre-filled token, e.g. from `/join?token=…`. */
  initialToken?: string;
  /** Redeem `initialToken` immediately on mount (QR / link flow). */
  autoSubmit?: boolean;
  /** Called after a successful join; the household is already active. */
  onJoined: (household: Household) => void;
}

/**
 * Invite-code form used by the list page, onboarding and the `/join` route.
 * On success the joined household becomes the active one for all apps.
 */
export function JoinHouseholdForm({ initialToken = '', autoSubmit = false, onJoined }: JoinHouseholdFormProps) {
  const { t } = useTranslation();
  const joinMutation = useJoinHousehold();
  const [token, setToken] = useState(initialToken);
  const [error, setError] = useState<string | null>(null);
  const autoSubmitted = useRef(false);

  const redeem = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setError(null);
    joinMutation.mutate(
      { token: trimmed },
      {
        onSuccess: (household) => {
          if (household?.id) setActiveHousehold(household.id);
          setToken('');
          onJoined(household);
        },
        onError: (err) => setError(describeApiError(err, t, 'invite')),
      },
    );
  };

  useEffect(() => {
    if (autoSubmit && initialToken && !autoSubmitted.current) {
      autoSubmitted.current = true;
      redeem(initialToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit, initialToken]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        redeem(token);
      }}
      className="space-y-2"
    >
      {error && <StatusBanner kind="error">{error}</StatusBanner>}
      {joinMutation.isPending && autoSubmit && (
        <StatusBanner kind="info">{t('household_app.join.redeeming')}</StatusBanner>
      )}
      <label htmlFor="household-join-token" className="sr-only">{t('household_app.join.token_label')}</label>
      <input
        id="household-join-token"
        type="text"
        autoComplete="off"
        placeholder={t('household.invite_token_placeholder')}
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className="w-full px-3 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
        required
      />
      <button
        type="submit"
        disabled={joinMutation.isPending || !token.trim()}
        className="w-full py-2 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-xs font-semibold text-[var(--text-main)] transition-all cursor-pointer disabled:opacity-50"
      >
        {joinMutation.isPending ? t('household_app.join.joining') : t('household_app.join.submit')}
      </button>
    </form>
  );
}
