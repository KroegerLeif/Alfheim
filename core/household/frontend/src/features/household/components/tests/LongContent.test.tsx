import { screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '@/tests/test-utils';
import { Contact, Household } from '@/shared/types';
import { ContactCardItem } from '@/features/contact/components/ContactCardItem';
import { HouseholdListCard } from '../HouseholdListCard';
import { HouseholdHeader } from '../HouseholdHeader';
import { MemberTable } from '../MemberTable';

/**
 * jsdom has no layout engine, so these tests pin the classes that keep long,
 * unbroken user content (names, e-mails, addresses) inside its card.
 */
const LONG_NAME = `Haushalt${'Valhalla'.repeat(18)}`; // 152 characters without a single space
const LONG_EMAIL = `${'odin.allfather'.repeat(8)}@asgard-valhalla-realm-eternal.example.org`;

const household: Household = {
  id: 'hh-12345678-abcd',
  name: LONG_NAME,
  slug: 'long',
  owner_id: 'owner',
  street: `Bifrost${'strasse'.repeat(20)} 1`,
  zip: '10115',
  city: 'Berlin',
  country: 'Germany',
  role: 'ADMIN',
  is_default: true,
  created_at: '',
  updated_at: '',
  members: [
    { household_id: 'hh-12345678-abcd', user_id: 'owner', email: LONG_EMAIL, role: 'OWNER', joined_at: '' },
    { household_id: 'hh-12345678-abcd', user_id: 'm', first_name: LONG_NAME, email: LONG_EMAIL, role: 'MEMBER', joined_at: '' },
  ],
};

describe('long content stays inside its container', () => {
  it('wraps a very long household name and address on the list card', () => {
    renderWithProviders(
      <ul>
        <HouseholdListCard household={household} isSettingDefault={false} onSetDefault={vi.fn()} onOpen={vi.fn()} />
      </ul>,
    );
    const heading = screen.getByRole('heading', { name: LONG_NAME });
    expect(heading).toHaveClass('wrap-anywhere');
    expect(heading.parentElement).toHaveClass('min-w-0');
    expect(screen.getByText(/Bifrost/)).toHaveClass('wrap-anywhere');
    expect(screen.getByRole('listitem')).toHaveClass('min-w-0');
    // Role badge uses the translated label, not the raw enum.
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
  });

  it('wraps a very long household name in the detail header without pushing the badge out', () => {
    renderWithProviders(<HouseholdHeader household={household} isOwnerOrAdmin onGenerateInvite={vi.fn()} />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(LONG_NAME);
    expect(heading).toHaveClass('wrap-anywhere', 'min-w-0');
    expect(screen.getByText('ADMIN')).toHaveClass('shrink-0');
    expect(screen.getByText('ID: hh-12345…')).toBeInTheDocument();
  });

  it('truncates long member names and e-mails and keeps the actions visible', () => {
    renderWithProviders(
      <MemberTable household={household} isOwnerOrAdmin onRoleChange={vi.fn()} onRemoveMember={vi.fn()} />,
    );
    const emails = screen.getAllByText(LONG_EMAIL);
    // Both e-mail lines plus the owner's display name, which falls back to the e-mail.
    expect(emails).toHaveLength(3);
    emails.forEach((el) => {
      expect(el).toHaveClass('truncate');
      expect(el).toHaveAttribute('title', LONG_EMAIL);
      expect(el.parentElement).toHaveClass('min-w-0');
    });
    const name = screen.getByTitle(LONG_NAME);
    expect(name).toHaveClass('truncate');
    const removeButton = screen.getByRole('button', { name: `Remove ${LONG_NAME}` });
    expect(removeButton.closest('.shrink-0')).not.toBeNull();
  });

  it('wraps long contact details and labels icon-only actions', () => {
    const contact: Contact = {
      id: 'c1',
      household_id: 'hh',
      name: LONG_NAME,
      phone: '+49 30 1234567',
      email: LONG_EMAIL,
      address: household.street,
      description: 'x'.repeat(200),
      links: ['https://example.org'],
      icon: 'person',
      avatar_url: '',
      created_at: '',
      updated_at: '',
    } as Contact;
    renderWithProviders(<ContactCardItem contact={contact} isGuest={false} onEdit={vi.fn()} onDelete={vi.fn()} />);

    expect(screen.getByTitle(LONG_NAME)).toHaveClass('truncate');
    expect(screen.getByText(LONG_EMAIL)).toHaveClass('wrap-anywhere');
    expect(screen.getByText('x'.repeat(200))).toHaveClass('wrap-anywhere');
    for (const label of ['Call', 'Email', 'Open link for']) {
      expect(screen.getByRole('link', { name: `${label} ${LONG_NAME}` })).toBeInTheDocument();
    }
    for (const label of ['Edit', 'Delete']) {
      expect(screen.getByRole('button', { name: `${label} ${LONG_NAME}` })).toBeInTheDocument();
    }
    const actions = screen.getByRole('button', { name: `Edit ${LONG_NAME}` }).closest('.shrink-0');
    expect(actions).not.toBeNull();
    expect(within(actions as HTMLElement).getAllByRole('button')).toHaveLength(2);
  });
});
