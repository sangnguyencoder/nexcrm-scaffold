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
    <Card className={cn("metric-card", className)}>
      <CardContent className="flex min-h-[132px] flex-col justify-between gap-4 p-4 lg:p-5">
        <div className="space-y-2">
          <div className="metric-label">{label}</div>
          <div className="metric-value">{value}</div>
        </div>
        {helper ? <div className="metric-helper">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}
