import type { ReactNode } from "react";

import { CardDescription, CardTitle } from "@/components/ui/card";

export function SectionHeaderCompact({
  eyebrow,
  title,
  description,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription className="max-w-2xl">{description}</CardDescription> : null}
      </div>
      {meta}
    </div>
  );
}
