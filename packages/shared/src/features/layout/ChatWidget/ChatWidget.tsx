'use client';

import React from 'react';
import { SidePanel } from '../SidePanel/SidePanel';
import { ChatWidgetHeader } from './ChatWidgetHeader';
import { ChatWidgetInput } from './ChatWidgetInput';
import { ChatWidgetMessages } from './ChatWidgetMessages';
import { ChatWidgetProps } from './types';
import { useChatStream } from './useChatStream';

export function ChatWidget({
  isOpen,
  onClose,
  authToken,
  apiBaseUrl,
  context,
  householdId,
}: ChatWidgetProps) {
  const {
    messages,
    isStreaming,
    streamingText,
    currentToolCall,
    status,
    hasAuth,
    error,
    sendMessage,
    uploadFile,
    resetChat,
  } = useChatStream({
    authToken,
    apiBaseUrl,
    context,
    householdId,
    isOpen,
  });

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      className="z-50 font-sans"
      bodyClassName="flex-1 flex flex-col min-h-0"
      header={
        <ChatWidgetHeader
          status={status}
          context={context}
          onReset={resetChat}
          onClose={onClose}
        />
      }
    >
      <div className="flex-1 flex flex-col min-h-0 bg-[var(--surface-card)]">
        <ChatWidgetMessages
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
          currentToolCall={currentToolCall}
          status={status}
          hasAuth={hasAuth}
          error={error}
          context={context}
        />

        <ChatWidgetInput
          onSend={sendMessage}
          onUploadFile={uploadFile}
          disabled={!hasAuth || isStreaming}
        />
      </div>
    </SidePanel>
  );
}
