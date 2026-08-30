import React from "react";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  helperText?: string;
}

export function InputField({
  label,
  name,
  error,
  helperText,
  className = "",
  ...props
}: InputFieldProps) {
  return (
    <div className="space-y-1.5 w-full">
      <label htmlFor={name} className="block text-xs font-semibold text-text-main">
        {label}
        {props.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm bg-surface-elevated text-text-main transition-colors focus:outline-none focus:ring-2 focus:ring-primary-main placeholder:text-text-muted ${
          error ? "border-red-500 focus:ring-red-500" : "border-subtle focus:border-primary-main"
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {!error && helperText && <p className="text-xs text-text-muted">{helperText}</p>}
    </div>
  );
}
