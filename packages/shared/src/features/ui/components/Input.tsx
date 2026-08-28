import * as React from "react";
import { cn } from "../utils/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Text input primitive. Height is 44px to satisfy the minimum touch-target
 * size on mobile; use `className` to override for dense desktop layouts.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full h-11 px-3 rounded text-sm font-mono",
        "border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)]",
        "placeholder:text-[var(--text-faint)] placeholder:normal-case",
        "focus:outline-none focus:border-[var(--primary-main)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        "w-full py-3 px-3 rounded text-sm font-mono resize-none",
        "border border-[var(--border-subtle)] bg-[var(--surface-canvas)] text-[var(--text-main)]",
        "placeholder:text-[var(--text-faint)] placeholder:normal-case",
        "focus:outline-none focus:border-[var(--primary-main)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export interface FieldProps {
  /** Associates the label with the control; must match the control's `id`. */
  htmlFor: string;
  label: string;
  required?: boolean;
  /** Rendered below the control and announced via `aria-describedby` on the caller's control. */
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

/**
 * Label + control + error wrapper. The caller is responsible for wiring
 * `id`/`aria-describedby` on the control it passes as `children`.
 */
function Field({ htmlFor, label, required = false, error, className, children }: FieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)]"
      >
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-bold uppercase text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export { Input, Textarea, Field };
