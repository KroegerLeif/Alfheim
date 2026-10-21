import React from 'react'
import { render, renderHook, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StaticHouseholdProvider } from '../HouseholdProvider'
import {
  HouseholdReadOnlyNotice,
  PermissionHint,
  hasHouseholdPermission,
  useHouseholdCan,
  useHouseholdPermission,
} from '../householdPermissions'
import { LanguageProvider } from '../../i18n/utils/LanguageContext'

function withRole(role: string | null) {
  return ({ children }: { children: React.ReactNode }) => (
    <LanguageProvider defaultLanguage="en">
      <StaticHouseholdProvider householdId="hh-1" value={{ role }}>
        {children}
      </StaticHouseholdProvider>
    </LanguageProvider>
  )
}

describe('hasHouseholdPermission', () => {
  it.each([
    ['OWNER', true, true],
    ['ADMIN', true, true],
    ['MEMBER', true, false],
    ['GUEST', false, false],
    ['member', true, false],
    [null, false, false],
    ['UNKNOWN', false, false],
  ])('role %s → write=%s adminDelete=%s', (role, write, adminDelete) => {
    expect(hasHouseholdPermission(role, 'write')).toBe(write)
    expect(hasHouseholdPermission(role, 'adminDelete')).toBe(adminDelete)
  })
})

describe('useHouseholdCan / useHouseholdPermission', () => {
  it('denies writes for a GUEST with a translated hint', () => {
    const { result } = renderHook(() => useHouseholdPermission('write'), { wrapper: withRole('GUEST') })
    expect(result.current.allowed).toBe(false)
    expect(result.current.hint).toMatch(/Guests can view/)
  })

  it('lets a MEMBER write but not delete shared structures', () => {
    const wrapper = withRole('MEMBER')
    expect(renderHook(() => useHouseholdCan('write'), { wrapper }).result.current).toBe(true)
    const { result } = renderHook(() => useHouseholdPermission('adminDelete'), { wrapper })
    expect(result.current).toEqual({ allowed: false, hint: expect.stringMatching(/admins and owners/) })
  })

  it('allows everything for an ADMIN', () => {
    const { result } = renderHook(() => useHouseholdPermission('adminDelete'), { wrapper: withRole('ADMIN') })
    expect(result.current).toEqual({ allowed: true, hint: undefined })
  })

  it('allows everything outside a provider (the backend still enforces)', () => {
    expect(renderHook(() => useHouseholdCan('adminDelete')).result.current).toBe(true)
  })
})

describe('PermissionHint', () => {
  it('wraps children in a tooltip only when a hint is given', () => {
    const { rerender } = render(<PermissionHint hint="nope"><button disabled>Delete</button></PermissionHint>)
    expect(screen.getByTestId('permission-hint')).toHaveAttribute('title', 'nope')
    rerender(<PermissionHint hint={undefined}><button>Delete</button></PermissionHint>)
    expect(screen.queryByTestId('permission-hint')).toBeNull()
  })
})

describe('HouseholdReadOnlyNotice', () => {
  it('renders for a GUEST only', () => {
    const { unmount } = render(<HouseholdReadOnlyNotice />, { wrapper: withRole('GUEST') })
    expect(screen.getByRole('note')).toHaveTextContent(/guest access/)
    unmount()
    render(<HouseholdReadOnlyNotice />, { wrapper: withRole('MEMBER') })
    expect(screen.queryByRole('note')).toBeNull()
  })
})
