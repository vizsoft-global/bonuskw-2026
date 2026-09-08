"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

type FieldProps = {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
};

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, hint, error, prefix, suffix, className, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span> : null}
      <span
        className={cn(
          "flex h-12 items-center gap-2 rounded-2xl border bg-elevated px-3.5 text-sm transition-colors focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
          error ? "border-danger" : "border-line-strong",
        )}
      >
        {prefix ? <span className="shrink-0 text-muted">{prefix}</span> : null}
        <input
          ref={ref}
          id={inputId}
          className="min-w-0 flex-1 bg-transparent text-text outline-none placeholder:text-faint"
          aria-invalid={Boolean(error)}
          {...props}
        />
        {suffix ? <span className="shrink-0 text-muted">{suffix}</span> : null}
      </span>
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea({ label, hint, error, className, id, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span> : null}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(
          "min-h-28 w-full rounded-2xl border bg-elevated px-3.5 py-3 text-sm text-text outline-none transition-colors placeholder:text-faint focus:border-primary focus:ring-4 focus:ring-primary/15",
          error ? "border-danger" : "border-line-strong",
        )}
        {...props}
      />
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select({ label, hint, error, className, id, children, ...props }, ref) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <label htmlFor={inputId} className={cn("block", className)}>
      {label ? <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span> : null}
      <span
        className={cn(
          "relative flex h-12 items-center rounded-2xl border bg-elevated px-3.5 text-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
          error ? "border-danger" : "border-line-strong",
        )}
      >
        <select
          ref={ref}
          id={inputId}
          className="w-full appearance-none bg-transparent pe-6 text-text outline-none"
          {...props}
        >
          {children}
        </select>
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className="pointer-events-none absolute end-3 size-4 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="m6 8 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {error ? (
        <span className="mt-1.5 block text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-xs text-faint">{hint}</span>
      ) : null}
    </label>
  );
});

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-1 size-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-6 rtl:-translate-x-6" : "translate-x-1 rtl:-translate-x-1",
        )}
      />
    </button>
  );
}
