import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "panel flex min-h-[180px] flex-col items-center justify-center gap-3 px-5 text-center",
        className,
      )}
    >
      <div className="rounded-lg border border-border/70 bg-muted/55 p-2.5 text-muted-foreground">
        <Icon className="size-7" />
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
        <p className="max-w-md text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
