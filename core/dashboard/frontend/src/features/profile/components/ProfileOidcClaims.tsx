'use client';

import { useTranslation } from '@alfheim/shared';
import { UserIdentityClaims } from '@/core/providers';

interface ProfileOidcClaimsProps {
  authUser: UserIdentityClaims | null;
  userId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export function ProfileOidcClaims({
  authUser,
  userId,
  username,
  email,
  firstName,
  lastName,
}: ProfileOidcClaimsProps) {
  const { t } = useTranslation();

  return (
    <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)]">
      <h2 className="text-base font-bold text-[var(--text-main)] mb-4">{t('profile.oidc_claims_title')}</h2>
      <div className="space-y-3.5 text-xs">
        <div>
          <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.subject_sub')}</span>
          <span className="font-mono text-[var(--text-main)] break-all">{authUser?.sub || userId}</span>
        </div>
        <div>
          <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.username')}</span>
          <span className="font-semibold text-[var(--text-main)]">@{username}</span>
        </div>
        <div>
          <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.email')}</span>
          <span className="font-semibold text-[var(--text-main)]">{email || t('profile.not_available')}</span>
        </div>
        <div>
          <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.given_name')}</span>
          <span className="font-mono text-[var(--text-main)]">{authUser?.given_name || firstName || t('profile.not_available')}</span>
        </div>
        <div>
          <span className="block text-[var(--text-muted)] font-mono text-[10px] uppercase">{t('profile.family_name')}</span>
          <span className="font-mono text-[var(--text-main)]">{authUser?.family_name || lastName || t('profile.not_available')}</span>
        </div>
      </div>
    </div>
  );
}
