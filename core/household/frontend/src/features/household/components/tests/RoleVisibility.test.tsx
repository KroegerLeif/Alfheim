import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/tests/test-utils'
import { HouseholdSettingsPanel } from '../HouseholdSettingsPanel'
import { getHouseholdPermissions } from '../../permissions'
import { Household } from '@/shared/types'

const household: Household = {
  id: 'hh-1',
  name: 'Valhalla',
  slug: 'valhalla',
  owner_id: 'u-owner',
  street: '',
  zip: '',
  city: '',
  country: '',
  role: 'OWNER',
  members: [
    { household_id: 'hh-1', user_id: 'u-owner', first_name: 'Odin', last_name: 'A', role: 'OWNER', joined_at: '' },
    { household_id: 'hh-1', user_id: 'u-thor', first_name: 'Thor', last_name: 'O', role: 'MEMBER', joined_at: '' },
  ],
  created_at: '',
  updated_at: '',
}

function renderPanel(role: string) {
  return renderWithProviders(
    <HouseholdSettingsPanel
      household={{ ...household, role }}
      permissions={getHouseholdPermissions(role)}
      isDefault={false}
      onRemoved={vi.fn()}
    />,
  )
}

describe('getHouseholdPermissions', () => {
  it('grants everything but leaving to OWNER', () => {
    expect(getHouseholdPermissions('OWNER')).toMatchObject({
      canRename: true, canDelete: true, canTransferOwnership: true, canLeave: false,
      canManageInvites: true, canManageMembers: true, canEditContacts: true,
    })
  })

  it('lets ADMIN manage but not delete or transfer', () => {
    expect(getHouseholdPermissions('admin')).toMatchObject({
      canRename: true, canDelete: false, canTransferOwnership: false, canLeave: true, canManageInvites: true,
    })
  })

  it('restricts MEMBER to leaving, contacts and default', () => {
    expect(getHouseholdPermissions('MEMBER')).toMatchObject({
      canRename: false, canDelete: false, canManageInvites: false, canLeave: true, canEditContacts: true, canSetDefault: true,
    })
  })

  it('treats GUEST and unknown roles as read-only', () => {
    for (const role of ['GUEST', undefined, 'SUPERUSER']) {
      expect(getHouseholdPermissions(role)).toMatchObject({
        role: 'GUEST', canRename: false, canManageInvites: false, canEditContacts: false, canLeave: true,
      })
    }
  })
})

describe('HouseholdSettingsPanel role-based visibility', () => {
  it('OWNER sees rename, transfer and delete; leave is disabled', () => {
    renderPanel('OWNER')
    expect(screen.getByLabelText('Household name')).toBeInTheDocument()
    expect(screen.getByText('Transfer ownership')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Thor O' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete household…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave household' })).toBeDisabled()
    expect(screen.getByText('Owners must transfer ownership before leaving.')).toBeInTheDocument()
  })

  it('ADMIN can rename and leave but not transfer or delete', () => {
    renderPanel('ADMIN')
    expect(screen.getByLabelText('Household name')).toBeInTheDocument()
    expect(screen.queryByText('Transfer ownership')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete household…' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave household' })).toBeEnabled()
  })

  it('MEMBER only sees default + leave', () => {
    renderPanel('MEMBER')
    expect(screen.queryByLabelText('Household name')).not.toBeInTheDocument()
    expect(screen.queryByText('Transfer ownership')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete household…' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make default' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leave household' })).toBeEnabled()
  })
})
