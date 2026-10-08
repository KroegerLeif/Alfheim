import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { CoreAppsSection } from '../CoreAppsSection'
import { StackAppsSection } from '../StackAppsSection'
import { UserAppsSection } from '../UserAppsSection'
import { AddAppModal } from '../AddAppModal'
import { EditAppModal } from '../EditAppModal'
import { PRESET_ICON_NAMES } from '../../presetIcons'
import { AppItem } from '@/shared/types'

const LONG_NAME = 'SupercalifragilisticexpialidociousServiceNameThatNeverEndsAndHasNoSpacesAtAllForOverflowChecks'

function makeApp(overrides: Partial<AppItem> = {}): AppItem {
  return {
    id: 'app-1',
    slug: 'app-1',
    title: LONG_NAME,
    description: LONG_NAME.repeat(3),
    icon: 'link',
    url: 'https://example.com',
    app_url: 'https://example.com',
    category: 'user',
    tier: 'user',
    status: 'active',
    ...overrides,
  }
}

describe('long names and descriptions stay inside the app cards', () => {
  it.each([
    ['core', (apps: AppItem[]) => <CoreAppsSection isLoading={false} isError={false} apps={apps} refetch={vi.fn()} />],
    ['stack', (apps: AppItem[]) => <StackAppsSection isLoading={false} isError={false} apps={apps} />],
    [
      'user',
      (apps: AppItem[]) => (
        <UserAppsSection isLoading={false} isError={false} apps={apps} onOpenAddModal={vi.fn()} onOpenEditModal={vi.fn()} />
      ),
    ],
  ])('truncates the title and wraps the description in the %s section', (_name, render) => {
    renderWithProviders(render([makeApp()]))
    const title = screen.getByRole('heading', { name: LONG_NAME })
    expect(title).toHaveClass('truncate')
    expect(title).toHaveAttribute('title', LONG_NAME)
    expect(screen.getByText(LONG_NAME.repeat(3))).toHaveClass('break-words')
    expect(title.closest('div.min-w-0')).not.toBeNull()
  })

  it.each([
    ['core', <CoreAppsSection key="c" isLoading={false} isError apps={[]} refetch={vi.fn()} />],
    ['stack', <StackAppsSection key="s" isLoading={false} isError apps={[]} />],
    ['user', <UserAppsSection key="u" isLoading={false} isError apps={[]} onOpenAddModal={vi.fn()} onOpenEditModal={vi.fn()} />],
  ])('spans the full grid width for the %s error box, not three fixed columns on phones', (_name, element) => {
    const { container } = renderWithProviders(element)
    expect(container.querySelector('.col-span-3')).toBeNull()
    expect(container.querySelector('.col-span-full')).not.toBeNull()
  })
})

describe('localized labels', () => {
  it.each([
    ['de', 'Meine persönlichen Links'],
    ['pl', null],
  ] as const)('renders the user section heading in %s', (language, expected) => {
    renderWithProviders(
      <UserAppsSection isLoading={false} isError={false} apps={[]} onOpenAddModal={vi.fn()} onOpenEditModal={vi.fn()} />,
      undefined,
      language
    )
    expect(screen.getByRole('heading', { level: 2 }).textContent).not.toBe('My Personal Links')
    if (expected) expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(expected)
  })

  it('shows translated icon names instead of English fallbacks in the icon picker', () => {
    renderWithProviders(<AddAppModal isOpen onClose={vi.fn()} />, undefined, 'de')
    expect(PRESET_ICON_NAMES).toHaveLength(12)
    expect(screen.getByTitle('Lesezeichen-Link')).toBeInTheDocument()
    expect(screen.getByTitle('KI-Assistent')).toBeInTheDocument()
    expect(screen.queryByTitle('Bookmark Link')).not.toBeInTheDocument()
  })

  it('uses a translated name for the under-construction fallback', () => {
    renderWithProviders(<AddAppModal isOpen onClose={vi.fn()} />, undefined, 'pl')
    expect(screen.getByTitle('Link zakładki')).toBeInTheDocument()
  })
})

describe('failed saves show a localized message', () => {
  it('shows the localized failure when creating a bookmark fails', async () => {
    server.use(http.post('*api/v1/user/links', () => HttpResponse.json({ error: 'boom' }, { status: 500 })))
    const user = userEvent.setup()
    renderWithProviders(<AddAppModal isOpen onClose={vi.fn()} />)
    await user.type(screen.getByPlaceholderText('e.g. My Google Drive'), 'Drive')
    await user.type(screen.getByPlaceholderText('https://drive.google.com'), 'https://drive.example.com')
    await user.click(screen.getByRole('button', { name: /save bookmark/i }))
    expect(await screen.findByText('Failed to register new service')).toBeInTheDocument()
  })

  it('validates the title in the active language before sending a request', async () => {
    const requests = vi.fn()
    server.use(http.post('*api/v1/user/links', () => { requests(); return HttpResponse.json({}) }))
    const { container } = renderWithProviders(<AddAppModal isOpen onClose={vi.fn()} />, undefined, 'de')
    fireEvent.submit(container.ownerDocument.querySelector('form')!)
    expect(await screen.findByText('Diensttitel ist erforderlich.')).toBeInTheDocument()
    expect(requests).not.toHaveBeenCalled()
  })

  it('shows the localized failure when deleting a bookmark fails', async () => {
    server.use(http.delete('*api/v1/user/links/:id', () => new HttpResponse(null, { status: 500 })))
    const user = userEvent.setup()
    renderWithProviders(<EditAppModal app={makeApp()} isOpen onClose={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /delete link/i }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(screen.getByText('Failed to delete user link')).toBeInTheDocument())
  })
})
