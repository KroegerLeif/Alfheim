import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENABLED_APPS_PATH, fetchEnabledApps, resetEnabledAppsCache, useAppEnabled } from '../useAppEnabled';

function respond(body: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe('useAppEnabled', () => {
  beforeEach(() => {
    resetEnabledAppsCache();
    sessionStorage.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is undefined while loading, then false for an app the installation does not run', async () => {
    respond({ apps: ['household', 'pantry'] });
    const { result } = renderHook(() => useAppEnabled('chat'));

    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('is true for an enabled app, matching case-insensitively', async () => {
    respond({ apps: ['household', 'Chat'] });
    const { result } = renderHook(() => useAppEnabled('CHAT'));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('sends the stored access token', async () => {
    sessionStorage.setItem('alfheim_access_token', 'tok-1');
    const fetchSpy = respond({ apps: [] });

    await fetchEnabledApps();

    expect(fetchSpy).toHaveBeenCalledWith(ENABLED_APPS_PATH, { headers: { Authorization: 'Bearer tok-1' } });
  });

  it('asks the dashboard only once per page load', async () => {
    const fetchSpy = respond({ apps: ['chat'] });

    await fetchEnabledApps();
    await fetchEnabledApps();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('keeps entry points (true) when the dashboard answers with an error, and retries later', async () => {
    const fetchSpy = respond({ error: 'unauthorized' }, 401);
    const { result } = renderHook(() => useAppEnabled('chat'));

    await waitFor(() => expect(result.current).toBe(true));
    await fetchEnabledApps();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('keeps entry points (true) when the dashboard is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));
    const { result } = renderHook(() => useAppEnabled('chat'));

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('treats a body without an app list as no optional apps', async () => {
    respond({});
    const { result } = renderHook(() => useAppEnabled('chat'));

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('does not update state after unmount', async () => {
    let resolve: (value: Response) => void = () => {};
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useAppEnabled('chat'));

    unmount();
    resolve(new Response(JSON.stringify({ apps: ['chat'] }), { status: 200 }));
    await fetchEnabledApps();

    expect(result.current).toBeUndefined();
  });
});
