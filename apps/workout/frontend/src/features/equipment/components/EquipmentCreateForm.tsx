"use client";

import * as React from "react";
import { Button, Card, CardContent, Field, Input, Select, useTranslation } from "@alfheim/shared";
import { Loader2, Plus } from "lucide-react";
import { useCreateEquipment } from "../hooks/useEquipment";
import type { EquipmentScope } from "../types";

interface EquipmentCreateFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function EquipmentCreateForm({ onSuccess, onCancel }: EquipmentCreateFormProps) {
  const { t } = useTranslation();
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [scope, setScope] = React.useState<Exclude<EquipmentScope, "system">>("household");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const createMutation = useCreateEquipment();

  const scopeOptions = [
    { value: "household", label: t("workout.scopeHousehold") },
    { value: "user", label: t("workout.scopeUser") },
  ];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage(t("workout.equipmentNameRequired"));
      return;
    }

    createMutation.mutate(
      { name: name.trim(), category: category.trim() || null, scope },
      {
        onSuccess: () => {
          setName("");
          setCategory("");
          onSuccess();
        },
        onError: (error) => setErrorMessage(error.message || t("workout.saveFailed")),
      }
    );
  };

  return (
    <Card className="max-w-xl">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field htmlFor="equipment-name" label={t("workout.equipmentName")} required error={errorMessage}>
            <Input
              id="equipment-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setErrorMessage(null);
              }}
              aria-describedby={errorMessage ? "equipment-name-error" : undefined}
              required
            />
          </Field>

          <Field htmlFor="equipment-category" label={t("workout.category")}>
            <Input
              id="equipment-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </Field>

          <Field htmlFor="equipment-scope" label={t("workout.scope")}>
            <Select
              id="equipment-scope"
              options={scopeOptions}
              value={scope}
              onChange={(event) =>
                setScope(event.target.value as Exclude<EquipmentScope, "system">)
              }
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={createMutation.isPending} className="min-h-11 flex-1">
              {createMutation.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus aria-hidden="true" />
              )}
              {t("workout.create")}
            </Button>
            <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>
              {t("workout.cancel")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
