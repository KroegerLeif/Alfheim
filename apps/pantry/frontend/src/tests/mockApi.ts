import { vi } from 'vitest'

/** A recorded request, with the JSON body already parsed. */
export interface RecordedCall {
  method: string
  path: string
  search: URLSearchParams
  body: unknown
  headers: Headers
}

type Handler = (call: RecordedCall) => Response | unknown | Promise<Response | unknown>

/** JSON response with the given status. */
export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Replaces `fetch` with an in-memory API. Routes are keyed `"METHOD /full/path"` (for example
 * `"GET /pantry/api/v1/products"`); a handler returns a `Response` (see `json`) or a plain value that is
 * sent as a 200 JSON body. Unmatched requests fail the test loudly instead of hitting the network.
 * The real ky client, hooks and error handling run on top of it.
 */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: RecordedCall[] = []
  const fetchMock = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init)
    const url = new URL(request.url)
    const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text()
    const call: RecordedCall = {
      method: request.method,
      path: url.pathname,
      search: url.searchParams,
      body: text ? JSON.parse(text) : undefined,
      headers: request.headers,
    }
    calls.push(call)

    const key = `${call.method} ${call.path}`
    if (!(key in routes)) throw new Error(`Unexpected request: ${key}${url.search}`)
    const route = routes[key]
    const result = typeof route === 'function' ? await (route as Handler)(call) : route
    return result instanceof Response ? result : json(200, result)
  })
  vi.stubGlobal('fetch', fetchMock)
  return {
    calls,
    /** Calls made to `"METHOD /path"`, oldest first. */
    to: (key: string) => calls.filter((c) => `${c.method} ${c.path}` === key),
  }
}
