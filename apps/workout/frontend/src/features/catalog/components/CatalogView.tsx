"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger, useTranslation } from "@alfheim/shared";
import { EquipmentListView } from "@/features/equipment";
import { ExerciseListView } from "@/features/exercises";

/**
 * Catalog shell. Exercises and equipment are separate backend resources but a
 * single user-facing concern, so they share one route behind tabs rather than
 * costing two entries in the four-slot mobile navigation.
 */
export function CatalogView() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-black uppercase tracking-wide md:text-3xl">
          {t("workout.catalogTitle")}
        </h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[var(--text-muted)]">
          {t("workout.catalogSubtitle")}
        </p>
      </header>

      <Tabs defaultValue="exercises">
        <TabsList aria-label={t("workout.catalogTitle")}>
          <TabsTrigger value="exercises">{t("workout.exercises")}</TabsTrigger>
          <TabsTrigger value="equipment">{t("workout.equipment")}</TabsTrigger>
        </TabsList>

        <TabsContent value="exercises">
          <ExerciseListView />
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentListView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
