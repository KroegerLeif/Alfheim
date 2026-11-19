"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Device } from "@/shared/types";
import { useDeviceEditing } from "../hooks/useDeviceEditing";
import { ConfirmDelete } from "./ConfirmDelete";
import { EditDeviceForm } from "./EditDeviceForm";

interface DeviceActionsProps {
  device: Device;
  /** Called after the device was deleted, so the detail panel can close. */
  onDeleted: () => void;
}

/** Edit and delete controls of the device detail panel (#505); render them for writers only. */
export function DeviceActions({ device, onDeleted }: DeviceActionsProps) {
  const t = useTranslations("maintenance");
  const { updateDevice, deleteDevice } = useDeviceEditing(device.id);
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <EditDeviceForm
        device={device}
        isPending={updateDevice.isPending}
        isError={updateDevice.isError}
        onCancel={() => setIsEditing(false)}
        onSubmit={(payload) => updateDevice.mutate(payload, { onSuccess: () => setIsEditing(false) })}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider text-[var(--text-main)] hover:border-[var(--primary-main)]/50 cursor-pointer"
        >
          <Pencil className="h-3.5 w-3.5" />
          {t("deviceInventory.edit.editDevice")}
        </button>
        <ConfirmDelete
          label={t("deviceInventory.edit.deleteDevice")}
          question={t("deviceInventory.edit.deleteDeviceQuestion", { name: device.name })}
          isPending={deleteDevice.isPending}
          onConfirm={() => deleteDevice.mutate(undefined, { onSuccess: onDeleted })}
        />
      </div>
      {deleteDevice.isError && (
        <p role="alert" className="text-xs text-red-500">
          {t("deviceInventory.edit.deleteError")}
        </p>
      )}
    </div>
  );
}
