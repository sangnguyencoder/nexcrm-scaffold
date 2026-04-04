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
        "panel flex min-h-[180px] flex-col items-center justify-center gap-3 px-5 py-7 text-center",
        className,
      )}
    >
      <div className="rounded-lg border border-rose-200/70 bg-rose-50 p-2.5 text-rose-500 dark:border-rose-900/50 dark:bg-rose-950/30">
        <AlertTriangle className="size-6" />
      </div>
      <div className="space-y-2">
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        <p className="max-w-xl text-sm leading-5 text-muted-foreground">{description}</p>
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
