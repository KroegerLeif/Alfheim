'use client';

import React, { useEffect, useRef } from 'react';
import { useTranslation } from '../../i18n';
import { AlfiAvatar } from './AlfiAvatar';
import { AlfiStatus, ChatWidgetContext, WidgetMessage } from './types';

export interface ChatWidgetMessagesProps {
  messages: WidgetMessage[];
  isStreaming: boolean;
  streamingText: string;
  currentToolCall: string | null;
  status: AlfiStatus;
  hasAuth: boolean;
  error: string | null;
  context?: ChatWidgetContext;
}

export function ChatWidgetMessages({
  messages,
  isStreaming,
  streamingText,
  currentToolCall,
  status,
  hasAuth,
  error,
  context,
}: ChatWidgetMessagesProps) {
  const { t } = useTranslation();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, streamingText, currentToolCall]);

  if (!hasAuth) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h3 className="text-sm font-bold text-[var(--text-main)]">{t('Chat.authRequired')}</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-xs">{t('Chat.authRequiredDesc')}</p>
      </div>
    );
  }

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <AlfiAvatar status="idle" size="lg" />
        <h3 className="text-sm font-bold text-[var(--text-main)]">{t('Chat.welcomeTitle')}</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-xs">
          {context?.sourceApp
            ? t('Chat.welcomeSubtitle', { app: context.sourceApp })
            : t('Chat.welcomeGeneric')}
        </p>
      </div>
    );
  }

  const getToolCallLabel = (toolName: string) => {
    const lower = toolName.toLowerCase();
    if (lower.includes('pantry')) return t('Chat.toolPantry');
    if (lower.includes('chores')) return t('Chat.toolChores');
    if (lower.includes('maintenance')) return t('Chat.toolMaintenance');
    if (lower.includes('shopping')) return t('Chat.toolShopping');
    return t('Chat.toolCalling', { tool: toolName });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        return (
          <div key={msg.id} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <AlfiAvatar status="idle" size="sm" className="mt-0.5" />}
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                isUser
                  ? 'bg-[var(--primary-main)] text-black font-medium'
                  : 'bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--text-main)]'
              }`}
            >
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {msg.attachments.map((att) => (
                    <a
                      key={att.id}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded overflow-hidden border border-black/10 hover:opacity-80"
                    >
                      <img src={att.url} alt="Attachment" className="max-h-28 object-contain rounded" />
                    </a>
                  ))}
                </div>
              )}
              {msg.content}
            </div>
          </div>
        );
      })}

      {isStreaming && (
        <div className="flex gap-2 justify-start">
          <AlfiAvatar status={status} size="sm" className="mt-0.5" />
          <div className="max-w-[85%] rounded-xl px-3.5 py-2 text-xs leading-relaxed bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[var(--text-main)] space-y-1.5">
            {currentToolCall && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-purple-400 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>{getToolCallLabel(currentToolCall)}</span>
              </div>
            )}
            {streamingText ? (
              <div className="whitespace-pre-wrap">{streamingText}</div>
            ) : !currentToolCall ? (
              <span className="text-[var(--text-muted)] animate-pulse">{t('Chat.thinking')}</span>
            ) : null}
          </div>
        </div>
      )}

      {error && (
        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {error}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
