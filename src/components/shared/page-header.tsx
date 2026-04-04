import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  eyebrow?: string;
};

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  eyebrow = "Workspace",
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {eyebrow}
        </div>
        <h1 className="font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
          {title}
        </h1>
        {subtitle ? <p className="max-w-2xl text-sm leading-5 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
    </div>
  );
}
