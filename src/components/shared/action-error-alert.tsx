import { AlertTriangle, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AppErrorDetails } from "@/services/shared";

export function ActionErrorAlert({
  error,
  onRetry,
  onDismiss,
}: {
  error: AppErrorDetails;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="space-y-1">
            <div className="font-medium">
              {error.kind === "timeout"
                ? "Yêu cầu bị timeout"
                : error.kind === "network"
                  ? "Mất kết nối"
                  : error.kind === "validation"
                    ? "Dữ liệu chưa hợp lệ"
                    : "Không thể hoàn tất thao tác"}
            </div>
            <div>{error.message}</div>
          </div>
        </div>

        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-rose-700 hover:bg-rose-100 hover:text-rose-800"
            onClick={onDismiss}
            aria-label="Ẩn thông báo lỗi"
          >
            <X className="size-4" />
          </Button>
        ) : null}
      </div>

      {onRetry ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onRetry}
            className="border-rose-200 bg-white text-rose-900 hover:bg-rose-100"
          >
            <RotateCcw className="size-4" />
            Thử lại
          </Button>
        </div>
      ) : null}
    </div>
  );
}
