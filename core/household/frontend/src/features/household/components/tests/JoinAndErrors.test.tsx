import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/tests/mocks/server'
import { renderWithProviders } from '@/tests/test-utils'
import { JoinHouseholdForm } from '../JoinHouseholdForm'
import { DeleteHouseholdModal } from '../DeleteHouseholdModal'
import { HouseholdDetailView } from '../HouseholdDetailView'
import { ACTIVE_HOUSEHOLD_STORAGE_KEY, HOUSEHOLD_CHANGED_EVENT } from '@/lib/activeHousehold'

describe('JoinHouseholdForm', () => {
  it('auto-redeems a token and activates the household like the shared switcher', async () => {
    const bodies: unknown[] = []
    server.use(
      http.post('*/api/v1/households/join', async ({ request }) => {
        bodies.push(await request.json())
        return HttpResponse.json({ id: 'hh-9', name: 'Asgard', role: 'MEMBER' })
      }),
    )
    const changed = vi.fn()
    window.addEventListener(HOUSEHOLD_CHANGED_EVENT, changed)
    const onJoined = vi.fn()

    renderWithProviders(<JoinHouseholdForm initialToken="abc" autoSubmit onJoined={onJoined} />)

    await waitFor(() => expect(onJoined).toHaveBeenCalledWith(expect.objectContaining({ id: 'hh-9' })))
    expect(bodies).toEqual([{ token: 'abc' }])
    expect(localStorage.getItem(ACTIVE_HOUSEHOLD_STORAGE_KEY)).toBe('hh-9')
    expect(localStorage.getItem('alfheim_active_household_role')).toBeNull()
    expect(changed).toHaveBeenCalled()
    window.removeEventListener(HOUSEHOLD_CHANGED_EVENT, changed)
  })

  it('explains an invalid or expired invite (404)', async () => {
    server.use(
      http.post('*/api/v1/households/join', () => HttpResponse.json({ error: 'not found' }, { status: 404 })),
    )
    renderWithProviders(<JoinHouseholdForm onJoined={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join household' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This invite code is invalid, expired or has been revoked.',
    )
  })
})

describe('DeleteHouseholdModal', () => {
  it('only enables deletion once the exact name is typed', () => {
    const onConfirm = vi.fn()
    renderWithProviders(
      <DeleteHouseholdModal isOpen householdName="Valhalla" isPending={false} error={null} onClose={vi.fn()} onConfirm={onConfirm} />,
    )
    const button = screen.getByRole('button', { name: 'Delete permanently' })
    const input = screen.getByLabelText('Type Valhalla to confirm')

    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: 'valhalla' } })
    expect(button).toBeDisabled()
    fireEvent.change(input, { target: { value: 'Valhalla' } })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

describe('HouseholdDetailView errors', () => {
  it.each([
    [403, "You don't have permission to do this in this household."],
    [404, 'not_found'],
  ])('renders a clear message for %s', async (status, text) => {
    server.use(
      http.get('*/api/v1/households/hh-x', () => HttpResponse.json({ error: 'x' }, { status })),
      http.get('*/api/v1/households/hh-x/contacts', () => HttpResponse.json([])),
      http.get('*/api/v1/households/hh-x/contact-categories', () => HttpResponse.json([])),
    )
    renderWithProviders(<HouseholdDetailView householdId="hh-x" />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(text)
  })
})
