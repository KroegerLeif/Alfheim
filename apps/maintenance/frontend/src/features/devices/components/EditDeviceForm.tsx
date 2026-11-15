"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Device, UpdateDevicePayload } from "@/shared/types";
import { DeviceDetailsForm } from "./DeviceDetailsForm";

interface EditDeviceFormProps {
  device: Device;
  onSubmit: (payload: UpdateDevicePayload) => void;
  onCancel: () => void;
  isPending: boolean;
  isError: boolean;
}

/** Edits the details of a registered device; its household cannot change (#505). */
export function EditDeviceForm({ device, onSubmit, onCancel, isPending, isError }: EditDeviceFormProps) {
  const t = useTranslations("maintenance");
  const [name, setName] = useState(device.name);
  const [model, setModel] = useState(device.model);
  const [serial, setSerial] = useState(device.serial);
  const [category, setCategory] = useState(device.category);
  const [location, setLocation] = useState(device.location);
  const [deviceStatus, setDeviceStatus] = useState<string>(device.status);
  const [intervalMonths, setIntervalMonths] = useState(device.service_interval_months ?? 12);
  const [notes, setNotes] = useState(device.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      model: model.trim(),
      serial: serial.trim(),
      category,
      location: location.trim(),
      status: deviceStatus,
      service_interval_months: intervalMonths,
      notes: notes.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} aria-label={t("deviceInventory.edit.editDevice")} className="space-y-4">
      <DeviceDetailsForm
        name={name}
        setName={setName}
        model={model}
        setModel={setModel}
        serial={serial}
        setSerial={setSerial}
        category={category}
        setCategory={setCategory}
        location={location}
        setLocation={setLocation}
        deviceStatus={deviceStatus}
        setDeviceStatus={setDeviceStatus}
        intervalMonths={intervalMonths}
        setIntervalMonths={setIntervalMonths}
        notes={notes}
        setNotes={setNotes}
      />
      {isError && (
        <p role="alert" className="text-xs text-red-500">
          {t("deviceInventory.edit.saveError")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-bold uppercase text-[var(--text-muted)] cursor-pointer"
        >
          {t("wizard.cancel")}
        </button>
        <button
          type="submit"
          disabled={isPending || !name.trim()}
          className="px-4 py-2 rounded-xl bg-[var(--primary-main)] text-black text-xs font-black uppercase disabled:opacity-50 cursor-pointer"
        >
          {isPending ? t("wizard.saving") : t("deviceInventory.edit.save")}
        </button>
      </div>
    </form>
  );
}
