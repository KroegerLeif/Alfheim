import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { useChatStream } from '../useChatStream'
import { LanguageProvider } from '../../../i18n/utils/LanguageContext'

const englishWrapper = ({ children }: { children: ReactNode }) =>
  createElement(LanguageProvider, { defaultLanguage: 'en', children })

describe('useChatStream hook', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem('alfheim_access_token', 'valid-jwt')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('resets chat state when resetChat is called or when isOpen becomes false', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }) => useChatStream({ isOpen }),
      { initialProps: { isOpen: true } }
    )

    act(() => {
      result.current.resetChat()
    })
    expect(result.current.messages).toEqual([])
    expect(result.current.status).toBe('idle')

    rerender({ isOpen: false })
    expect(result.current.status).toBe('idle')
  })

  it('uploads files via attachments API endpoint', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'att-1', url: 'https://example.com/att.jpg' }),
    } as Response)

    const { result } = renderHook(() => useChatStream({ isOpen: true }))

    let uploaded: any
    await act(async () => {
      uploaded = await result.current.uploadFile(
        new File(['data'], 'doc.pdf', { type: 'application/pdf' })
      )
    })

    expect(uploaded).toEqual({ id: 'att-1', url: 'https://example.com/att.jpg' })
  })

  it('sends message, initializes conversation, and handles stream callbacks', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 'block-1', is_active: true }],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'conv-123' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('event: delta\ndata: {"text": "Hi"}\n\n'))
            controller.enqueue(new TextEncoder().encode('event: done\ndata: {}\n\n'))
            controller.close()
          },
        }),
      } as unknown as Response)

    const { result } = renderHook(() =>
      useChatStream({ isOpen: true, context: { sourceApp: 'pantry' } })
    )

    await act(async () => {
      await result.current.sendMessage('Hello', [{ id: 'att-1', url: 'blob:123' }])
    })

    expect(fetchSpy).toHaveBeenCalled()
    expect(result.current.messages.length).toBeGreaterThan(0)
  })

  it('sends the household header on REST and SSE requests', async () => {
    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'conv-1' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('event: done\ndata: {}\n\n'))
            controller.close()
          },
        }),
      } as unknown as Response)

    const { result } = renderHook(() => useChatStream({ isOpen: true, householdId: 'hh-42' }))

    await act(async () => {
      await result.current.sendMessage('Hello')
    })

    expect(fetchSpy).toHaveBeenCalledTimes(4)
    for (const [, init] of fetchSpy.mock.calls) {
      expect((init?.headers as Record<string, string>)['X-Household-ID']).toBe('hh-42')
    }
  })

  it('shows a translated error without the HTTP status when conversation initialization fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    const { result } = renderHook(() => useChatStream({ isOpen: true }), {
      wrapper: englishWrapper,
    })

    await act(async () => {
      await result.current.sendMessage('Fail message')
    })

    expect(result.current.error).toBe('The conversation could not be started.')
    expect(result.current.error).not.toMatch(/500/)
  })

  it('handles error when conversation initialization fails', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    const { result } = renderHook(() => useChatStream({ isOpen: true }))

    await act(async () => {
      await result.current.sendMessage('Fail message')
    })

    expect(result.current.error).toBeTruthy()
  })
})
