import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BottomNavBar } from '../BottomNavBar'
import { NavAnchor } from '../NavAnchor'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

describe('BottomNavBar', () => {
  it('points profile and household at the core/household app', () => {
    render(<BottomNavBar />)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/', '/household/profile', '/household', '/settings'])
    expect(hrefs).not.toContain('/profile')
  })
})

describe('NavAnchor', () => {
  it('renders a plain anchor for external targets', () => {
    render(
      <NavAnchor href="/household" external>
        Household
      </NavAnchor>
    )
    expect(screen.getByRole('link', { name: 'Household' })).toHaveAttribute('href', '/household')
  })

  it('renders a Next link for internal targets', () => {
    render(<NavAnchor href="/settings">Settings</NavAnchor>)
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })
})
