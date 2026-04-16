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
          "flex h-9 w-full appearance-none rounded-lg border border-border/80 bg-background/95 px-3 py-2 pr-10 text-sm text-foreground shadow-xs transition-[border-color,box-shadow,background-color] duration-150 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground",
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
