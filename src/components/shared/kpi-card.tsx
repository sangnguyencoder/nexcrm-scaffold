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
    <Card className="metric-card">
      <CardContent className="flex min-h-[156px] flex-col justify-between gap-5 p-5 lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="metric-label">{title}</div>
            <div className="metric-value">{value}</div>
          </div>
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg border border-current/10 shadow-xs",
              accentClassName,
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-border/70 pt-4">
          <div className="text-sm leading-6 text-muted-foreground">{description}</div>
          <Badge className="shrink-0 bg-muted text-muted-foreground ring-border">{trend}</Badge>
        </div>
      </CardContent>
    </Card>
  );
});
