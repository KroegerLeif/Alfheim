import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, DEFAULT_API_TIMEOUT_MS, resolveApiBaseUrl } from '../client';
import { ApiError, ApiTimeoutError, defaultApiErrorMapper, isApiError, isApiTimeoutError, readResponseBody } from '../errors';
import type { ApiSession } from '../types';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function hangingFetch(): typeof fetch {
  return vi.fn((_url: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    }),
  ) as unknown as typeof fetch;
}

function session(overrides: Partial<ApiSession> = {}): ApiSession {
  return { getToken: () => 'tok', prepareHeaders: (h) => h.set('X-Household-ID', 'hh-1'), ...overrides };
}

describe('createApiClient timeout', () => {
  it('applies the default timeout through an abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    await createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock }).get('/x');
    expect(DEFAULT_API_TIMEOUT_MS).toBe(8000);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('maps an elapsed timeout to ApiTimeoutError', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: hangingFetch(), timeoutMs: 10 });
    const error = await client.get('/slow').catch((e: unknown) => e);
    expect(isApiTimeoutError(error)).toBe(true);
    expect(error).toBeInstanceOf(ApiTimeoutError);
    expect((error as ApiTimeoutError).timeoutMs).toBe(10);
  });

  it('keeps the caller signal next to the timeout and rethrows its abort', async () => {
    const controller = new AbortController();
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: hangingFetch() });
    const pending = client.get('/x', { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('sends streaming requests without a timeout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('data'));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });
    await client.get('/stream', { stream: true });
    await client.get('/plain', { timeoutMs: false });
    expect(fetchMock.mock.calls[0][1].signal).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].signal).toBeUndefined();
  });

  it('rethrows network errors unchanged', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock });
    await expect(client.get('/x')).rejects.toThrow('Failed to fetch');
  });
});

describe('createApiClient error mapping', () => {
  it('returns failed responses as they are by default', async () => {
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: vi.fn().mockResolvedValue(json(500, {})) });
    expect((await client.get('/x')).status).toBe(500);
  });

  it('throws an ApiError with the structured code and message', async () => {
    const body = { detail: { code: 'household_required', message: 'header missing' } };
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: vi.fn().mockResolvedValue(json(400, body)), throwHttpErrors: true });
    const error = await client.get('/x').json().catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 400, code: 'household_required', message: 'header missing', data: body });
  });

  it('uses the error field and falls back to the status line', () => {
    const fromError = defaultApiErrorMapper(new Response(null, { status: 409 }), { error: 'conflict' }) as ApiError;
    expect(fromError).toMatchObject({ code: 'conflict', message: 'conflict' });
    const bare = defaultApiErrorMapper(new Response(null, { status: 502 }), 'Bad gateway') as ApiError;
    expect(bare).toMatchObject({ code: null, message: 'Request failed with status 502' });
  });

  it('accepts a custom mapper per client and a per-request override', async () => {
    const mapError = vi.fn(() => new Error('mapped'));
    const fetchMock = vi.fn().mockImplementation(async () => json(404, {}));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock, throwHttpErrors: true, mapError });
    await expect(client.delete('/x')).rejects.toThrow('mapped');
    expect((await client.get('/x', { throwHttpErrors: false })).status).toBe(404);
  });

  it('reads JSON, text and empty bodies', async () => {
    expect(await readResponseBody(json(400, { a: 1 }))).toEqual({ a: 1 });
    expect(await readResponseBody(new Response('plain'))).toBe('plain');
    expect(await readResponseBody(new Response(null, { status: 500 }))).toBeUndefined();
  });
});

describe('createApiClient session', () => {
  it('attaches the token and session headers and throws by default', async () => {
    const onErrorResponse = vi.fn().mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValueOnce(json(200, { ok: true })).mockResolvedValueOnce(json(400, {}));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock, session: session({ onErrorResponse }) });
    expect(await client.get('/x').json<{ ok: boolean }>()).toEqual({ ok: true });
    const headers = new Headers(fetchMock.mock.calls[0][1].headers);
    expect(headers.get('Authorization')).toBe('Bearer tok');
    expect(headers.get('X-Household-ID')).toBe('hh-1');
    await expect(client.get('/y')).rejects.toBeInstanceOf(ApiError);
    expect(onErrorResponse).toHaveBeenCalledTimes(1);
  });

  it('retries once with a refreshed token after a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(401, {})).mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock, session: session({ refreshToken: async () => 'fresh' }) });
    expect(await client.post('/x', { a: 1 }).json()).toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer fresh');
  });

  it('starts a new login when the refresh fails or throws', async () => {
    const onAuthFailure = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockImplementation(async () => json(401, {}));
    const none = createApiClient({ baseUrl: 'https://api.test', fetch: fetchMock, session: session({ refreshToken: async () => null, onAuthFailure }) });
    await expect(none.get('/x')).rejects.toMatchObject({ status: 401 });
    const failing = createApiClient({
      baseUrl: 'https://api.test', fetch: fetchMock,
      session: session({ refreshToken: async () => { throw new Error('idp down'); }, onAuthFailure }),
    });
    await expect(failing.get('/x')).rejects.toMatchObject({ status: 401 });
    expect(onAuthFailure).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('createApiClient bodies and URLs', () => {
  it('sends FormData without a JSON content type and objects as JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, {}));
    const client = createApiClient({ baseUrl: 'https://api.test/', fetch: fetchMock });
    await client.post('/upload', new FormData());
    await client.put('/item', { a: 1 });
    expect(new Headers(fetchMock.mock.calls[0][1].headers).has('Content-Type')).toBe(false);
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.test/item');
    expect(fetchMock.mock.calls[1][1].body).toBe('{"a":1}');
    expect(await client.get('/t').text()).toBe('{}');
  });

  describe('basePath', () => {
    beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, []))));
    afterEach(() => vi.unstubAllGlobals());

    it('resolves the base path against the current origin and uses the global fetch lazily', async () => {
      await createApiClient({ basePath: '/api/v1/chat/' }).get('conversations');
      expect(vi.mocked(fetch).mock.calls[0][0]).toBe(`${window.location.origin}/api/v1/chat/conversations`);
      expect(resolveApiBaseUrl('/api/v1', 'https://alfheim.example/api/v1/')).toBe('https://alfheim.example/api/v1');
    });
  });
});
