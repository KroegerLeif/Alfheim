import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { householdHeaders, subscribeHouseholdErrors } from '@alfheim/shared'
import { shoppingClient, pantryClient } from '../api'
import { ShoppingErrorBanner } from '@/features/shopping-lists/components/ShoppingErrorBanner'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('shopping API clients household context', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the active household as X-Household-ID and never X-Household-Role', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-active')
    await shoppingClient.get('api/v1/shopping-lists').json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-active')
    expect(request.headers.get('X-Household-Role')).toBeNull()
  })

  it('keeps an explicit target household (pantry sync) instead of the active one', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-active')
    await pantryClient.post('api/v1/products', { json: {}, headers: householdHeaders('hh-target') }).json()
    const request = fetchSpy.mock.calls[0][0] as Request
    expect(request.headers.get('X-Household-ID')).toBe('hh-target')
  })

  it('reports household_forbidden and keeps the code on the thrown error', async () => {
    localStorage.setItem('alfheim_active_household_id', 'hh-active')
    fetchSpy.mockImplementation(async () =>
      jsonResponse(403, { detail: { code: 'household_forbidden', message: 'Not a member' } }),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    await expect(shoppingClient.get('api/v1/shopping-lists').json()).rejects.toMatchObject({
      status: 403,
      code: 'household_forbidden',
    })
    expect(listener).toHaveBeenCalledWith({ code: 'household_forbidden', householdId: 'hh-active' })
    unsubscribe()
  })

  it('throws an empty message instead of a raw translation key for non-JSON error bodies', async () => {
    fetchSpy.mockImplementation(async () => new Response('Bad gateway', { status: 502 }))
    await expect(shoppingClient.get('api/v1/shopping-lists').json()).rejects.toMatchObject({
      status: 502,
      message: '',
    })
  })
})

describe('ShoppingErrorBanner', () => {
  it('does not call a 403 an expired session', () => {
    render(<ShoppingErrorBanner listsErrObj={{ status: 403, code: 'household_role_forbidden', message: 'x' }} refetchLists={() => {}} />)
    expect(screen.queryByText('Session Expired')).not.toBeInTheDocument()
    expect(screen.getByText('Access Denied')).toBeInTheDocument()
  })

  it('asks to log in again on 401', () => {
    render(<ShoppingErrorBanner listsErrObj={{ status: 401, message: 'x' }} refetchLists={() => {}} />)
    expect(screen.getByText('Session Expired')).toBeInTheDocument()
  })

  it('shows the server message and keeps very long text inside the card', () => {
    const message = 'Backend said no '.repeat(60).trim()
    render(<ShoppingErrorBanner listsErrObj={new Error(message)} refetchLists={() => {}} />)
    expect(screen.getByText(message)).toHaveClass('break-words')
  })

  it('offers a retry for other failures', () => {
    const refetch = vi.fn()
    render(<ShoppingErrorBanner listsErrObj={{ status: 500, message: '' }} refetchLists={refetch} />)
    expect(screen.getByText('Failed to Load Shopping Lists')).toBeInTheDocument()
    screen.getByRole('button', { name: 'Retry' }).click()
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
