import React, { useState } from "react";
import { Button, useTranslation } from "@alfheim/shared";
import { useProviders } from "../hooks/useProviders";
import { ProviderCard } from "./ProviderCard";
import { ProviderFormModal } from "./ProviderFormModal";
import { ProviderCreatePayload } from "../types";

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

  const handleCreateProvider = async (payload: ProviderCreatePayload) => {
    await createProvider(payload);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[var(--text-muted,#94a3b8)]">
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
          <h2 className="text-xl font-bold text-[var(--text-main,#f8fafc)]">
            {t("library.providers.activeProviders")}
          </h2>
          <p className="text-xs text-[var(--text-muted,#94a3b8)] mt-0.5">
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

      {providers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border-main,#334155)] p-12 text-center text-[var(--text-muted,#94a3b8)] space-y-3">
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
              onToggleActive={toggleActive}
              onDelete={deleteProvider}
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
