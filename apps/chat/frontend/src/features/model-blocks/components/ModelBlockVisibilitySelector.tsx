"use client";

import { useTranslation } from "@alfheim/shared";

interface ModelBlockVisibilitySelectorProps {
  value: "private" | "shared";
  onChange: (value: "private" | "shared") => void;
  disabled?: boolean;
}

export function ModelBlockVisibilitySelector({
  value,
  onChange,
  disabled = false,
}: ModelBlockVisibilitySelectorProps) {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1.5">
        {t("Chat.modelVisibility")}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("private")}
          className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            value === "private"
              ? "border-[var(--primary-main)] bg-[var(--primary-main)]/10 text-[var(--primary-main)]"
              : "border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
          }`}
        >
          {t("Chat.visibilityPrivate")}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("shared")}
          className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            value === "shared"
              ? "border-blue-500 bg-blue-500/10 text-blue-400"
              : "border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
          }`}
        >
          {t("Chat.visibilityShared")}
        </button>
      </div>
    </div>
  );
}
