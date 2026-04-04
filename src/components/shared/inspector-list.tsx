import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type InspectorItem = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

export function InspectorList({
  items,
  className,
}: {
  items: InspectorItem[];
  className?: string;
}) {
  return (
    <div className={cn("inspector-list", className)}>
      {items.map((item) => (
        <div key={item.label} className="inspector-list-row">
          <span className="max-w-[48%] text-muted-foreground">{item.label}</span>
          <span className={cn("max-w-[52%] text-right font-medium text-foreground", item.valueClassName)}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
