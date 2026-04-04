import * as React from "react";

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
      <label htmlFor={fieldId} className={cn("flex flex-col gap-2", className)}>
        <span className="text-sm font-medium text-foreground">{label}</span>

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
              "h-11 rounded-lg border-border bg-background/95 text-[15px] shadow-none placeholder:text-muted-foreground/75",
              startAdornment && "pl-10",
              endAdornment && "pr-11",
              error &&
                "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive",
              inputClassName,
            )}
            {...props}
          />

          {endAdornment ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">{endAdornment}</div>
          ) : null}
        </div>

        {error ? (
          <span id={errorId} className="text-sm text-destructive">
            {error}
          </span>
        ) : hint ? (
          <span id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </label>
    );
  },
);

InputField.displayName = "InputField";
