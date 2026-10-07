import React, { useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { readApiError } from "@/core/apiError";
import { useProviders } from "../hooks/useProviders";
import { ProviderCard } from "./ProviderCard";
import { ProviderFormModal } from "./ProviderFormModal";
import { ProviderCreatePayload, ProviderSubscription } from "../types";

export function ProviderList() {
  const { t } = useTranslation();
  const {
    providers,
    isLoading,
    isError,
    toggleActive,
    deleteProvider,
    createProvider,
    isCreating,
  } = useProviders();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleCreateProvider = async (payload: ProviderCreatePayload) => {
    await createProvider(payload);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    setActionError(null);
    try {
      await toggleActive(id, currentStatus);
    } catch {
      setActionError(t("library.providers.updateError"));
    }
  };

  const handleDelete = async (provider: ProviderSubscription) => {
    setActionError(null);
    try {
      await deleteProvider(provider.id);
    } catch (err: unknown) {
      const apiError = await readApiError(err);
      setActionError(
        apiError.code === "provider_in_use"
          ? t("library.providers.deleteInUse", {
              name: provider.provider_name,
              count: apiError.itemCount ?? 0,
            })
          : t("library.providers.deleteError")
      );
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--text-muted)]">
        {t("library.providers.loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-red-400">
        {t("library.providers.loadError")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="break-words text-xl font-bold text-[var(--text-main)]">
            {t("library.providers.activeProviders")}
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {t("library.providers.subtitle")}
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="gap-2"
        >
          <span>+</span> {t("library.providers.addProvider")}
        </Button>
      </div>

      {actionError && (
        <div
          role="alert"
          className="break-words rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-400"
        >
          {actionError}
        </div>
      )}

      {providers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-12 text-center text-[var(--text-muted)] space-y-3">
          <p>{t("library.providers.noProviders")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
          >
            {t("library.providers.addProvider")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <ProviderFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateProvider}
        isSubmitting={isCreating}
      />
    </div>
  );
}
