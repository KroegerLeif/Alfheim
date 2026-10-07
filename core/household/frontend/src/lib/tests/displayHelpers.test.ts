import { describe, it, expect } from 'vitest';
import { translateLocal } from '@/i18n';
import { escapeHtml } from '../html';
import { roleLabel } from '@/features/household/roles';
import { memberDisplayName, memberInitials } from '@/features/household/components/memberDisplay';
import { contactPopupHtml } from '@/features/contact/components/ContactCards';
import { Contact, HouseholdMember } from '@/shared/types';

const tFor = (lang: string) => (key: string, params?: Record<string, string | number>) =>
  translateLocal(lang, key, params) ?? key;

describe('escapeHtml', () => {
  it('escapes every HTML-significant character', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    );
  });

  it('keeps contact data out of the map popup markup', () => {
    const contact = { name: '<script>x</script>', address: 'A & B', phone: '"1"' } as Contact;
    expect(contactPopupHtml(contact)).toBe(
      '<strong>&lt;script&gt;x&lt;/script&gt;</strong><br/>A &amp; B<br/>&quot;1&quot;',
    );
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
