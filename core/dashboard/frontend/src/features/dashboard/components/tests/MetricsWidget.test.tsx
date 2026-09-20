import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { MetricsWidget } from '../MetricsWidget'

describe('MetricsWidget', () => {
  it('renders real readings when the backend reports available metrics', async () => {
    server.use(
      http.get('*api/v1/telemetry/metrics', () =>
        HttpResponse.json({
          available: true,
          cpu_percent: 42.5,
          memory_percent: 50,
          memory_used_gb: 8,
          memory_total_gb: 16,
          network_rx_mbps: 12.3,
          network_tx_mbps: 4.5,
          uptime_seconds: 3661,
          active_containers: 6,
        })
      )
    )

    renderWithProviders(<MetricsWidget />)

    await waitFor(() => expect(screen.getByText('42.5%')).toBeInTheDocument())
    expect(screen.getByText('8 / 16 GB')).toBeInTheDocument()
    expect(screen.getByText('telemetry_live_stream')).toBeInTheDocument()
  })

  it('renders an explicit unavailable state instead of fabricating numbers', async () => {
    server.use(
      http.get('*api/v1/telemetry/metrics', () =>
        HttpResponse.json({
          available: false,
          message: 'victoriametrics is unreachable',
          uptime_seconds: 10,
        })
      )
    )

    renderWithProviders(<MetricsWidget />)

    await waitFor(() => expect(screen.getByText('telemetry_unavailable')).toBeInTheDocument())
    expect(screen.getByText('victoriametrics is unreachable')).toBeInTheDocument()
    expect(screen.queryByText('42.5%')).not.toBeInTheDocument()
  })

  it('renders unavailable when victoriametrics is reachable but has no host metrics', async () => {
    server.use(
      http.get('*api/v1/telemetry/metrics', () =>
        HttpResponse.json({
          available: true,
          message: 'victoriametrics is reachable but has no host-level metrics available yet',
          uptime_seconds: 10,
        })
      )
    )

    renderWithProviders(<MetricsWidget />)

    await waitFor(() => expect(screen.getByText('telemetry_unavailable')).toBeInTheDocument())
    expect(
      screen.getByText('victoriametrics is reachable but has no host-level metrics available yet')
    ).toBeInTheDocument()
  })
})
