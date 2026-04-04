import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Switch({
  className,
  checked,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} {...props} />
      {/* Track: dùng h-6 w-11 (chuẩn Tailwind v3) thay h-6.5 */}
      <span className="h-6 w-11 rounded-full border border-border/80 bg-muted/80 transition-colors peer-checked:border-primary/30 peer-checked:bg-primary/20 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-60" />
      {/* Thumb: dùng h-5 w-5 (thay size-5.5) và translate-x-5 (thay translate-x-4.5) */}
      <span className="absolute left-0.5 h-5 w-5 rounded-full border border-border/60 bg-background shadow-xs transition-transform peer-checked:translate-x-5 peer-checked:border-primary/20 peer-checked:bg-primary peer-checked:shadow-soft" />
    </label>
  );
}
