import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function StickyFilterBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sticky-toolbar-shell", className)}>
      <div className="toolbar-shell rounded-xl border-0 bg-transparent px-3 py-2 shadow-none lg:px-4">
        {children}
      </div>
    </div>
  );
}
