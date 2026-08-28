"use client";

import { Button } from "@alfheim/shared";
import { Minus, Plus } from "lucide-react";

interface SetStepperProps {
  label: string;
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  /** Rendered next to the value, e.g. "kg". */
  suffix?: string;
  decrementLabel: string;
  incrementLabel: string;
}

/**
 * Large ±stepper for logging a set mid-workout.
 *
 * Targets are 56px — comfortably above the 44px minimum — because this is
 * operated one-handed, at arm's length, often with chalk or gloves on. The
 * value is also a real number input so a precise weight can be typed instead.
 */
export function SetStepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  suffix,
  decrementLabel,
  incrementLabel,
}: SetStepperProps) {
  const clamp = (next: number) => Math.max(min, Number.isFinite(next) ? next : min);

  return (
    <div className="space-y-2">
      <span className="block text-center text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          aria-label={decrementLabel}
          className="h-14 w-14 shrink-0 text-lg"
          onClick={() => onChange(clamp(value - step))}
        >
          <Minus aria-hidden="true" />
        </Button>

        <label className="sr-only" htmlFor={`stepper-${label}`}>
          {label}
        </label>
        <input
          id={`stepper-${label}`}
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          min={min}
          onChange={(event) => onChange(clamp(Number(event.target.value)))}
          className="h-14 min-w-0 flex-1 rounded border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-center font-mono text-2xl font-bold text-[var(--text-main)] focus:border-[var(--primary-main)] focus:outline-none"
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="shrink-0 font-mono text-xs uppercase text-[var(--text-muted)]"
          >
            {suffix}
          </span>
        )}

        <Button
          type="button"
          variant="outline"
          aria-label={incrementLabel}
          className="h-14 w-14 shrink-0 text-lg"
          onClick={() => onChange(clamp(value + step))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
