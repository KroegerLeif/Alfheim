import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../tests/test-utils'
import { server } from '../../../tests/mocks/server'
import SettingsPage from '../page'

vi.mock('@alfheim/shared', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@alfheim/shared')
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key.split('.').pop(),
      language: 'en',
      setLanguage: () => {},
    }),
    useTheme: () => ({
      variant: 'default',
      customColors: null,
      setCustomColors: vi.fn(),
      resolvedMode: 'dark',
    }),
  }
})

describe('SettingsPage', () => {
  it('has no "Save Changes" button, since every setting already auto-saves', async () => {
    server.use(
      http.get('*api/v1/apps/dashboard', () =>
        HttpResponse.json({
          core: [],
          stack: [],
          user: [],
          all_core: [{ id: 'pantry', slug: 'pantry', title: 'Pantry', description: '', icon: 'kitchen', url: '/pantry', category: 'internal', tier: 'core', status: 'active' }],
          preferences: { user_id: 'u1', hidden_app_ids: [] },
          total: 0,
        })
      )
    )

    renderWithProviders(<SettingsPage />)

    await waitFor(() => expect(screen.getByText('Pantry')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /save_changes/i })).not.toBeInTheDocument()
  })

  it('persists a visibility toggle immediately via PUT /api/v1/user/preferences and shows a real confirmation', async () => {
    let putBody: { hidden_app_ids: string[] } | null = null
    server.use(
      http.get('*api/v1/apps/dashboard', () =>
        HttpResponse.json({
          core: [],
          stack: [],
          user: [],
          all_core: [{ id: 'pantry', slug: 'pantry', title: 'Pantry', description: '', icon: 'kitchen', url: '/pantry', category: 'internal', tier: 'core', status: 'active' }],
          preferences: { user_id: 'u1', hidden_app_ids: [] },
          total: 0,
        })
      ),
      http.put('*api/v1/user/preferences', async ({ request }) => {
        putBody = (await request.json()) as { hidden_app_ids: string[] }
        return HttpResponse.json({ user_id: 'u1', hidden_app_ids: putBody.hidden_app_ids })
      })
    )

    const user = userEvent.setup()
    renderWithProviders(<SettingsPage />)

    await waitFor(() => expect(screen.getByText('Pantry')).toBeInTheDocument())
    await user.click(screen.getByText('Pantry'))

    await waitFor(() => expect(putBody).toEqual({ hidden_app_ids: ['pantry'] }))
    await waitFor(() => expect(screen.getByText('visibility_updated')).toBeInTheDocument())
  })
})
