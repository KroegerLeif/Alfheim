"use client";

import { Badge, Button, Card, CardContent, useTranslation } from "@alfheim/shared";
import { Trash2 } from "lucide-react";
import type { EquipmentRead, EquipmentScope } from "../types";
import { isEditableEquipment } from "../types";

const SCOPE_LABEL_KEYS: Record<EquipmentScope, string> = {
  system: "workout.scopeSystem",
  household: "workout.scopeHousehold",
  user: "workout.scopeUser",
};

interface EquipmentCardProps {
  equipment: EquipmentRead;
  onDelete: (equipment: EquipmentRead) => void;
  isDeleting?: boolean;
}

export function EquipmentCard({ equipment, onDelete, isDeleting = false }: EquipmentCardProps) {
  const { t } = useTranslation();
  const editable = isEditableEquipment(equipment);

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-2">
          <h3 className="truncate font-heading text-base font-bold uppercase tracking-wide">
            {equipment.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={equipment.scope === "system" ? "outline" : "secondary"}>
              {t(SCOPE_LABEL_KEYS[equipment.scope])}
            </Badge>
            {equipment.category && (
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                {equipment.category}
              </span>
            )}
          </div>
        </div>

        {editable && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${t("workout.delete")} ${equipment.name}`}
            disabled={isDeleting}
            onClick={() => onDelete(equipment)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
