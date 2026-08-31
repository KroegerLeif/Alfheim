import { describe, it, expect, vi } from 'vitest'
import {
  ApiClient,
  createApiClient,
  createTraceparentHook,
  withTraceparentHeaders,
  fetchWithTrace,
} from '../features/api/client'
import { generateW3CTraceparent } from '../features/api/traceparent'

describe('ApiClient Extended Tests', () => {
  it('sends PUT, PATCH, and DELETE requests with traceparent headers', async () => {
    const customFetch = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    const client = new ApiClient({ baseUrl: 'https://api.alfheim.local/', fetch: customFetch })

    await client.put('/items/1', { name: 'Item 1' })
    expect(customFetch).toHaveBeenCalledWith(
      'https://api.alfheim.local/items/1',
      expect.objectContaining({ method: 'PUT' })
    )

    await client.patch('items/1', { name: 'Updated' })
    expect(customFetch).toHaveBeenCalledWith(
      'https://api.alfheim.local/items/1',
      expect.objectContaining({ method: 'PATCH' })
    )

    await client.delete('/items/1')
    expect(customFetch).toHaveBeenCalledWith(
      'https://api.alfheim.local/items/1',
      expect.objectContaining({ method: 'DELETE' })
    )
  })

  it('preserves existing traceparent header if already set', () => {
    const headers = withTraceparentHeaders({ traceparent: '00-1234-5678-01' })
    expect(headers.get('traceparent')).toBe('00-1234-5678-01')
  })

  it('createTraceparentHook sets traceparent header on Request object', () => {
    const hook = createTraceparentHook()
    const req = new Request('https://example.com/api')
    hook(req)
    expect(req.headers.has('traceparent')).toBe(true)
  })

  it('fetchWithTrace and createApiClient factory helper', async () => {
    const customFetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    await fetchWithTrace('https://example.com/data', {}, customFetch)
    expect(customFetch).toHaveBeenCalled()

    const factoryClient = createApiClient({ baseUrl: 'https://api.test' })
    expect(factoryClient).toBeInstanceOf(ApiClient)
  })
})
