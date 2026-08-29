import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ChatWidget } from '../ChatWidget';
import { AlfiAvatar } from '../AlfiAvatar';
import { LanguageProvider } from '../../../i18n/utils/LanguageContext';

describe('ChatWidget and AlfiAvatar Components', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const renderWithLang = (ui: React.ReactNode, lang = 'de') => {
    return render(<LanguageProvider defaultLanguage={lang as any}>{ui}</LanguageProvider>);
  };

  it('does not render when isOpen is false', () => {
    renderWithLang(<ChatWidget isOpen={false} onClose={vi.fn()} />);
    expect(screen.queryByText('ALFI')).not.toBeInTheDocument();
  });

  it('shows auth notice when user has no token', () => {
    renderWithLang(<ChatWidget isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('Anmeldung erforderlich')).toBeInTheDocument();
    expect(screen.getByText('Bitte melde dich in der Anwendung an, um mit ALFI zu sprechen.')).toBeInTheDocument();
  });

  it('passes accessibility audit', async () => {
    const { container } = renderWithLang(
      <ChatWidget isOpen={true} onClose={vi.fn()} authToken="mock-token" />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('resolves auth token from sessionStorage fallback', () => {
    sessionStorage.setItem('alfheim_access_token', 'session-jwt-token');
    renderWithLang(<ChatWidget isOpen={true} onClose={vi.fn()} />);
    expect(screen.getByText('ALFI')).toBeInTheDocument();
    expect(screen.getByText('Hallo! Ich bin ALFI.')).toBeInTheDocument();
  });

  it('renders app context badge and welcome subtitle with context', () => {
    renderWithLang(
      <ChatWidget
        isOpen={true}
        onClose={vi.fn()}
        authToken="mock-jwt"
        context={{ sourceApp: 'pantry', entityType: 'item', entityId: '123' }}
      />
    );
    expect(screen.getByText('pantry')).toBeInTheDocument();
    expect(screen.getByText('Wie kann ich dir in pantry helfen?')).toBeInTheDocument();
  });

  it('renders AlfiAvatar with various status modes', () => {
    const { rerender } = render(<AlfiAvatar status="idle" size="md" />);
    expect(screen.getByRole('img', { name: /ALFI Mascot \(idle\)/i })).toBeInTheDocument();

    rerender(<AlfiAvatar status="thinking" size="lg" />);
    expect(screen.getByRole('img', { name: /ALFI Mascot \(thinking\)/i })).toBeInTheDocument();

    rerender(<AlfiAvatar status="streaming" size="sm" />);
    expect(screen.getByRole('img', { name: /ALFI Mascot \(streaming\)/i })).toBeInTheDocument();

    rerender(<AlfiAvatar status="tool_calling" size="md" />);
    expect(screen.getByRole('img', { name: /ALFI Mascot \(tool_calling\)/i })).toBeInTheDocument();
  });

  it('sends message with context and processes SSE stream', async () => {
    const user = userEvent.setup();
    let sentRequestBody: any = null;

    // Mock fetch for model-blocks, conversations, messages, and stream
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/model-blocks')) {
        return new Response(JSON.stringify([{ id: 'mb-1', display_name: 'Llama 3' }]), { status: 200 });
      }

      if (url.includes('/conversations') && init?.method === 'POST' && !url.includes('/messages')) {
        sentRequestBody = JSON.parse(init.body as string);
        return new Response(
          JSON.stringify({
            id: 'conv-123',
            owner_user_id: 'user-1',
            source_app: sentRequestBody.source_app,
            source_context: sentRequestBody.source_context,
          }),
          { status: 201 }
        );
      }

      if (url.includes('/messages') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'msg-1', content: 'hello' }), { status: 201 });
      }

      if (url.includes('/stream')) {
        const streamData = [
          'event: tool_call\ndata: {"tool_name": "pantry_list"}\n\n',
          'event: delta\ndata: {"text": "Hallo "}\n\n',
          'event: delta\ndata: {"text": "Pantry!"}\n\n',
          'event: done\ndata: {"usage": {}}\n\n',
        ].join('');

        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(streamData));
              controller.close();
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } }
        );
      }

      return new Response('{}', { status: 200 });
    }) as any;

    renderWithLang(
      <ChatWidget
        isOpen={true}
        onClose={vi.fn()}
        authToken="test-token"
        context={{ sourceApp: 'pantry', entityId: 'item-99' }}
      />
    );

    const input = screen.getByPlaceholderText('Nachricht eingeben...');
    await user.type(input, 'Wie viel Milch haben wir?');

    const sendButton = screen.getByRole('button', { name: 'Senden' });
    await user.click(sendButton);

    // Verify context was passed to POST /conversations
    await waitFor(() => {
      expect(sentRequestBody).not.toBeNull();
      expect(sentRequestBody.source_app).toBe('pantry');
      expect(sentRequestBody.source_context).toEqual({ sourceApp: 'pantry', entityId: 'item-99' });
    });

    // Verify streamed response rendered
    await waitFor(() => {
      expect(screen.getByText('Hallo Pantry!')).toBeInTheDocument();
    });
  });

  it('resets conversation on reset button click', async () => {
    const user = userEvent.setup();
    renderWithLang(
      <ChatWidget isOpen={true} onClose={vi.fn()} authToken="test-token" />
    );

    const resetBtn = screen.getByRole('button', { name: 'Neuer Chat' });
    await user.click(resetBtn);
    expect(screen.getByText('Hallo! Ich bin ALFI.')).toBeInTheDocument();
  });

  it('renders English and Polish translations correctly', () => {
    const { unmount } = renderWithLang(
      <ChatWidget isOpen={true} onClose={vi.fn()} authToken="test-token" />,
      'en'
    );
    expect(screen.getByText("Hello! I'm ALFI.")).toBeInTheDocument();
    unmount();

    renderWithLang(
      <ChatWidget isOpen={true} onClose={vi.fn()} authToken="test-token" />,
      'pl'
    );
    expect(screen.getByText('Cześć! Jestem ALFI.')).toBeInTheDocument();
  });
});
