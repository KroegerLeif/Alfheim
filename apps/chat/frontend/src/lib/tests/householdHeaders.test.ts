import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { subscribeHouseholdErrors } from '@alfheim/shared'
import { listConversations, streamAssistantReply, uploadAttachment, ApiError } from '../api'

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function headerOf(call: unknown[], name: string): string | null {
  const init = call[1] as RequestInit | undefined
  return new Headers(init?.headers).get(name)
}

describe('chat API household context', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('alfheim_active_household_id', 'hh-chat')
    fetchSpy = vi.fn().mockImplementation(async () => jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends X-Household-ID (and never X-Household-Role) on REST calls', async () => {
    await listConversations()
    expect(headerOf(fetchSpy.mock.calls[0], 'X-Household-ID')).toBe('hh-chat')
    expect(headerOf(fetchSpy.mock.calls[0], 'X-Household-Role')).toBeNull()
  })

  it('sends X-Household-ID on the SSE stream and uploads', async () => {
    fetchSpy.mockImplementation(async () => new Response(null, { status: 204 }))
    await streamAssistantReply('c-1', { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() } as never)
    expect(headerOf(fetchSpy.mock.calls[0], 'X-Household-ID')).toBe('hh-chat')

    fetchSpy.mockImplementation(async () => jsonResponse(200, { id: 'a-1' }))
    await uploadAttachment(new File(['x'], 'x.txt'))
    expect(headerOf(fetchSpy.mock.calls[1], 'X-Household-ID')).toBe('hh-chat')
  })

  it('reports household_required and keeps the structured code on ApiError', async () => {
    fetchSpy.mockImplementation(async () =>
      jsonResponse(400, { detail: { code: 'household_required', message: 'X-Household-ID header is required' } }),
    )
    const listener = vi.fn()
    const unsubscribe = subscribeHouseholdErrors(listener)
    const err = await listConversations().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, code: 'household_required', message: 'X-Household-ID header is required' })
    expect(listener).toHaveBeenCalledWith({ code: 'household_required', householdId: 'hh-chat' })
    unsubscribe()
  })
})
