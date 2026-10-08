import React from 'react'
import { screen } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { SystemShellLogs } from '../SystemShellLogs'

beforeAll(() => {
  // jsdom does not implement scrollIntoView, which the log feed calls on every update.
  window.HTMLElement.prototype.scrollIntoView = () => undefined
})

describe('SystemShellLogs', () => {
  it('renders the entries reported by the backend', async () => {
    server.use(
      http.get('*api/v1/telemetry/logs', () =>
        HttpResponse.json({
          logs: [{ id: 'l1', timestamp: '10:00:00.000', level: 'INFO', service: 'dashboard-go', message: 'GET /api/v1/user/preferences 200 OK (4ms)' }],
          total: 1,
        })
      )
    )
    renderWithProviders(<SystemShellLogs />)
    expect(await screen.findByText(/user\/preferences 200 OK/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it.each([
    ['en', 'Live log stream unavailable. Retrying...'],
    ['de', 'Live-Log-Stream nicht verfügbar. Neuer Versuch...'],
    ['pl', 'Strumień logów na żywo niedostępny. Ponawianie...'],
  ] as const)('says so in %s instead of silently showing an empty feed when the log request fails', async (language, message) => {
    server.use(http.get('*api/v1/telemetry/logs', () => new HttpResponse(null, { status: 500 })))
    renderWithProviders(<SystemShellLogs />, undefined, language)
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
