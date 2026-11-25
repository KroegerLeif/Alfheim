import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { StaticHouseholdProvider } from '@alfheim/shared';
import { server } from '../../../../tests/mocks/server';
import { createTestQueryClient } from '../../../../tests/test-utils';
import type { AppItem } from '@/shared/types';
import { withoutUnreadyAlfi } from '../alfiGate';
import { useAlfiReady } from '../useAlfi';

const tiles = [{ id: 'pantry' }, { id: 'chat' }] as AppItem[];

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      <StaticHouseholdProvider householdId="hh-a" value={{ role: 'MEMBER' }}>
        {children}
      </StaticHouseholdProvider>
    </QueryClientProvider>
  );
}

function serve(chat: boolean, statuses: string[]) {
  server.use(
    http.get('*api/v1/user/capabilities', () => HttpResponse.json({ operator: false, chat })),
    http.get('*api/v1/chat/model-blocks', () =>
      HttpResponse.json(statuses.map((s, i) => ({ id: `mb-${i}`, health_status: s }))),
    ),
  );
}

describe('ALFI entry point gate', () => {
  it('drops only the chat tile while ALFI is not ready', () => {
    expect(withoutUnreadyAlfi(tiles, false)?.map((a) => a.id)).toEqual(['pantry']);
    expect(withoutUnreadyAlfi(tiles, true)).toBe(tiles);
    expect(withoutUnreadyAlfi(undefined, false)).toBeUndefined();
  });

  it('is ready once one usable model block is healthy', async () => {
    serve(true, ['unreachable', 'ok']);
    const { result } = renderHook(() => useAlfiReady(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('stays not ready with only unhealthy blocks, none, or without chat', async () => {
    for (const [chat, statuses] of [[true, ['unknown', 'auth_invalid']], [true, []], [false, ['ok']]] as const) {
      serve(chat, [...statuses]);
      const { result, unmount } = renderHook(() => useAlfiReady(), { wrapper });
      // Let the capability and model block queries settle before asserting.
      await act(async () => {
        await new Promise((r) => setTimeout(r, 30));
      });
      expect(result.current).toBe(false);
      unmount();
    }
  });
});
