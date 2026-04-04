import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Checkbox({
  className,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-4.5 shrink-0 rounded-md border border-border/80 bg-background text-primary accent-primary shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
