import React from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { renderWithProviders } from '../../../../tests/test-utils';
import { HouseholdHeader } from '../HouseholdHeader';
import { AddressManagementModal } from '../AddressManagementModal';
import { MemberTable } from '../MemberTable';
import { Household } from '@/shared/types';

const mockHousehold: Household = {
  id: 'hh-12345678-abcd',
  name: 'Valhalla Haven',
  slug: 'valhalla-haven',
  owner_id: 'user-owner-123',
  street: 'Main St 10',
  zip: '10115',
  city: 'Berlin',
  country: 'Germany',
  latitude: 52.52,
  longitude: 13.405,
  role: 'OWNER',
  members: [
    {
      household_id: 'hh-12345678-abcd',
      user_id: 'user-owner-123',
      first_name: 'Odin',
      last_name: 'Allfather',
      email: 'odin@valhalla.org',
      role: 'OWNER',
      joined_at: '2026-01-01T00:00:00Z',
    },
    {
      household_id: 'hh-12345678-abcd',
      user_id: 'user-member-456',
      first_name: 'Thor',
      last_name: 'Odinson',
      email: 'thor@valhalla.org',
      role: 'MEMBER',
      joined_at: '2026-01-02T00:00:00Z',
    },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('Household Header Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = renderWithProviders(
      <HouseholdHeader
        household={mockHousehold}
        isOwnerOrAdmin={true}
        onGenerateInvite={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders household title, avatar initial, role badge, and invite action button', () => {
    const handleInvite = vi.fn();
    renderWithProviders(
      <HouseholdHeader
        household={mockHousehold}
        isOwnerOrAdmin={true}
        onGenerateInvite={handleInvite}
      />
    );

    expect(screen.getByText('Valhalla Haven')).toBeInTheDocument();
    expect(screen.getByText('V')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));
    expect(handleInvite).toHaveBeenCalledTimes(1);
  });

  it('hides invite button for non-owner/non-admin members', () => {
    renderWithProviders(
      <HouseholdHeader
        household={{ ...mockHousehold, role: 'MEMBER' }}
        isOwnerOrAdmin={false}
        onGenerateInvite={vi.fn()}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('AddressManagementModal Component', () => {
  it('does not render when closed', () => {
    const { container } = renderWithProviders(
      <AddressManagementModal
        isOpen={false}
        household={mockHousehold}
        onClose={vi.fn()}
        onAddressSelect={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('passes accessibility audit when open', async () => {
    const { container } = renderWithProviders(
      <AddressManagementModal
        isOpen={true}
        household={mockHousehold}
        onClose={vi.fn()}
        onAddressSelect={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('MemberTable Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = renderWithProviders(
      <MemberTable
        household={mockHousehold}
        isOwnerOrAdmin={true}
        onRoleChange={vi.fn()}
        onRemoveMember={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('renders members list with names and emails', () => {
    renderWithProviders(
      <MemberTable
        household={mockHousehold}
        isOwnerOrAdmin={true}
        onRoleChange={vi.fn()}
        onRemoveMember={vi.fn()}
      />
    );

    expect(screen.getByText('Odin Allfather')).toBeInTheDocument();
    expect(screen.getByText('odin@valhalla.org')).toBeInTheDocument();
    expect(screen.getByText('Thor Odinson')).toBeInTheDocument();
    expect(screen.getByText('thor@valhalla.org')).toBeInTheDocument();
  });

  it('triggers role change and remove member callbacks', () => {
    const handleRoleChange = vi.fn();
    const handleRemoveMember = vi.fn();

    renderWithProviders(
      <MemberTable
        household={mockHousehold}
        isOwnerOrAdmin={true}
        onRoleChange={handleRoleChange}
        onRemoveMember={handleRemoveMember}
      />
    );

    const roleSelect = screen.getByRole('combobox');
    fireEvent.change(roleSelect, { target: { value: 'ADMIN' } });
    expect(handleRoleChange).toHaveBeenCalledWith('user-member-456', 'MEMBER', 'ADMIN');

    const removeBtn = screen.getByLabelText(/remove_member/i);
    fireEvent.click(removeBtn);
    expect(handleRemoveMember).toHaveBeenCalledWith('user-member-456', 'Thor Odinson');
  });
});
