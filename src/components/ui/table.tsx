import type { HTMLAttributes, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Table({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-card/95 shadow-xs">
      <div className="overflow-x-auto">
        <table className={cn("w-full caption-bottom text-[13px] leading-relaxed", className)} {...props} />
      </div>
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("bg-muted/65 [&_th]:sticky [&_th]:top-0 [&_th]:z-[1] [&_th]:bg-muted/90", className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-b-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "h-[54px] border-b border-border/80 transition-colors duration-100 hover:bg-muted/55 data-[state=selected]:bg-primary/10 data-[state=selected]:[box-shadow:inset_2px_0_0_0_rgb(var(--accent-rgb))]",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "border-b border-border/80 px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-4 py-3.5 align-middle text-sm text-foreground", className)} {...props} />;
}
