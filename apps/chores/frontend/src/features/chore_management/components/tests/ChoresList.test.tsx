import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../tests/test-utils'
import { server } from '../../../../tests/mocks/server'
import { ChoresList } from '../ChoresList'
import { mockTemplates, mockInstances } from '../../../../tests/mocks/handlers'

const MOCK_HARDCODED_USER_ID = '00000000-0000-0000-0000-000000000001'

describe('ChoresList Component', () => {
  it('claims an unassigned chore by calling /claim with no body and no client-supplied user id', async () => {
    const user = userEvent.setup()

    const unassignedChore = { ...mockInstances[0], id: 'inst-claim-test', assigned_to: null }
    let capturedUrl = ''
    let capturedHasBody = true
    let callCount = 0

    server.use(
      http.post('*/instances/:id/claim', async ({ request }) => {
        callCount += 1
        capturedUrl = request.url
        const text = await request.text()
        capturedHasBody = text.length > 0
        return HttpResponse.json({ ...unassignedChore, assigned_to: 'server-derived-caller-id' })
      }),
      // If the old (buggy) /assign call is ever made instead, fail loudly by
      // surfacing a body we can assert against.
      http.post('*/instances/:id/assign', async ({ request }) => {
        const body = await request.text()
        return HttpResponse.json({ error: `unexpected /assign call: ${body}` }, { status: 500 })
      })
    )

    renderWithProviders(
      <ChoresList chores={[unassignedChore]} templates={mockTemplates} dueDate="2026-08-16" />
    )

    const claimBtn = await screen.findByRole('button', { name: /claim/i })
    await user.click(claimBtn)

    await waitFor(() => expect(callCount).toBe(1))

    // Hits the dedicated self-service claim endpoint, not /assign.
    expect(capturedUrl).toContain('/claim')
    // The request carries no body at all -- the assignee is derived
    // server-side from the authenticated caller, never sent by the client.
    expect(capturedHasBody).toBe(false)
    expect(capturedUrl).not.toContain(MOCK_HARDCODED_USER_ID)
  })

  it('releases a claimed chore via the same self-service endpoint, with no body', async () => {
    const user = userEvent.setup()

    const claimedChore = { ...mockInstances[0], id: 'inst-release-test', assigned_to: 'server-derived-caller-id' }
    let capturedHasBody = true
    let callCount = 0

    server.use(
      http.post('*/instances/:id/claim', async ({ request }) => {
        callCount += 1
        const text = await request.text()
        capturedHasBody = text.length > 0
        return HttpResponse.json({ ...claimedChore, assigned_to: null })
      })
    )

    renderWithProviders(
      <ChoresList chores={[claimedChore]} templates={mockTemplates} dueDate="2026-08-16" />
    )

    const releaseBtn = await screen.findByRole('button', { name: /assigned/i })
    await user.click(releaseBtn)

    await waitFor(() => expect(callCount).toBe(1))
    expect(capturedHasBody).toBe(false)
  })
})
