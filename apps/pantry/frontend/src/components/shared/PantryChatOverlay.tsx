"use client";

import { usePantryChat } from "@/core/chatContext";
import { ChatWidget, resolveApiUrl } from "@alfheim/shared";

// The chat backend is served on the same origin under /api/v1/chat (Caddy). The
// runtime config (window.__ALFHEIM_ENV__.API_URL) carries only the shopping API,
// so resolveApiUrl must not be used here: it would send chat requests to pantry.
function resolveChatApiUrl(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/v1/chat`;
  }
  return resolveApiUrl("/api/v1/chat", process.env.NEXT_PUBLIC_CHAT_API_URL);
}

export function PantryChatOverlay() {
  const { isChatOpen, closeChat, chatContext, householdId } = usePantryChat();

  const chatApiUrl = resolveChatApiUrl();

  return (
    <ChatWidget
      isOpen={isChatOpen}
      onClose={closeChat}
      context={chatContext}
      householdId={householdId}
      apiBaseUrl={chatApiUrl}
    />
  );
}
