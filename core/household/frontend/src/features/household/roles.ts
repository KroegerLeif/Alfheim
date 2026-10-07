import { HouseholdRole } from '@/shared/types';

type Translate = (key: string) => string;

/** Literal keys so the translation-key test can verify every role label. */
const ROLE_LABEL_KEYS: Record<HouseholdRole, string> = {
  OWNER: 'dashboard.household.roles.owner',
  ADMIN: 'dashboard.household.roles.admin',
  MEMBER: 'dashboard.household.roles.member',
  GUEST: 'dashboard.household.roles.guest',
};

/** Translated label for a household role; unknown values are shown as sent. */
export function roleLabel(role: string | null | undefined, t: Translate): string {
  const upper = (role ?? '').toUpperCase();
  return upper in ROLE_LABEL_KEYS ? t(ROLE_LABEL_KEYS[upper as HouseholdRole]) : (role ?? '');
}
