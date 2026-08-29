"use client";

import { useState } from "react";
import { useTranslation } from "@alfheim/shared";
import { Plus, Cpu, Loader2 } from "lucide-react";
import type { CreateModelBlockRequest, ModelBlock, UpdateModelBlockRequest } from "../types";
import {
  useCreateModelBlock,
  useDeleteModelBlock,
  useModelBlocks,
  useUpdateModelBlock,
} from "../services/modelBlockService";
import { ModelBlockCard } from "./ModelBlockCard";
import { ModelBlockFormModal } from "./ModelBlockFormModal";

interface ModelBlockManagementViewProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ModelBlockManagementView({ isOpen, onClose }: ModelBlockManagementViewProps) {
  const { t } = useTranslation();
  const { data: modelBlocks, isLoading } = useModelBlocks();
  const createMutation = useCreateModelBlock();
  const updateMutation = useUpdateModelBlock();
  const deleteMutation = useDeleteModelBlock();

  const [formOpen, setFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelBlock | null>(null);

  if (!isOpen) return null;

  const handleEdit = (model: ModelBlock) => {
    setEditingModel(model);
    setFormOpen(true);
  };

  const handleDelete = (model: ModelBlock) => {
    if (!window.confirm(t("Chat.deleteModelConfirm"))) return;
    deleteMutation.mutate(model.id);
  };

  const handleFormSubmit = (
    payload: CreateModelBlockRequest | { id: string; payload: UpdateModelBlockRequest }
  ) => {
    if ("id" in payload) {
      updateMutation.mutate(payload, {
        onSuccess: () => {
          setFormOpen(false);
          setEditingModel(null);
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          setFormOpen(false);
          setEditingModel(null);
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[85vh] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-[var(--border-subtle)] bg-[var(--surface-card)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--border-accent)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-main)]">
                {t("Chat.modelBlocks")}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {t("Chat.manageModels")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingModel(null);
                setFormOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-[var(--primary-main)] text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t("Chat.addModelBlock")}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
            >
              {t("Chat.close")}
            </button>
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-[var(--text-muted)] text-sm">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--primary-main)]" />
              <span>…</span>
            </div>
          ) : modelBlocks && modelBlocks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modelBlocks.map((model) => (
                <ModelBlockCard
                  key={model.id}
                  model={model}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 space-y-2 border border-dashed border-[var(--border-subtle)] rounded-xl">
              <p className="text-sm font-semibold text-[var(--text-muted)]">
                {t("Chat.noModelBlocks")}
              </p>
            </div>
          )}
        </div>
      </div>

      <ModelBlockFormModal
        model={editingModel}
        isOpen={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingModel(null);
        }}
        onSubmit={handleFormSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
