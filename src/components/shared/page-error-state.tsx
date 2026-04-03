import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageErrorStateProps = {
  title?: string;
  description: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

export function PageErrorState({
  title = "Không thể tải dữ liệu",
  description,
  retryLabel = "Thử lại",
  onRetry,
  className,
}: PageErrorStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-rose-200 bg-rose-50/60 px-6 py-10 text-center dark:border-rose-900/50 dark:bg-rose-950/20",
        className,
      )}
    >
      <div className="rounded-full bg-white p-4 text-rose-500 shadow-sm ring-1 ring-rose-100 dark:bg-card dark:ring-rose-900/40">
        <AlertTriangle className="size-10" />
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-xl font-semibold text-foreground">{title}</h3>
        <p className="max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCcw className="size-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
