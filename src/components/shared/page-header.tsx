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
        "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
          {eyebrow}
        </div>
        <h1 className="text-balance font-display text-[clamp(1.6rem,2.6vw,2rem)] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:justify-start lg:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
