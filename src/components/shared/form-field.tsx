import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  required?: boolean;
};

export function FormField({
  label,
  children,
  error,
  hint,
  description,
  className,
  contentClassName,
  required = false,
}: FormFieldProps) {
  return (
    <label className={cn("flex flex-col text-sm", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : null}
        </span>
        {hint ? <span className="text-[11px] font-medium text-muted-foreground">{hint}</span> : null}
      </div>
      <div className={cn("flex flex-col gap-2", contentClassName)}>{children}</div>
      {error ? (
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </span>
      ) : null}
      {!error && description ? <span className="text-xs leading-5 text-muted-foreground">{description}</span> : null}
    </label>
  );
}
