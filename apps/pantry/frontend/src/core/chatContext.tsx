"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ChatWidgetContext } from "@alfheim/shared";

export interface PantryChatContextType {
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
  isChatOpen: false,
  chatContext: DEFAULT_PANTRY_CONTEXT,
  openChat: () => {},
  closeChat: () => {},
  toggleChat: () => {},
});

export function PantryChatProvider({ children }: { children: React.ReactNode }) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatContext, setChatContext] = useState<ChatWidgetContext>(DEFAULT_PANTRY_CONTEXT);
  const [householdId, setHouseholdId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readHouseholdId = () => {
      const active = localStorage.getItem("alfheim_active_household_id");
      setHouseholdId(active || undefined);
    };

    readHouseholdId();
    window.addEventListener("storage-household-changed", readHouseholdId);
    return () => {
      window.removeEventListener("storage-household-changed", readHouseholdId);
    };
  }, []);

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
