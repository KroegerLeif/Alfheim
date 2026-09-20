import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders } from '../../../../tests/test-utils'
import { UserAppsSection } from '../UserAppsSection'
import { AppItem } from '@/shared/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} data-next-link="true" {...props}>
      {children}
    </a>
  ),
}))

function makeLink(overrides: Partial<AppItem> = {}): AppItem {
  return {
    id: 'link-1',
    slug: 'link-1',
    title: 'My Bookmark',
    description: 'desc',
    icon: 'link',
    url: 'https://example.com',
    app_url: 'https://example.com',
    category: 'user',
    tier: 'user',
    status: 'active',
    ...overrides,
  }
}

describe('UserAppsSection navigation targets', () => {
  it('opens a genuine external bookmark in a new tab, not via next/link', () => {
    renderWithProviders(
      <UserAppsSection
        isLoading={false}
        isError={false}
        apps={[makeLink()]}
        onOpenAddModal={vi.fn()}
        onOpenEditModal={vi.fn()}
      />
    )

    const link = screen.getByRole('link', { name: /open_link/i })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).not.toHaveAttribute('data-next-link')
  })

  it('does not treat a same-origin path owned by another microfrontend as an internal dashboard route', () => {
    renderWithProviders(
      <UserAppsSection
        isLoading={false}
        isError={false}
        apps={[makeLink({ url: '/pantry', app_url: '/pantry' })]}
        onOpenAddModal={vi.fn()}
        onOpenEditModal={vi.fn()}
      />
    )

    const link = screen.getByRole('link', { name: /open_link/i })
    expect(link).toHaveAttribute('href', '/pantry')
    expect(link).not.toHaveAttribute('data-next-link')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('uses next/link for a route this dashboard app actually serves', () => {
    renderWithProviders(
      <UserAppsSection
        isLoading={false}
        isError={false}
        apps={[makeLink({ url: '/settings', app_url: '/settings' })]}
        onOpenAddModal={vi.fn()}
        onOpenEditModal={vi.fn()}
      />
    )

    const link = screen.getByRole('link', { name: /open_link/i })
    expect(link).toHaveAttribute('href', '/settings')
    expect(link).toHaveAttribute('data-next-link', 'true')
  })
})
