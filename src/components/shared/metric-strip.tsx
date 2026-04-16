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
    <Card className={cn("metric-card border-border/70 bg-card/90", className)}>
      <CardContent className="flex min-h-[124px] flex-col justify-between gap-3 p-4 lg:p-5">
        <div className="flex flex-col gap-1.5">
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
        </div>
        {helper ? <div className="metric-helper">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}
