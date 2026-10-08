import { describe, it, expect } from 'vitest';
import { translateLocal } from '@/i18n';
import { roleLabel } from '@/features/household/roles';
import { memberDisplayName, memberInitials } from '@/features/household/components/memberDisplay';
import { contactPopupText } from '@/features/contact/components/ContactCards';
import { Contact, HouseholdMember } from '@/shared/types';

const tFor = (lang: string) => (key: string, params?: Record<string, string | number>) =>
  translateLocal(lang, key, params) ?? key;

describe('contactPopupText', () => {
  it('passes contact data unescaped because the shared map renders it as text', () => {
    const contact = { name: '<script>x</script>', address: 'A & B', phone: '"1"' } as Contact;
    expect(contactPopupText(contact)).toEqual({
      popupTitle: '<script>x</script>',
      popupContent: 'A & B\n"1"',
    });
  });

  it('skips missing address and phone lines', () => {
    expect(contactPopupText({ name: 'Ann', address: '', phone: '0301' } as Contact)).toEqual({
      popupTitle: 'Ann',
      popupContent: '0301',
    });
  });
});

describe('roleLabel', () => {
  it('translates known roles in every language', () => {
    expect(roleLabel('OWNER', tFor('de'))).toBe('EIGENTÜMER');
    expect(roleLabel('guest', tFor('pl'))).toBe('GOŚĆ');
    expect(roleLabel('ADMIN', tFor('en'))).toBe('ADMIN');
  });

  it('shows unknown roles as sent', () => {
    expect(roleLabel('AUDITOR', tFor('en'))).toBe('AUDITOR');
    expect(roleLabel(undefined, tFor('en'))).toBe('');
  });
});

describe('memberDisplayName', () => {
  const base: HouseholdMember = { household_id: 'h', user_id: 'abcdef123456', role: 'MEMBER', joined_at: '' };

  it('prefers names, then username, then e-mail', () => {
    const t = tFor('en');
    expect(memberDisplayName({ ...base, first_name: 'Odin', last_name: '' }, t)).toBe('Odin');
    expect(memberDisplayName({ ...base, username: 'odin' }, t)).toBe('@odin');
    expect(memberDisplayName({ ...base, email: 'o@a.org' }, t)).toBe('o@a.org');
  });

  it('localizes the short user-id fallback', () => {
    expect(memberDisplayName(base, tFor('en'))).toBe('User (abcdef12…)');
    expect(memberDisplayName(base, tFor('de'))).toBe('Benutzer (abcdef12…)');
    expect(memberDisplayName(base, tFor('pl'))).toBe('Użytkownik (abcdef12…)');
    expect(memberDisplayName({ ...base, user_id: '' }, (key) => key)).toBe('household.member_user');
  });

  it('derives initials from the best available field', () => {
    expect(memberInitials({ ...base, first_name: 'odin', last_name: 'allfather' })).toBe('OA');
    expect(memberInitials({ ...base, email: 'thor@a.org' })).toBe('TH');
    expect(memberInitials(base)).toBe('AB');
  });
});

describe('translateLocal interpolation', () => {
  it('inserts parameter values literally, even with dollar patterns', () => {
    expect(translateLocal('en', 'household_app.invites.revoke_label', { token: 'a$&b$1' })).toBe(
      'Revoke invite a$&b$1',
    );
    expect(translateLocal('en', 'household_app.invites.uses', { uses: 2, max: 5 })).toBe('2/5 uses');
  });
});
