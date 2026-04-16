import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type FormSectionProps = {
  title: string;
  description?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  title,
  description,
  meta,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={cn("form-section-shell flex flex-col gap-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground">{title}</h3>
          {description ? <p className="text-sm leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}
