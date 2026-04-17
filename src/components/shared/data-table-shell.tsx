import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DataTableShell({
  children,
  footer,
  className,
  contentClassName,
  stickyHeader = false,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  stickyHeader?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-xs", className)}>
      <div
        className={cn(
          "min-w-0",
          stickyHeader && "max-h-[70vh] overflow-auto scrollbar-thin",
          contentClassName,
        )}
      >
        {children}
      </div>
      {footer ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/80 px-4 py-3 text-sm lg:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
