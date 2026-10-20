import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeAll } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { OperatorTelemetry } from '../OperatorTelemetry'

describe('OperatorTelemetry', () => {
  beforeAll(() => {
    // jsdom does not implement scrollIntoView, which the log feed calls on every update.
    window.HTMLElement.prototype.scrollIntoView = () => undefined
  })

  it('shows the metrics widget to operators', async () => {
    server.use(
      http.get('*api/v1/user/capabilities', () => HttpResponse.json({ operator: true })),
      http.get('*api/v1/telemetry/metrics', () =>
        HttpResponse.json({ available: true, cpu_percent: 42.5, uptime_seconds: 10 })
      ),
      http.get('*api/v1/telemetry/logs', () => HttpResponse.json({ logs: [], total: 0 }))
    )

    renderWithProviders(<OperatorTelemetry />)

    await waitFor(() => expect(screen.getByText('42.5%')).toBeInTheDocument())
    expect(screen.queryByText('Operator access required')).not.toBeInTheDocument()
  })

  it('hides the widgets from non-operators and never requests telemetry', async () => {
    let telemetryRequests = 0
    server.use(
      http.get('*api/v1/user/capabilities', () => HttpResponse.json({ operator: false })),
      http.get('*api/v1/telemetry*', () => {
        telemetryRequests += 1
        return HttpResponse.json({}, { status: 403 })
      })
    )

    renderWithProviders(<OperatorTelemetry />)

    await waitFor(() => expect(screen.getByText('Operator access required')).toBeInTheDocument())
    expect(telemetryRequests).toBe(0)
  })

  it('treats a failed capabilities lookup as non-operator', async () => {
    server.use(http.get('*api/v1/user/capabilities', () => HttpResponse.json({}, { status: 500 })))

    renderWithProviders(<OperatorTelemetry />)

    await waitFor(() => expect(screen.getByText('Operator access required')).toBeInTheDocument())
  })
})
