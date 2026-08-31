import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sanitizeApiUrl, getResolvedToken, readSSEStream } from '../sseClient'
import { StreamHandlers } from '../types'

describe('sseClient utilities', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sanitizeApiUrl trims trailing slashes', () => {
    expect(sanitizeApiUrl('/api/v1/chat/')).toBe('/api/v1/chat')
    expect(sanitizeApiUrl(undefined)).toBe('/api/v1/chat')
  })

  it('getResolvedToken prioritizes explicit token then session storage keys', () => {
    expect(getResolvedToken('explicit-token')).toBe('explicit-token')
    sessionStorage.setItem('token_chat-frontend', 'session-chat-token')
    expect(getResolvedToken()).toBe('session-chat-token')
  })

  it('readSSEStream parses stream frames and calls handlers', async () => {
    const handlers: StreamHandlers = {
      onDelta: vi.fn(),
      onToolCall: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    }

    const ssePayload =
      'event: delta\ndata: {"text": "Hello"}\n\n' +
      'event: tool_call\ndata: {"tool": "search"}\n\n' +
      'event: error\ndata: {"message": "Stream error occurred"}\n\n' +
      'event: done\ndata: {"usage": {"tokens": 10}}\n\n'

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(ssePayload))
        controller.close()
      },
    })

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as unknown as Response)

    await readSSEStream('/api/v1/chat/stream', 'token-123', handlers)

    expect(handlers.onDelta).toHaveBeenCalledWith('Hello')
    expect(handlers.onToolCall).toHaveBeenCalledWith({ tool: 'search' })
    expect(handlers.onError).toHaveBeenCalledWith('Stream error occurred')
    expect(handlers.onDone).toHaveBeenCalledWith({ tokens: 10 })
  })

  it('readSSEStream handles network error responses', async () => {
    const handlers: StreamHandlers = {
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server Internal Error' }),
    } as Response)

    await readSSEStream('/api/v1/chat/stream', 'token-123', handlers)
    expect(handlers.onError).toHaveBeenCalledWith('Server Internal Error')
  })

  it('readSSEStream handles fetch exceptions', async () => {
    const handlers: StreamHandlers = {
      onDelta: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    }

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection lost'))

    await readSSEStream('/api/v1/chat/stream', null, handlers)
    expect(handlers.onError).toHaveBeenCalledWith('Connection lost')
  })
})
