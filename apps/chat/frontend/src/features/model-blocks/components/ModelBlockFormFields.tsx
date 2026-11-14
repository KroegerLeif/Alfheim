"use client";

import { useTranslation } from "@alfheim/shared";
import { ModelBlockVisibilitySelector } from "./ModelBlockVisibilitySelector";
import { ModelDiscoverySection } from "./ModelDiscoverySection";
import type { ModelBlockFormState } from "../hooks/useModelBlockForm";

/** Provider types the chat backend can talk to (see llm.NewProvider). */
const PROVIDER_OPTIONS = [
  { value: "ollama", labelKey: "Chat.providerOllama" },
  { value: "openai_compatible", labelKey: "Chat.providerOpenAICompatible" },
] as const;

/** Props of {@link ModelBlockFormFields}. */
interface ModelBlockFormFieldsProps {
  form: ModelBlockFormState;
  isPending: boolean;
}

/** Provider, endpoint discovery, display name, API key and visibility fields of a model block. */
export function ModelBlockFormFields({ form, isPending }: ModelBlockFormFieldsProps) {
  const { t } = useTranslation();
  const { isEditing } = form;

  return (
    <>
      {!isEditing && (
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
            {t("Chat.modelProvider")}
          </label>
          <select
            value={form.providerType}
            onChange={(e) => {
              form.setProviderType(e.target.value);
            }}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>
      )}

      <ModelDiscoverySection
        providerType={form.providerType}
        baseUrl={form.baseUrl}
        onBaseUrlChange={form.setBaseUrl}
        apiKey={form.apiKey}
        modelIdentifier={form.modelIdentifier}
        onModelSelect={form.handleModelSelect}
      />

      <div>
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
          {t("Chat.modelDisplayName")}
        </label>
        <input
          type="text"
          required
          value={form.displayName}
          onChange={(e) => form.setDisplayName(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none"
          placeholder={t("Chat.placeholderDisplayName")}
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
          {t("Chat.modelApiKey")}
        </label>
        <input
          type="password"
          value={form.apiKey}
          onChange={(e) => form.setApiKey(e.target.value)}
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none font-mono"
          placeholder={isEditing ? t("Chat.placeholderApiKeyKeep") : t("Chat.placeholderApiKeyOptional")}
        />
        {form.dropsStoredKey && (
          <p role="status" className="mt-1 text-xs text-amber-400">{t("Chat.baseUrlChangeDropsKey")}</p>
        )}
      </div>

      <ModelBlockVisibilitySelector
        value={form.visibility}
        onChange={form.setVisibility}
        disabled={isPending}
      />
    </>
  );
}
