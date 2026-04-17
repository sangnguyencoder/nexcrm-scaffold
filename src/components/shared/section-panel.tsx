import type { ReactNode } from "react";

import { SectionHeaderCompact } from "@/components/shared/section-header-compact";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionPanelProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function SectionPanel({
  title,
  description,
  eyebrow,
  meta,
  children,
  className,
  contentClassName,
}: SectionPanelProps) {
  return (
    <Card className={cn("overflow-hidden border-border/80 bg-card/90", className)}>
      <CardHeader className="compact-panel-header">
        <SectionHeaderCompact
          eyebrow={eyebrow}
          title={title}
          description={description}
          meta={meta}
        />
      </CardHeader>
      <CardContent className={cn("p-4 lg:p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
