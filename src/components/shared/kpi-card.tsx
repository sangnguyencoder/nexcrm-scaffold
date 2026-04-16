import type { LucideIcon } from "lucide-react";
import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  title: string;
  value: string;
  description: string;
  trend: string;
  icon: LucideIcon;
  accentClassName: string;
};

export const KpiCard = memo(function KpiCard({
  title,
  value,
  description,
  trend,
  icon: Icon,
  accentClassName,
}: KpiCardProps) {
  return (
    <Card className="metric-card border-border/70 bg-card/90">
      <CardContent className="flex min-h-[148px] flex-col justify-between gap-4 p-4 lg:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="metric-label">{title}</div>
            <div className="metric-value">{value}</div>
          </div>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border border-current/15",
              accentClassName,
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-border/65 pt-3.5">
          <div className="text-sm leading-6 text-muted-foreground">{description}</div>
          <Badge className="shrink-0 bg-muted text-muted-foreground ring-border">{trend}</Badge>
        </div>
      </CardContent>
    </Card>
  );
});
