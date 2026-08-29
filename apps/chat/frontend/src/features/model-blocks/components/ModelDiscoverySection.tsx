"use client";

import { useState } from "react";
import { useTranslation } from "@alfheim/shared";
import { Search, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useDiscoverModels } from "../services/modelBlockService";

export function formatModelDisplayName(tag: string): string {
  if (!tag) return "";
  const clean = tag.replace(/:latest$/, "");
  const parts = clean.split(/[:\-_]/);
  return parts
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

interface ModelDiscoverySectionProps {
  providerType: string;
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  apiKey?: string;
  modelIdentifier: string;
  onModelSelect: (identifier: string, autoDisplayName?: string) => void;
}

export function ModelDiscoverySection({
  providerType,
  baseUrl,
  onBaseUrlChange,
  apiKey,
  modelIdentifier,
  onModelSelect,
}: ModelDiscoverySectionProps) {
  const { t } = useTranslation();
  const discoverMutation = useDiscoverModels();
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isManualModel, setIsManualModel] = useState(false);
  const [discoverStatus, setDiscoverStatus] = useState<"idle" | "success" | "error">("idle");
  const [discoverMessage, setDiscoverMessage] = useState("");

  const handleDiscover = () => {
    setDiscoverStatus("idle");
    setDiscoverMessage("");
    discoverMutation.mutate(
      {
        provider_type: providerType,
        base_url: baseUrl || undefined,
        api_key: apiKey || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.models && data.models.length > 0) {
            setDiscoveredModels(data.models);
            setIsManualModel(false);
            setDiscoverStatus("success");
            setDiscoverMessage(t("Chat.scanSuccess", { count: data.models.length }));

            if (!modelIdentifier || !data.models.includes(modelIdentifier)) {
              const firstModel = data.models[0];
              onModelSelect(firstModel, formatModelDisplayName(firstModel));
            }
          } else {
            setDiscoveredModels([]);
            setDiscoverStatus("error");
            setDiscoverMessage(t("Chat.scanError"));
          }
        },
        onError: (err: unknown) => {
          setDiscoveredModels([]);
          setDiscoverStatus("error");
          const message = err instanceof Error ? err.message : t("Chat.scanError");
          setDiscoverMessage(message);
        },
      }
    );
  };

  return (
    <div className="space-y-3.5">
      <div>
        <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">
          {t("Chat.modelBaseUrl")}
        </label>
        {providerType === "ollama" ? (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => onBaseUrlChange(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none font-mono"
                placeholder="http://host.docker.internal:11434"
              />
              <button
                type="button"
                disabled={discoverMutation.isPending}
                onClick={handleDiscover}
                className="px-3 py-2 rounded-lg bg-[var(--surface-elevated)] hover:bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/60 text-xs font-semibold text-[var(--text-main)] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              >
                {discoverMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--primary-main)]" />
                ) : (
                  <Search className="w-3.5 h-3.5 text-[var(--primary-main)]" />
                )}
                <span>
                  {discoverMutation.isPending
                    ? t("Chat.scanningModels")
                    : t("Chat.scanModels")}
                </span>
              </button>
            </div>
            {discoverStatus === "success" && (
              <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{discoverMessage}</span>
              </p>
            )}
            {discoverStatus === "error" && (
              <p className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{discoverMessage}</span>
              </p>
            )}
          </div>
        ) : (
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none font-mono"
            placeholder={t("Chat.placeholderBaseUrl") || "http://ollama:11434 or https://api.openai.com/v1"}
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-[var(--text-muted)]">
            {t("Chat.modelIdentifier")}
          </label>
          {discoveredModels.length > 0 && isManualModel && (
            <button
              type="button"
              onClick={() => setIsManualModel(false)}
              className="text-[11px] text-[var(--primary-main)] hover:underline cursor-pointer"
            >
              {t("Chat.selectDiscoveredModel")}
            </button>
          )}
        </div>

        {discoveredModels.length > 0 && !isManualModel ? (
          <select
            value={modelIdentifier}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__custom__") {
                setIsManualModel(true);
                onModelSelect("");
              } else {
                onModelSelect(val, val ? formatModelDisplayName(val) : undefined);
              }
            }}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none"
          >
            <option value="">{t("Chat.selectDiscoveredModel")}</option>
            {discoveredModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="__custom__">{t("Chat.manualModelInput")}</option>
          </select>
        ) : (
          <input
            type="text"
            required
            value={modelIdentifier}
            onChange={(e) => onModelSelect(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-sm text-[var(--text-main)] focus:border-[var(--primary-main)] outline-none"
            placeholder={t("Chat.placeholderModelIdentifier") || "e.g. llama3.1:8b, gemma2:9b, gpt-4o"}
          />
        )}
      </div>
    </div>
  );
}
