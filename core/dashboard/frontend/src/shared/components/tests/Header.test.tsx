import React from 'react'
import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppHeaderProps } from '@alfheim/shared'
import { Header } from '../Header'

const appHeaderMock = vi.fn((_props: AppHeaderProps) => null)

vi.mock('@alfheim/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alfheim/shared')>()
  return {
    ...actual,
    AppHeader: (props: AppHeaderProps) => appHeaderMock(props),
    useTranslation: () => ({ t: (key: string) => key }),
  }
})

vi.mock('@/core/providers', () => ({
  useAuth: () => ({
    user: { name: 'Test User', preferred_username: 'test', email: 'test@example.com' },
    logout: () => {},
  }),
}))

describe('dashboard Header', () => {
  beforeEach(() => {
    appHeaderMock.mockClear()
  })

  it('renders no search field and no notification bell', () => {
    render(<Header />)

    const props = appHeaderMock.mock.calls[0][0]
    expect(props.centerSlot).toBeUndefined()
    expect(props.notificationSlot).toBeUndefined()
  })

  it('passes the authenticated user to the shared header', () => {
    render(<Header />)

    const props = appHeaderMock.mock.calls[0][0]
    expect(props.user).toEqual({
      name: 'Test User',
      preferred_username: 'test',
      email: 'test@example.com',
    })
  })
})
