import { StreamHandlers } from './types';

export function sanitizeApiUrl(url?: string): string {
  const base = url || '/api/v1/chat';
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function getResolvedToken(explicitToken?: string): string | null {
  if (explicitToken) return explicitToken;
  if (typeof window === 'undefined') return null;
  return (
    sessionStorage.getItem('token_chat-frontend') ||
    sessionStorage.getItem('alfheim_access_token') ||
    null
  );
}

export async function readSSEStream(
  url: string,
  token: string | null,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
  let res: Response;
  try {
    res = await fetch(url, { headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    handlers.onError(err instanceof Error ? err.message : 'Network error');
    return;
  }

  if (!res.ok || !res.body) {
    let msg = `Stream error (${res.status})`;
    try {
      const errJson = await res.json();
      msg = errJson.message || msg;
    } catch {
      // fallback to status msg
    }
    handlers.onError(msg);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        parseFrame(frame, handlers);
      }
    }
  } catch (err) {
    if (!(err instanceof DOMException && err.name === 'AbortError')) {
      handlers.onError(err instanceof Error ? err.message : 'Stream failed');
    }
  }
}

function parseFrame(frame: string, handlers: StreamHandlers): void {
  const eventMatch = frame.match(/^event: (.+)$/m);
  const dataMatch = frame.match(/^data: (.+)$/m);
  const eventType = eventMatch?.[1] ?? 'message';
  const rawData = dataMatch?.[1] ?? '{}';

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawData);
  } catch {
    return;
  }

  switch (eventType) {
    case 'delta':
      handlers.onDelta(typeof data.text === 'string' ? data.text : '');
      break;
    case 'tool_call':
      handlers.onToolCall?.(data as any);
      break;
    case 'done':
      handlers.onDone(data.usage);
      break;
    case 'error':
      handlers.onError(typeof data.message === 'string' ? data.message : 'Stream error');
      break;
  }
}
