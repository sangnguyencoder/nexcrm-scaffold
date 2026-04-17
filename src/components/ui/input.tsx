import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-lg border border-[rgb(var(--border-medium-rgb))] bg-card/90 px-3 text-[13px] text-foreground shadow-xs transition-all duration-150 ease-out placeholder:text-muted-foreground/90 hover:border-[rgb(var(--border-strong-rgb))] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100",
      className,
    )}
    {...props}
  />
));

Input.displayName = "Input";
