import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[108px] w-full rounded-lg border border-border/80 bg-background/95 px-3 py-2.5 text-sm text-foreground shadow-xs transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/80 hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground disabled:opacity-100",
      className,
    )}
    {...props}
  />
));

Textarea.displayName = "Textarea";
