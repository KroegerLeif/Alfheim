"use client";

import { usePantryChat } from "@/core/chatContext";
import { ChatWidget } from "@alfheim/shared";

export function PantryChatOverlay() {
  const { isChatOpen, closeChat, chatContext, householdId } = usePantryChat();

  const chatApiUrl =
    process.env.NEXT_PUBLIC_CHAT_API_URL || "http://api.alfheim.loegien.localhost/api/v1/chat";

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
