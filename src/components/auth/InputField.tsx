import * as React from "react";
import { AlertCircle } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InputFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  label: string;
  hint?: string;
  error?: string;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
  inputClassName?: string;
};

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  (
    {
      className,
      label,
      hint,
      error,
      id,
      startAdornment,
      endAdornment,
      inputClassName,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

    return (
      <label htmlFor={fieldId} className={cn("flex flex-col", className)}>
        <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>

        <div className="relative">
          {startAdornment ? (
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {startAdornment}
            </span>
          ) : null}

          <Input
            ref={ref}
            id={fieldId}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            className={cn(
              "h-9 rounded-md border-[rgb(var(--border-medium-rgb))] bg-card text-sm shadow-none placeholder:text-muted-foreground",
              startAdornment && "pl-10",
              endAdornment && "pr-11",
              error &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/10",
              inputClassName,
            )}
            {...props}
          />

          {endAdornment ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{endAdornment}</div>
          ) : null}
        </div>

        {error ? (
          <span id={errorId} className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="size-3" />
            {error}
          </span>
        ) : hint ? (
          <span id={hintId} className="mt-1 text-xs text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </label>
    );
  },
);

InputField.displayName = "InputField";
