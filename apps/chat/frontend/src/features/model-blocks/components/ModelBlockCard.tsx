"use client";

import { useTranslation } from "@alfheim/shared";
import { Activity, Edit2, Trash2, Users, Lock, Cpu } from "lucide-react";
import type { ModelBlock } from "../types";
import { useTriggerHealthCheck } from "../services/modelBlockService";

interface ModelBlockCardProps {
  model: ModelBlock;
  onEdit: (model: ModelBlock) => void;
  onDelete: (model: ModelBlock) => void;
}

export function ModelBlockCard({ model, onEdit, onDelete }: ModelBlockCardProps) {
  const { t } = useTranslation();
  const triggerHealth = useTriggerHealthCheck();

  const getHealthBadge = () => {
    switch (model.health_status) {
      case "ok":
        return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/40">{t("Chat.healthOk")}</span>;
      case "unreachable":
        return <span className="text-[10px] font-bold text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-800/40">{t("Chat.healthUnreachable")}</span>;
      case "auth_invalid":
        return <span className="text-[10px] font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">{t("Chat.healthAuthInvalid")}</span>;
      default:
        return <span className="text-[10px] font-bold text-[var(--text-muted)] bg-[var(--surface-canvas)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">{t("Chat.healthUnknown")}</span>;
    }
  };

  const getVisibilityBadge = () => {
    if (model.is_bootstrap) {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/40">
          <Cpu className="w-3 h-3" />
          {t("Chat.systemBootstrap")}
        </span>
      );
    }
    if (model.visibility === "shared") {
      return (
        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-950/40 px-2 py-0.5 rounded border border-blue-800/40">
          <Users className="w-3 h-3" />
          {t("Chat.sharedInHousehold")}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)] bg-[var(--surface-canvas)] px-2 py-0.5 rounded border border-[var(--border-subtle)]">
        <Lock className="w-3 h-3" />
        {t("Chat.privateModel")}
      </span>
    );
  };

  return (
    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-accent)] transition-all flex flex-col justify-between gap-3 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="text-base font-bold text-[var(--text-main)] truncate">
            {model.display_name}
          </h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            {getVisibilityBadge()}
            {getHealthBadge()}
          </div>
        </div>

        <div className="text-xs font-mono text-[var(--text-muted)] space-y-0.5">
          <p><span className="text-[var(--text-main)] font-semibold">{t("Chat.modelProvider")}:</span> {model.provider_type}</p>
          <p><span className="text-[var(--text-main)] font-semibold">{t("Chat.modelIdentifier")}:</span> {model.model_identifier}</p>
          {model.base_url && (
            <p className="truncate"><span className="text-[var(--text-main)] font-semibold">{t("Chat.modelBaseUrl")}:</span> {model.base_url}</p>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => triggerHealth.mutate(model.id)}
          disabled={triggerHealth.isPending}
          className="px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--surface-canvas)] hover:border-[var(--primary-main)] text-[var(--text-main)] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
          title={t("Chat.checkHealth")}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t("Chat.checkHealth")}</span>
        </button>

        {model.is_owner && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onEdit(model)}
              aria-label={t("Chat.editModelBlock")}
              title={t("Chat.editModelBlock")}
              className="p-1.5 rounded-md border border-[var(--border-subtle)] hover:border-[var(--primary-main)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(model)}
              aria-label={t("Chat.deleteModelBlock")}
              title={t("Chat.deleteModelBlock")}
              className="p-1.5 rounded-md border border-[var(--border-subtle)] hover:border-red-500 text-[var(--text-muted)] hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
