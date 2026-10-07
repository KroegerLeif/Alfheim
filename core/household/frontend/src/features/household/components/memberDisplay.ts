import { HouseholdMember } from '@/shared/types';

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Name shown for a member: full name, then @username, email, a short user id, then a generic label. */
export function memberDisplayName(m: HouseholdMember, t: Translate): string {
  if (m.first_name || m.last_name) {
    return `${m.first_name || ''} ${m.last_name || ''}`.trim();
  }
  if (m.username) return `@${m.username}`;
  if (m.email) return m.email;
  if (m.user_id) return t('household_app.members.unnamed', { id: m.user_id.substring(0, 8) });
  return t('household.member_user');
}

/** Up to two initials for the member avatar placeholder. */
export function memberInitials(m: HouseholdMember): string {
  if (m.first_name && m.last_name) {
    return `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
  }
  const source = m.first_name || m.last_name || m.username || m.email || m.user_id || '';
  return source.substring(0, 2).toUpperCase();
}
