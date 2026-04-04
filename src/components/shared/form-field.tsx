import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  children: ReactNode;
  error?: string;
  hint?: string;
  description?: string;
  className?: string;
  contentClassName?: string;
};

export function FormField({
  label,
  children,
  error,
  hint,
  description,
  className,
  contentClassName,
}: FormFieldProps) {
  return (
    <label className={cn("flex flex-col gap-2.5 text-sm", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-foreground">{label}</span>
        {hint ? <span className="text-xs font-medium text-muted-foreground">{hint}</span> : null}
      </div>
      <div className={cn("space-y-2", contentClassName)}>{children}</div>
      {error ? <span className="text-xs font-medium text-rose-500">{error}</span> : null}
      {!error && description ? <span className="text-xs leading-5 text-muted-foreground">{description}</span> : null}
    </label>
  );
}
