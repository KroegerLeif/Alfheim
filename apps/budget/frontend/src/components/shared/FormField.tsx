import React from "react";

/** Shared Tailwind classes for text, number, date and select inputs inside dialogs. */
export const FIELD_CLASS =
  "w-full px-3 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-main)]";

export interface FormFieldProps {
  /** `id` of the input the label belongs to. */
  id: string;
  label: React.ReactNode;
  children: React.ReactNode;
}

/** A labelled form control; the label is bound to the control through `id`. */
export function FormField({ id, label, children }: FormFieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-xs font-medium text-[var(--text-muted)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
