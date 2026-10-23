'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlfiStatus,
  AttachmentSummary,
  ChatWidgetContext,
  ConversationResponse,
  ModelBlock,
  WidgetMessage,
} from './types';
import { getResolvedToken, readSSEStream, sanitizeApiUrl } from './sseClient';
import { useTranslation } from '../../i18n/utils/useTranslation';
import { householdHeaders } from '../../household/householdStore';

/** Error whose message is already user-facing (translated); never shown raw. */
class ChatApiError extends Error {}

export interface UseChatStreamOptions {
  authToken?: string;
  apiBaseUrl?: string;
  context?: ChatWidgetContext;
  householdId?: string;
  isOpen: boolean;
}

export function useChatStream({
  authToken,
  apiBaseUrl,
  context,
  householdId,
  isOpen,
}: UseChatStreamOptions) {
  const { t } = useTranslation();
  const baseUrl = sanitizeApiUrl(apiBaseUrl);
  const [messages, setMessages] = useState<WidgetMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [status, setStatus] = useState<AlfiStatus>('idle');
  const [currentToolCall, setCurrentToolCall] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const token = getResolvedToken(authToken);
  const hasAuth = Boolean(token);

  const authHeaders = useCallback((): Record<string, string> => {
    const t = getResolvedToken(authToken);
    return {
      ...householdHeaders(householdId),
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    };
  }, [authToken, householdId]);

  useEffect(() => {
    if (!isOpen) {
      abortRef.current?.abort();
      setStatus('idle');
      setStreamingText('');
      setCurrentToolCall(null);
    }
  }, [isOpen]);

  const ensureConversation = async (): Promise<string> => {
    if (conversationId) return conversationId;
    let modelBlockId: string | undefined;
    try {
      const mbRes = await fetch(`${baseUrl}/model-blocks`, { headers: authHeaders() });
      if (mbRes.ok) {
        const blocks: ModelBlock[] = await mbRes.json();
        modelBlockId = blocks.find((b) => b.is_active)?.id || blocks[0]?.id;
      }
    } catch { /* ignore */ }

    const res = await fetch(`${baseUrl}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        model_block_id: modelBlockId,
        source_app: context?.sourceApp,
        source_context: context,
        title: context?.sourceApp ? `ALFI (${context.sourceApp})` : 'ALFI Chat',
      }),
    });
    if (!res.ok) throw new ChatApiError(t('Chat.createError'));
    const created: ConversationResponse = await res.json();
    setConversationId(created.id);
    return created.id;
  };

  const uploadFile = async (file: File): Promise<AttachmentSummary> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${baseUrl}/attachments`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    if (!res.ok) throw new ChatApiError(t('Chat.uploadError'));
    return res.json();
  };

  const sendMessage = async (content: string, attachments: AttachmentSummary[] = []) => {
    if (!hasAuth || status !== 'idle') return;
    if (!content.trim() && attachments.length === 0) return;

    setError(null);
    const userMsg: WidgetMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      attachments,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStatus('thinking');

    try {
      const cid = await ensureConversation();
      const attIds = attachments.map((a) => a.id);
      const postRes = await fetch(`${baseUrl}/conversations/${cid}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content: userMsg.content, attachment_ids: attIds }),
      });
      if (!postRes.ok) throw new ChatApiError(t('Chat.sendError'));

      const controller = new AbortController();
      abortRef.current = controller;
      let accumulated = '';

      await readSSEStream(
        `${baseUrl}/conversations/${cid}/stream`,
        token,
        {
          onDelta: (text) => {
            setStatus('streaming');
            setCurrentToolCall(null);
            accumulated += text;
            setStreamingText(accumulated);
          },
          onToolCall: (tc) => {
            setStatus('tool_calling');
            const toolName = tc?.ToolName || tc?.tool_name || tc?.name || 'tool';
            setCurrentToolCall(toolName);
          },
          onDone: () => {
            if (accumulated) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `asst-${Date.now()}`,
                  role: 'assistant',
                  content: accumulated,
                  created_at: new Date().toISOString(),
                },
              ]);
            }
            setStreamingText('');
            setCurrentToolCall(null);
            setStatus('idle');
          },
          onError: () => {
            setError(t('Chat.streamError'));
            setStreamingText('');
            setCurrentToolCall(null);
            setStatus('idle');
          },
        },
        controller.signal,
        householdHeaders(householdId)
      );
    } catch (err) {
      setError(err instanceof ChatApiError ? err.message : t('Chat.networkError'));
      setStatus('idle');
    }
  };

  const resetChat = () => {
    abortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setStreamingText('');
    setCurrentToolCall(null);
    setError(null);
    setStatus('idle');
  };

  return {
    messages,
    isStreaming: status === 'streaming' || status === 'thinking' || status === 'tool_calling',
    streamingText,
    currentToolCall,
    status,
    hasAuth,
    error,
    sendMessage,
    uploadFile,
    resetChat,
    conversationId,
  };
}
