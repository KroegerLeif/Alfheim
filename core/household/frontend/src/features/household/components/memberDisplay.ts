import { HouseholdMember } from '@/shared/types';

export function memberDisplayName(m: HouseholdMember, fallback = 'Member'): string {
  if (m.first_name || m.last_name) {
    return `${m.first_name || ''} ${m.last_name || ''}`.trim();
  }
  if (m.username) return `@${m.username}`;
  if (m.email) return m.email;
  if (m.user_id) return `User (${m.user_id.substring(0, 8)}...)`;
  return fallback;
}

export function memberInitials(m: HouseholdMember): string {
  if (m.first_name && m.last_name) {
    return `${m.first_name[0]}${m.last_name[0]}`.toUpperCase();
  }
  if (m.username) return m.username.substring(0, 2).toUpperCase();
  if (m.email) return m.email.substring(0, 2).toUpperCase();
  return 'MU';
}
