import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricStrip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("metric-strip", className)}>{children}</div>;
}

export function MetricStripItem({
  label,
  value,
  helper,
  icon: Icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: string;
  helper?: ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
  className?: string;
}) {
  const toneClassMap: Record<NonNullable<typeof tone>, string> = {
    primary: "bg-primary/12 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/14 text-warning",
    danger: "bg-destructive/12 text-destructive",
    info: "bg-info/12 text-info",
    neutral: "bg-muted text-muted-foreground",
  };

  return (
    <Card className={cn("metric-card border-border/80 bg-card/95 transition-all duration-200 hover:border-[rgb(var(--border-strong-rgb)/0.75)] hover:shadow-sm", className)}>
      <CardContent className="flex min-h-[126px] flex-col justify-between gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="metric-label">{label}</div>
            {Icon ? (
              <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg", toneClassMap[tone])}>
                <Icon className="size-4" />
              </span>
            ) : null}
          </div>
          <div className="metric-value tabular-nums">{value}</div>
        </div>
        {helper ? <div className="metric-helper text-[11px] font-medium">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}
