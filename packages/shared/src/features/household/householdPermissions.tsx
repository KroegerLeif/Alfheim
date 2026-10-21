'use client';

import React from 'react';
import { useTranslation } from '../i18n/utils/useTranslation';
import { useOptionalActiveHousehold } from './HouseholdProvider';

/**
 * Actions of the household role matrix enforced by the Python backends:
 * `write` changes shared household data (MEMBER, ADMIN, OWNER), `adminDelete`
 * deletes a shared structure such as a budget account or a chore template
 * (ADMIN, OWNER). Personal resources need no permission check.
 */
export type HouseholdPermission = 'write' | 'adminDelete';

export const HOUSEHOLD_PERMISSION_ROLES: Record<HouseholdPermission, readonly string[]> = {
  write: ['OWNER', 'ADMIN', 'MEMBER'],
  adminDelete: ['OWNER', 'ADMIN'],
};

/** Whether `role` grants `permission`; an unknown or missing role grants nothing. */
export function hasHouseholdPermission(role: string | null | undefined, permission: HouseholdPermission): boolean {
  if (!role) return false;
  return HOUSEHOLD_PERMISSION_ROLES[permission].includes(role.toUpperCase());
}

export interface HouseholdPermissionState {
  allowed: boolean;
  /** Translated explanation for a disabled control; `undefined` when allowed. */
  hint: string | undefined;
}

const HINT_KEYS: Record<HouseholdPermission, string> = {
  write: 'household.roles.write_forbidden',
  adminDelete: 'household.roles.admin_delete_forbidden',
};

/**
 * Permission of the caller in the active household plus a translated hint.
 * Outside a `HouseholdProvider` there is no role to check, so everything is
 * allowed and the backend stays the only enforcement point.
 */
export function useHouseholdPermission(permission: HouseholdPermission): HouseholdPermissionState {
  const { t } = useTranslation();
  const ctx = useOptionalActiveHousehold();
  const allowed = ctx ? hasHouseholdPermission(ctx.role, permission) : true;
  return { allowed, hint: allowed ? undefined : t(HINT_KEYS[permission]) };
}

/** Whether the caller may perform `permission` in the active household. */
export function useHouseholdCan(permission: HouseholdPermission): boolean {
  const ctx = useOptionalActiveHousehold();
  return ctx ? hasHouseholdPermission(ctx.role, permission) : true;
}

export interface PermissionHintProps {
  /** Tooltip text; when empty the children render unwrapped. */
  hint: string | undefined;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shows `hint` as a tooltip around a disabled control. Disabled buttons do not
 * receive pointer events, so the tooltip has to live on a wrapper.
 */
export function PermissionHint({ hint, children, className }: PermissionHintProps) {
  if (!hint) return <>{children}</>;
  return (
    <span title={hint} data-testid="permission-hint" className={className ?? 'inline-flex'}>
      {children}
    </span>
  );
}

/** Notice for read-only (GUEST) members; renders nothing for every other role. */
export function HouseholdReadOnlyNotice({ className }: { className?: string }) {
  const { t } = useTranslation();
  const ctx = useOptionalActiveHousehold();
  if (ctx?.status !== 'ready' || !ctx.role || hasHouseholdPermission(ctx.role, 'write')) return null;
  return (
    <p
      role="note"
      data-testid="household-read-only-notice"
      className={
        className ??
        'mx-4 mt-3 shrink-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2 text-xs text-[var(--text-muted)]'
      }
    >
      {t('household.roles.guest_notice')}
    </p>
  );
}
