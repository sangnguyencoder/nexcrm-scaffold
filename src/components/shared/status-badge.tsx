import { memo } from "react";

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
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none",
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClassName)} />
      {label}
    </span>
  );
});
