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
          <span className="block max-w-[46%] shrink-0 text-muted-foreground">{item.label}</span>
          <span
            className={cn(
              "block min-w-0 max-w-[54%] break-words text-right font-medium text-foreground",
              item.valueClassName,
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
