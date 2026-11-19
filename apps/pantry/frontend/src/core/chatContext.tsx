"use client";

import React, { createContext, useContext, useState } from "react";
import { ChatWidgetContext, useAppEnabled, useOptionalActiveHousehold } from "@alfheim/shared";

export interface PantryChatContextType {
  /**
   * False only when the dashboard reports that the optional chat app is not installed; the
   * ALFI entry points and the widget are then left out (#917). A stopped but installed chat
   * app stays enabled and the widget reports the outage itself.
   */
  chatEnabled: boolean;
  isChatOpen: boolean;
  chatContext: ChatWidgetContext;
  householdId?: string;
  openChat: (customContext?: Partial<ChatWidgetContext>) => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const DEFAULT_PANTRY_CONTEXT: ChatWidgetContext = {
  sourceApp: "pantry",
  entityType: "inventory_overview",
};

export const PantryChatContext = createContext<PantryChatContextType>({
  chatEnabled: true,
  isChatOpen: false,
  chatContext: DEFAULT_PANTRY_CONTEXT,
  openChat: () => {},
  closeChat: () => {},
  toggleChat: () => {},
});

export function PantryChatProvider({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<ChatWidgetContext>(DEFAULT_PANTRY_CONTEXT);
  const householdId = useOptionalActiveHousehold()?.householdId ?? undefined;
  // Unknown (still loading) counts as enabled so a slow dashboard never hides a working chat.
  const chatEnabled = useAppEnabled("chat") !== false;

  const openChat = (customContext?: Partial<ChatWidgetContext>) => {
    setChatContext({
      sourceApp: "pantry",
      entityType: customContext?.entityType ?? "inventory_overview",
      entityId: customContext?.entityId,
      entityData: customContext?.entityData,
    });
    setIsChatOpen(true);
  };

  const closeChat = () => {
    setIsChatOpen(false);
  };

  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  return (
    <PantryChatContext.Provider
      value={{
        chatEnabled,
        isChatOpen,
        chatContext,
        householdId,
        openChat,
        closeChat,
        toggleChat,
      }}
    >
      {children}
    </PantryChatContext.Provider>
  );
}

export const usePantryChat = () => useContext(PantryChatContext);
