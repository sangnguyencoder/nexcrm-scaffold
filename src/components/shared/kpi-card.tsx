import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { memo } from "react";

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
  const isDownTrend = /-|↓/.test(trend);
  const TrendIcon = isDownTrend ? TrendingDown : TrendingUp;

  return (
    <Card className="metric-card rounded-lg border border-border bg-card shadow-xs transition-all duration-200 hover:border-[rgb(var(--border-medium-rgb))] hover:shadow-sm">
      <CardContent className="flex min-h-[148px] flex-col justify-between gap-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-md",
              accentClassName,
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
        <div className="text-3xl font-semibold tabular-nums text-foreground">{value}</div>
        <div
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium",
            isDownTrend ? "text-destructive" : "text-success",
          )}
        >
          <TrendIcon className="size-3" />
          <span>
            {trend} {description}
          </span>
        </div>
      </CardContent>
    </Card>
  );
});
