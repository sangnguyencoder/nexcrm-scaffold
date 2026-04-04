import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function BulkActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}
