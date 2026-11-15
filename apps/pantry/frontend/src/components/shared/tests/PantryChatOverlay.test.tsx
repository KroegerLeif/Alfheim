import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PantryChatOverlay } from '../PantryChatOverlay';
import type { ChatWidgetProps } from '@alfheim/shared';

const chatWidgetMock = vi.fn((_props: ChatWidgetProps) => null);

vi.mock('@alfheim/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@alfheim/shared')>();
  return {
    ...actual,
    ChatWidget: (props: ChatWidgetProps) => chatWidgetMock(props),
  };
});

let chatEnabled = true;

vi.mock('@/core/chatContext', () => ({
  usePantryChat: () => ({
    chatEnabled,
    isChatOpen: true,
    closeChat: () => {},
    chatContext: { sourceApp: 'pantry' },
    householdId: 'hh-1',
  }),
}));

type RuntimeWindow = Window & { __ALFHEIM_ENV__?: { API_URL?: string } };

describe('PantryChatOverlay', () => {
  beforeEach(() => {
    chatWidgetMock.mockClear();
    chatEnabled = true;
  });

  afterEach(() => {
    delete (window as RuntimeWindow).__ALFHEIM_ENV__;
  });

  it('targets the same-origin chat API even when the runtime config points at another API', () => {
    (window as RuntimeWindow).__ALFHEIM_ENV__ = { API_URL: 'http://shopping.example/shopping/api/v1/' };

    render(<PantryChatOverlay />);

    const props = chatWidgetMock.mock.calls[0][0];
    expect(props.apiBaseUrl).toBe(`${window.location.origin}/api/v1/chat`);
    expect(props.householdId).toBe('hh-1');
  });

  it('renders no widget when the chat app is not installed', () => {
    chatEnabled = false;

    render(<PantryChatOverlay />);

    expect(chatWidgetMock).not.toHaveBeenCalled();
  });
});
