import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders } from '../../../../tests/test-utils'
import { CoreAppsSection } from '../CoreAppsSection'
import { AppItem } from '@/shared/types'

// next/link is tagged with data-next-link so tests can tell a Next.js
// client-side navigation apart from a plain full-page <a href> -- the whole
// point of the #548 fix is that cross-microfrontend tiles must NOT use
// next/link, since this app has no route knowledge of e.g. /pantry.
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} data-next-link="true" {...props}>
      {children}
    </a>
  ),
}))

function makeApp(overrides: Partial<AppItem> = {}): AppItem {
  return {
    id: 'pantry',
    slug: 'pantry',
    title: 'Digital Pantry',
    description: 'desc',
    icon: 'kitchen',
    url: '/pantry',
    app_url: '/pantry',
    category: 'internal',
    tier: 'core',
    status: 'active',
    ...overrides,
  }
}

describe('CoreAppsSection navigation targets', () => {
  it('opens a Tier-1 app served by another microfrontend with a full-page navigation, not next/link', () => {
    renderWithProviders(
      <CoreAppsSection isLoading={false} isError={false} apps={[makeApp()]} refetch={vi.fn()} />
    )

    const launchLink = screen.getByRole('link', { name: /launch/i })
    expect(launchLink).toHaveAttribute('href', '/pantry')
    expect(launchLink).not.toHaveAttribute('data-next-link')
  })

  it('routes an in-progress app to /under-construction using next/link (a route this app owns)', () => {
    renderWithProviders(
      <CoreAppsSection
        isLoading={false}
        isError={false}
        apps={[makeApp({ id: 'todo', slug: 'todo', status: 'in_progress', title: 'Task Tracker' })]}
        refetch={vi.fn()}
      />
    )

    const launchLink = screen.getByRole('link', { name: /launch/i })
    expect(launchLink.getAttribute('href')).toMatch(/^\/under-construction/)
    expect(launchLink).toHaveAttribute('data-next-link', 'true')
  })

  it('does not client-route the "manage visibility" link to /settings (a dashboard-owned route) any differently', () => {
    renderWithProviders(
      <CoreAppsSection isLoading={false} isError={false} apps={[makeApp()]} refetch={vi.fn()} />
    )

    const manageLink = screen.getByRole('link', { name: /manage visibility/i })
    expect(manageLink).toHaveAttribute('href', '/settings')
  })
})

describe('CoreAppsSection live health', () => {
  it('shows the probed state of each app next to its configured status', () => {
    renderWithProviders(
      <CoreAppsSection
        isLoading={false}
        isError={false}
        apps={[makeApp(), makeApp({ id: 'chat', slug: 'chat', title: 'Chat' }), makeApp({ id: 'budget', slug: 'budget', title: 'Budget' })]}
        refetch={vi.fn()}
        health={{ pantry: 'online', chat: 'offline', budget: 'degraded' }}
      />
    )

    const states = screen.getAllByRole('status').map((el) => el.getAttribute('data-health'))
    expect(states).toEqual(['online', 'offline', 'degraded'])
    expect(screen.getByText('Offline')).toBeInTheDocument()
    expect(screen.getByLabelText('Live status: Degraded')).toBeInTheDocument()
  })

  it('shows a pending state until the first probe answered', () => {
    renderWithProviders(
      <CoreAppsSection isLoading={false} isError={false} apps={[makeApp()]} refetch={vi.fn()} />
    )

    expect(screen.getByRole('status')).toHaveAttribute('data-health', 'unknown')
  })

  it('renders the empty state when no app is enabled', () => {
    renderWithProviders(
      <CoreAppsSection isLoading={false} isError={false} apps={undefined} refetch={vi.fn()} />
    )

    expect(screen.getByText('0 active')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
