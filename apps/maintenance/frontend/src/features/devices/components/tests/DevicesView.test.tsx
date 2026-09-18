import React from 'react'
import { screen, render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StaticHouseholdProvider } from '@alfheim/shared'
import { LayoutProvider } from '../../../../shared/layout/LayoutContext'
import { DevicesView } from '../DevicesView'

describe('DevicesView Component', () => {
  it('passes accessibility audit', async () => {
    const queryClient = new QueryClient()
    const { container } = render(
      <StaticHouseholdProvider householdId="hh-1">
        <QueryClientProvider client={queryClient}>
          <LayoutProvider>
            <DevicesView />
          </LayoutProvider>
        </QueryClientProvider>
      </StaticHouseholdProvider>
    )
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders provided devices when query cache is populated', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['devices', { activeHouseholdId: 'hh-1' }, null], [
      {
        id: 1,
        name: 'Washing Machine',
        model: 'WM-2000',
        serial: 'SN-12345',
        category: 'Appliance',
        location: 'Laundry Room',
        status: 'active',
        service_interval_months: 6,
        household_id: 1,
      },
      {
        id: 2,
        name: 'Dishwasher',
        model: 'DW-500',
        serial: 'SN-67890',
        category: 'Appliance',
        location: 'Kitchen',
        status: 'active',
        service_interval_months: 3,
        household_id: 1,
      },
    ])

    render(
      <StaticHouseholdProvider householdId="hh-1">
        <QueryClientProvider client={queryClient}>
          <LayoutProvider>
            <DevicesView />
          </LayoutProvider>
        </QueryClientProvider>
      </StaticHouseholdProvider>
    )

    expect(screen.getByText('Washing Machine')).toBeInTheDocument()
    expect(screen.getByText('Dishwasher')).toBeInTheDocument()
  })
})
