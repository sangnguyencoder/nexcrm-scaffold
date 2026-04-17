import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/80 px-2.5 py-1 text-[11px] font-semibold leading-none shadow-[0_1px_0_rgba(15,23,42,0.03)]",
        className,
      )}
      {...props}
    />
  );
}
