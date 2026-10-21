import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTestQueryClient, renderWithProviders } from './test-utils'
import { makeDevice, makeStep } from './fixtures'
import { DevicesView } from '../features/devices'
import { MaintenanceView } from '../features/maintenance'
import { ScheduledTaskItem } from '../features/scheduled/components/ScheduledTaskItem'
import { ShoppingView } from '../features/shopping'
import { CART_STORAGE_KEY } from '../features/shopping/hooks/useCart'

const GUEST_HINT = /Guests can view/

function renderAll(role: string) {
  const queryClient = createTestQueryClient()
  const device = makeDevice({ name: 'Boiler', steps: [makeStep({ title: 'Flush tank' })] })
  queryClient.setQueryData(['devices', { householdId: 'hh-1' }], [device])
  renderWithProviders(
    <>
      <DevicesView onStartMaintenance={vi.fn()} />
      <MaintenanceView onStartMaintenance={vi.fn()} />
      <ScheduledTaskItem step={device.steps[0]} device={device} />
      <ShoppingView />
    </>,
    { queryClient, householdValue: { role } }
  )
  fireEvent.click(screen.getByRole('button', { name: /Show Details/ }))
}

describe('household role gating', () => {
  beforeEach(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(['HEPA Filter']))
  })

  it('GUEST cannot add devices, start maintenance, save comments or send the cart', async () => {
    renderAll('GUEST')
    expect(screen.queryByRole('button', { name: 'Add Device' })).toBeNull()
    for (const name of [/^Start$/i, /Save Comment/i, /Send to Shopping App/i]) {
      const button = await screen.findByRole('button', { name })
      expect(button).toBeDisabled()
      expect(button.closest('[title]')).toHaveAttribute('title', expect.stringMatching(GUEST_HINT))
    }
  })

  it.each(['MEMBER', 'ADMIN'])('%s can use every maintenance control', async (role) => {
    renderAll(role)
    expect(screen.getByRole('button', { name: 'Add Device' })).toBeEnabled()
    for (const name of [/^Start$/i, /Save Comment/i, /Send to Shopping App/i]) {
      expect(await screen.findByRole('button', { name })).toBeEnabled()
    }
    expect(screen.queryByTestId('permission-hint')).toBeNull()
  })
})
