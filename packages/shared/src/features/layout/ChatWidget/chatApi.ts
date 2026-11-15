import { ConversationResponse, ModelBlock } from './types';

/** Statuses meaning the chat app is stopped, restarting or not installed (gateway answers). */
const UNAVAILABLE_STATUSES = new Set([404, 502, 503, 504]);

/** The chat app cannot be reached: stopped, restarting or not installed. */
export class ChatUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('chat service unavailable', { cause });
    this.name = 'ChatUnavailableError';
  }
}

/** True when `error` comes from an `AbortController` the user triggered (closing, reset). */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** `fetch` that turns a network failure or a gateway status into {@link ChatUnavailableError}. */
export async function chatFetch(url: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new ChatUnavailableError(error);
  }
  if (UNAVAILABLE_STATUSES.has(res.status)) throw new ChatUnavailableError(`HTTP ${res.status}`);
  return res;
}

/**
 * The model block a new conversation uses: the active one, else the first. Resolves to
 * undefined when none is configured or the list cannot be read (the backend then picks its
 * default); an unreachable chat app rejects with {@link ChatUnavailableError}.
 */
export async function fetchDefaultModelBlockId(
  baseUrl: string,
  headers: Record<string, string>,
): Promise<string | undefined> {
  const res = await chatFetch(`${baseUrl}/model-blocks`, { headers });
  if (!res.ok) {
    console.warn(`Chat model blocks could not be loaded (HTTP ${res.status}); using the backend default.`);
    return undefined;
  }
  const blocks: ModelBlock[] = await res.json();
  return blocks.find((b) => b.is_active)?.id || blocks[0]?.id;
}

/** Creates a conversation; resolves to null when the backend rejected the request. */
export async function createConversation(
  baseUrl: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
): Promise<ConversationResponse | null> {
  const res = await chatFetch(`${baseUrl}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return res.ok ? ((await res.json()) as ConversationResponse) : null;
}
