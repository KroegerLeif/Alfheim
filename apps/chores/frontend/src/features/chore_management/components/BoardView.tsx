"use client";

import { useChoreTemplates } from "../services/choresService";
import { TaskCard } from "./TaskCard";
import { FilterBar } from "./FilterBar";
import { Plus, Layers } from "lucide-react";
import { Link } from "@/navigation";
import { useState } from "react";
import { useTranslation } from "@alfheim/shared";

export function BoardView() {
  const { t } = useTranslation();
  const { data: templates = [], isLoading, isError } = useChoreTemplates();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesPoints = true;
    if (selectedFilter === "high") matchesPoints = template.points >= 30;
    else if (selectedFilter === "medium") matchesPoints = template.points >= 15 && template.points < 30;
    else if (selectedFilter === "standard") matchesPoints = template.points < 15;

    return matchesSearch && matchesPoints;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 select-none">
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-[var(--text-main)] uppercase tracking-wide">
            {t("chores.boardTitle")}
          </h1>
          <p className="text-xs text-[var(--text-muted)] font-mono uppercase mt-1">
            {t("chores.boardSubtitle")}
          </p>
        </div>

        {/* Create Task Button */}
        <Link
          href="/wizard"
          className="flex items-center gap-1.5 px-4 py-2 bg-[var(--primary-main)] text-black border border-[var(--primary-main)] hover:bg-blue-600 font-mono font-bold text-xs uppercase rounded-lg shadow-[0_0_12px_var(--accent-glow)] cursor-pointer"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>{t("chores.createTask")}</span>
        </Link>
      </div>

      {/* Filter Options */}
      <FilterBar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedFilter={selectedFilter}
        setSelectedFilter={setSelectedFilter}
      />

      {/* Main Grid View */}
      {isError ? (
        <div className="border border-rose-800/40 bg-rose-950/20 text-rose-400 p-4 text-xs font-bold uppercase rounded-lg">
          Failed to load chore templates board.
        </div>
      ) : isLoading ? (
        <div className="h-60 flex items-center justify-center">
          <div className="h-6.5 w-6.5 animate-spin rounded-full border-2 border-[var(--primary-main)] border-t-transparent"></div>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-lg">
          <Layers className="h-8 w-8 text-[var(--text-muted)] mb-3" />
          <p className="text-[var(--text-main)] font-semibold uppercase font-mono text-sm">
            {searchQuery ? t("chores.noBlueprintsFound") : t("chores.noTasksConfigured")}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
            {searchQuery
              ? t("chores.noBlueprintsFoundSub")
              : t("chores.noTasksConfiguredSub")}
          </p>
          {!searchQuery && (
            <Link
              href="/wizard"
              className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 bg-[var(--primary-main)] text-black border border-[var(--primary-main)] hover:bg-blue-600 font-mono font-bold text-xs uppercase rounded-lg shadow-[0_0_12px_var(--accent-glow)] cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t("chores.createTask")}</span>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <TaskCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
