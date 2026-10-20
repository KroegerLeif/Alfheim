import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { encode } from 'uqr'
import { server } from '@/tests/mocks/server'
import { renderWithProviders } from '@/tests/test-utils'
import { buildJoinUrl, HOUSEHOLD_JOIN_URL } from '@/lib/routes'
import { InviteModal } from '../InviteModal'
import { InviteList } from '../InviteList'
import { InviteCodeResponse } from '@/shared/types'

const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()

// A freshly created invite carries the plaintext token; listed ones only an id.
const created: InviteCodeResponse = {
  id: 'hash-created',
  token: 'tok/with+chars',
  household_id: 'hh-1',
  role: 'MEMBER',
  expires_at: future,
  max_uses: 5,
  uses: 0,
}

const invite: InviteCodeResponse = {
  id: 'abcd1234ef567890',
  household_id: 'hh-1',
  role: 'MEMBER',
  expires_at: future,
  max_uses: 5,
  uses: 1,
}

afterEach(() => vi.restoreAllMocks())

describe('buildJoinUrl', () => {
  it('builds https://<host>/household/join?token=<token> with an encoded token', () => {
    expect(HOUSEHOLD_JOIN_URL).toBe('/household/join')
    expect(buildJoinUrl('abc123', 'https://home.example.com')).toBe(
      'https://home.example.com/household/join?token=abc123',
    )
    expect(buildJoinUrl('a/b+c', 'https://home.example.com/')).toBe(
      'https://home.example.com/household/join?token=a%2Fb%2Bc',
    )
  })

  it('defaults to the current origin', () => {
    expect(buildJoinUrl('x')).toBe(`${window.location.origin}/household/join?token=x`)
  })
})

describe('InviteModal QR code', () => {
  it('renders a real QR code encoding the join URL', () => {
    renderWithProviders(
      <InviteModal isOpen invite={created} onClose={vi.fn()} origin="https://home.example.com" />,
    )
    const expected = 'https://home.example.com/household/join?token=tok%2Fwith%2Bchars'
    const qr = screen.getByRole('img', { name: 'QR code for joining household' })
    expect(qr).toHaveAttribute('data-qr-value', expected)

    // The drawn modules match the encoder output for that exact URL.
    const matrix = encode(expected, { ecc: 'M', border: 2 })
    expect(qr.getAttribute('viewBox')).toBe(`0 0 ${matrix.size} ${matrix.size}`)
    const darkModules = matrix.data.flat().filter(Boolean).length
    const drawn = (qr.querySelector('path')?.getAttribute('d')?.match(/M/g) ?? []).length
    expect(drawn).toBe(darkModules)

    expect(screen.getByText(expected)).toBeInTheDocument()
    expect(screen.getByText('tok/with+chars')).toBeInTheDocument()
  })

  it('renders nothing for a listed invite that has no token', () => {
    renderWithProviders(<InviteModal isOpen invite={invite} onClose={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders nothing without an invite', () => {
    renderWithProviders(<InviteModal isOpen invite={null} onClose={vi.fn()} />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('InviteList listed invites', () => {
  it('offers no QR/copy action, explains the one-time link and never renders a token', async () => {
    server.use(http.get('*/api/v1/households/hh-1/invites', () => HttpResponse.json([invite])))
    renderWithProviders(<InviteList householdId="hh-1" onShowInvite={vi.fn()} />)

    await screen.findByText('abcd1234')
    expect(screen.queryByRole('button', { name: /QR/i })).not.toBeInTheDocument()
    expect(screen.getByText(/only shown once/i)).toBeInTheDocument()
  })
})

describe('InviteList revoke', () => {
  it('lists invites and revokes one via DELETE /households/{id}/invites/{inviteId}', async () => {
    let invites = [invite, { ...invite, id: 'second00-id' }]
    const deleted: string[] = []
    server.use(
      http.get('*/api/v1/households/hh-1/invites', () => HttpResponse.json(invites)),
      http.delete('*/api/v1/households/hh-1/invites/:token', ({ params }) => {
        deleted.push(decodeURIComponent(params.token as string))
        invites = invites.filter((i) => i.id !== decodeURIComponent(params.token as string))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithProviders(<InviteList householdId="hh-1" onShowInvite={vi.fn()} />)

    const revoke = await screen.findByRole('button', { name: 'Revoke invite second00' })
    expect(screen.getByText('abcd1234')).toBeInTheDocument()
    fireEvent.click(revoke)

    await waitFor(() => expect(deleted).toEqual(['second00-id']))
    await waitFor(() => expect(screen.queryByText('second00')).not.toBeInTheDocument())
    expect(screen.getByText('Invite revoked.')).toBeInTheDocument()
    expect(screen.getByText('abcd1234')).toBeInTheDocument()
  })

  it('does not revoke when the confirmation is cancelled', async () => {
    const deleteSpy = vi.fn(() => new HttpResponse(null, { status: 204 }))
    server.use(
      http.get('*/api/v1/households/hh-1/invites', () => HttpResponse.json([invite])),
      http.delete('*/api/v1/households/hh-1/invites/:token', deleteSpy),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    renderWithProviders(<InviteList householdId="hh-1" onShowInvite={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Revoke invite/ }))

    await new Promise((r) => setTimeout(r, 50))
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('shows a clear message when revoking is forbidden (403)', async () => {
    server.use(
      http.get('*/api/v1/households/hh-1/invites', () => HttpResponse.json([invite])),
      http.delete('*/api/v1/households/hh-1/invites/:token', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 }),
      ),
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderWithProviders(<InviteList householdId="hh-1" onShowInvite={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: /Revoke invite/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "You don't have permission to do this in this household.",
    )
  })
})
