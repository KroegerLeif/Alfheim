import { describe, expect, it, vi } from 'vitest';
import {
  ApiClient,
  createApiClient,
  createTraceparentHook,
  fetchWithTrace,
  generateW3CTraceparent,
  withTraceparentHeaders,
} from '../src';

describe('W3C Traceparent Header Generation', () => {
  const TRACEPARENT_REGEX = /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/;

  it('generates a valid W3C traceparent string', () => {
    const traceparent = generateW3CTraceparent();
    expect(traceparent).toMatch(TRACEPARENT_REGEX);
  });

  it('generates unique traceparent strings across calls', () => {
    const t1 = generateW3CTraceparent();
    const t2 = generateW3CTraceparent();
    expect(t1).not.toEqual(t2);

    const traceId1 = t1.split('-')[1];
    const traceId2 = t2.split('-')[1];
    expect(traceId1).not.toEqual(traceId2);
  });

  it('ensures non-zero trace_id and span_id', () => {
    for (let i = 0; i < 50; i++) {
      const traceparent = generateW3CTraceparent();
      const [, traceId, spanId] = traceparent.split('-');
      expect(traceId).not.toEqual('00000000000000000000000000000000');
      expect(spanId).not.toEqual('0000000000000000');
    }
  });
});

describe('Traceparent Header Helpers & Interceptors', () => {
  const TRACEPARENT_REGEX = /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/;

  it('withTraceparentHeaders attaches traceparent when missing', () => {
    const headers = withTraceparentHeaders({ 'Content-Type': 'application/json' });
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('traceparent')).toMatch(TRACEPARENT_REGEX);
  });

  it('withTraceparentHeaders retains existing traceparent header', () => {
    const customTraceparent = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const headers = withTraceparentHeaders({ traceparent: customTraceparent });
    expect(headers.get('traceparent')).toBe(customTraceparent);
  });

  it('createTraceparentHook adds traceparent header to Request', () => {
    const hook = createTraceparentHook();
    const request = new Request('https://api.example.com/data', {
      headers: { Accept: 'application/json' },
    });
    hook(request);
    expect(request.headers.get('traceparent')).toMatch(TRACEPARENT_REGEX);
  });

  it('createTraceparentHook preserves existing traceparent on Request', () => {
    const hook = createTraceparentHook();
    const customTraceparent = '00-11111111111111111111111111111111-2222222222222222-01';
    const request = new Request('https://api.example.com/data', {
      headers: { Traceparent: customTraceparent },
    });
    hook(request);
    expect(request.headers.get('traceparent')).toBe(customTraceparent);
  });
});

describe('fetchWithTrace Wrapper', () => {
  const TRACEPARENT_REGEX = /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/;

  it('automatically injects traceparent header into outgoing fetch requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await fetchWithTrace('https://api.example.com/items', {}, mockFetch);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('traceparent')).toMatch(TRACEPARENT_REGEX);
  });

  it('does not overwrite user-supplied traceparent header', async () => {
    const customTraceparent = '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01';
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    await fetchWithTrace(
      'https://api.example.com/items',
      { headers: { traceparent: customTraceparent } },
      mockFetch
    );

    const [, init] = mockFetch.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('traceparent')).toBe(customTraceparent);
  });
});

describe('Centralized ApiClient Class', () => {
  const TRACEPARENT_REGEX = /^00-[a-f0-9]{32}-[a-f0-9]{16}-01$/;

  it('injects traceparent header into GET requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: 'test' })));
    const client = createApiClient({ baseUrl: 'https://api.alfheim.local', fetch: mockFetch });

    await client.get('/users');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.alfheim.local/users');
    const headers = new Headers(options.headers);
    expect(headers.get('traceparent')).toMatch(TRACEPARENT_REGEX);
  });

  it('injects traceparent header into POST, PUT, PATCH, DELETE requests', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    const client = new ApiClient({ baseUrl: 'https://api.alfheim.local', fetch: mockFetch });

    await client.post('/items', { name: 'item1' });
    await client.put('/items/1', { name: 'item2' });
    await client.patch('/items/1', { name: 'updated' });
    await client.delete('/items/1');

    expect(mockFetch).toHaveBeenCalledTimes(4);

    for (const call of mockFetch.mock.calls) {
      const [, options] = call;
      const headers = new Headers(options.headers);
      expect(headers.get('traceparent')).toMatch(TRACEPARENT_REGEX);
    }
  });

  it('preserves existing traceparent header passed to request init', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    const client = createApiClient({ baseUrl: 'https://api.alfheim.local', fetch: mockFetch });
    const existingTraceparent = '00-99999999999999999999999999999999-8888888888888888-01';

    await client.get('/status', {
      headers: { Traceparent: existingTraceparent },
    });

    const [, options] = mockFetch.mock.calls[0];
    const headers = new Headers(options.headers);
    expect(headers.get('traceparent')).toBe(existingTraceparent);
  });
});
