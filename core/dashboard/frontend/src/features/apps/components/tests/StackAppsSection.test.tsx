import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { renderWithProviders } from '../../../../tests/test-utils'
import { StackAppsSection } from '../StackAppsSection'
import { AppItem } from '@/shared/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} data-next-link="true" {...props}>
      {children}
    </a>
  ),
}))

function makeApp(overrides: Partial<AppItem> = {}): AppItem {
  return {
    id: 'nextcloud',
    slug: 'nextcloud',
    title: 'Nextcloud Storage',
    description: 'desc',
    icon: 'cloud',
    url: '/nextcloud',
    app_url: '/nextcloud',
    category: 'external',
    tier: 'stack',
    status: 'active',
    ...overrides,
  }
}

describe('StackAppsSection navigation targets', () => {
  it('does not use next/link for a same-origin path this app does not own (a Caddy-proxied stack app)', () => {
    renderWithProviders(
      <StackAppsSection isLoading={false} isError={false} apps={[makeApp()]} />
    )

    const link = screen.getByRole('link', { name: /open_portal/i })
    expect(link).toHaveAttribute('href', '/nextcloud')
    expect(link).not.toHaveAttribute('data-next-link')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('uses next/link only for a route this dashboard app actually serves', () => {
    renderWithProviders(
      <StackAppsSection
        isLoading={false}
        isError={false}
        apps={[makeApp({ id: 'plex', slug: 'plex', status: 'in_progress' })]}
      />
    )

    const link = screen.getByRole('link', { name: /open_portal/i })
    expect(link.getAttribute('href')).toMatch(/^\/under-construction/)
    expect(link).toHaveAttribute('data-next-link', 'true')
  })

  it('opens a genuinely external URL in a new tab', () => {
    renderWithProviders(
      <StackAppsSection
        isLoading={false}
        isError={false}
        apps={[makeApp({ id: 'home-assistant', url: 'http://homeassistant.local', app_url: 'http://homeassistant.local' })]}
      />
    )

    const link = screen.getByRole('link', { name: /open_portal/i })
    expect(link).toHaveAttribute('href', 'http://homeassistant.local')
    expect(link).toHaveAttribute('target', '_blank')
  })
})
