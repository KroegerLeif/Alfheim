import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach } from 'vitest'
import { axe } from 'vitest-axe'
import { renderWithProviders, createTestQueryClient } from '../../../../tests/test-utils'
import { QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { DashboardView } from '../DashboardView'
import { choreKeys } from '../../services/choresService'
import { mockTemplates, mockInstances, mockSummary } from '../../../../tests/mocks/handlers'

describe('DashboardView Component', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('alfheim_active_household_id', 'hh-1')
  })

  it('passes accessibility audit', async () => {
    const { container } = renderWithProviders(<DashboardView />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('renders dashboard headers, integration panels, and chores list', async () => {
    renderWithProviders(<DashboardView />)

    // Verify main header and subtitle
    expect(screen.getByText('dashboardTitle')).toBeInTheDocument()
    expect(screen.getByText('dashboardSubtitle')).toBeInTheDocument()

    // Verify cross-app integration panels
    expect(screen.getByText('shoppingSync')).toBeInTheDocument()
    expect(screen.getByText('deviceMaintenance')).toBeInTheDocument()

    // Wait for MSW mock data to populate and verify rendered chore task
    await waitFor(() => {
      expect(screen.getByText('Vacuum Living Room')).toBeInTheDocument()
      expect(screen.getByText('Clean the carpet and rug')).toBeInTheDocument()
    })
  })

  it('renders pre-populated query cache with integration metrics and streak', () => {
    const queryClient = createTestQueryClient()
    const hhId = 'hh-1'

    queryClient.setQueryData(choreKeys.templates(hhId), mockTemplates)
    queryClient.setQueryData(choreKeys.today(hhId, '2026-08-16'), mockInstances)
    queryClient.setQueryData(choreKeys.summary(hhId), mockSummary)
    queryClient.setQueryData(['integrations', 'shopping', hhId], { pendingCount: 3, totalLists: 2 })
    queryClient.setQueryData(['integrations', 'maintenance', hhId], { dueCount: 2, totalDevices: 5 })

    render(
      <QueryClientProvider client={queryClient}>
        <DashboardView />
      </QueryClientProvider>
    )

    // Verify populated chore items and metrics
    expect(screen.getByText('Vacuum Living Room')).toBeInTheDocument()
    expect(screen.getByText('Clean the carpet and rug')).toBeInTheDocument()
    expect(screen.getByText('3 OFFEN')).toBeInTheDocument()
    expect(screen.getByText('! 2 FÄLLIG')).toBeInTheDocument()
    expect(screen.getByText('householdStreak')).toBeInTheDocument()
  })

  it('allows toggling date filters between today and tomorrow', async () => {
    const user = userEvent.setup()
    renderWithProviders(<DashboardView />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Vacuum Living Room')).toBeInTheDocument()
    })

    // Click Tomorrow tab
    const tomorrowBtn = screen.getByRole('button', { name: /tomorrow/i })
    expect(tomorrowBtn).toBeInTheDocument()
    await user.click(tomorrowBtn)

    // Click Today tab to switch back
    const todayBtn = screen.getByRole('button', { name: /today/i })
    await user.click(todayBtn)
  })
})
