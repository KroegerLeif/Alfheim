import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { createTestQueryClient } from '../../../tests/test-utils';
import { useCanManagePlugins, usePlugins } from '../hooks/usePlugins';
import { knownHealthStatus } from '../errors';
import { servePlugins, testPluginView } from './fixtures';

function wrapper(role: string | null, householdId: string | null = 'hh-a') {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <StaticHouseholdProvider householdId={householdId} value={{ role }}>
          {children}
        </StaticHouseholdProvider>
      </QueryClientProvider>
    );
  };
}

describe('usePlugins', () => {
  it('loads the household plugins and coalesces a null list', async () => {
    servePlugins(null, false);
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper('MEMBER') });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ items: [], encryption_available: false });
  });

  it('returns the listed plugins', async () => {
    servePlugins([testPluginView]);
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper('MEMBER') });
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
  });

  it('waits for a household', () => {
    const { result } = renderHook(() => usePlugins(), { wrapper: wrapper(null, null) });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCanManagePlugins', () => {
  it.each([
    ['OWNER', true],
    ['admin', true],
    ['MEMBER', false],
    ['GUEST', false],
    [null, false],
  ])('role %s may manage: %s', (role, expected) => {
    const { result } = renderHook(() => useCanManagePlugins(), { wrapper: wrapper(role) });
    expect(result.current).toBe(expected);
  });
});

describe('knownHealthStatus', () => {
  it('keeps known statuses and maps others to error', () => {
    expect(knownHealthStatus('host_not_allowed')).toBe('host_not_allowed');
    expect(knownHealthStatus('something_new')).toBe('error');
  });
});
