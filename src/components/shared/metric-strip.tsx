import type { ReactNode } from "react";

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
  className,
}: {
  label: string;
  value: string;
  helper?: string;
  className?: string;
}) {
  return (
    <Card className={cn("metric-card border-border/80 bg-card/95 transition-all duration-200 hover:border-[rgb(var(--border-strong-rgb)/0.75)] hover:shadow-sm", className)}>
      <CardContent className="flex min-h-[126px] flex-col justify-between gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="metric-label">{label}</div>
          <div className="metric-value font-mono">{value}</div>
        </div>
        {helper ? <div className="metric-helper text-[11px] font-medium">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}
