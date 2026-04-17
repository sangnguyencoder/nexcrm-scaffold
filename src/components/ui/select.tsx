import * as React from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const Select = React.forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const disabled = props.disabled;

  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full appearance-none rounded-xl border border-[rgb(var(--border-medium-rgb))] bg-card/90 px-3.5 pr-10 text-[13px] font-medium text-foreground shadow-xs transition-all duration-150 ease-out hover:border-[rgb(var(--border-strong-rgb))] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground",
          disabled && "opacity-60",
        )}
      >
        <ChevronDown className="size-4" />
      </span>
    </div>
  );
});

Select.displayName = "Select";
