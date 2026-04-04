import { memo } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  className?: string;
  dotClassName?: string;
};

export const StatusBadge = memo(function StatusBadge({
  label,
  className,
  dotClassName,
}: StatusBadgeProps) {
  return (
    <Badge className={cn("gap-1.5 rounded-md px-2.5 py-1 tracking-[0.06em]", className)}>
      <span className={cn("size-1.5 rounded-full", dotClassName)} />
      {label}
    </Badge>
  );
});
