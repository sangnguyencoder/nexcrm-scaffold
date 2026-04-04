import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DataTableShell({
  children,
  footer,
  className,
  contentClassName,
}: {
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <div className={cn("panel overflow-hidden", className)}>
      <div className={cn("min-w-0", contentClassName)}>{children}</div>
      {footer ? (
        <div className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3.5 text-sm lg:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
