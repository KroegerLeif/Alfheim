"use client";

import { usePantryChat } from "@/core/chatContext";
import { AlfiAvatar, ClientHeader as SharedClientHeader, useTranslation } from "@alfheim/shared";

export function ClientHeader() {
  const { toggleChat } = usePantryChat();
  const { t } = useTranslation();

  return (
    <SharedClientHeader
      appName="pantry"
      brandTitle="ALFHEIM // PANTRY"
      actionsSlot={
        <button
          type="button"
          onClick={toggleChat}
          aria-label={t("pantry.askAlfi")}
          title={t("pantry.askAlfi")}
          className="p-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--primary-main)] hover:bg-[var(--surface-canvas)] transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold text-[var(--text-main)]"
        >
          <AlfiAvatar status="idle" size="sm" />
          <span className="hidden sm:inline">ALFI</span>
        </button>
      }
    />
  );
}
