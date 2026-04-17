import { memo } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  label: string;
  className?: string;
  dotClassName?: string;
  icon?: LucideIcon;
};

export const StatusBadge = memo(function StatusBadge({
  label,
  className,
  dotClassName,
  icon: Icon,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        className,
      )}
    >
      {Icon ? (
        <Icon className="size-3.5" />
      ) : (
        <span className={cn("size-1.5 rounded-full", dotClassName)} />
      )}
      {label}
    </span>
  );
});
