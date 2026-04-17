import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CompactPagination({
  page,
  totalPages,
  label,
  onPrevious,
  onNext,
}: {
  page: number;
  totalPages: number;
  label: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" className="h-8 min-w-[78px]" onClick={onPrevious} disabled={page <= 1}>
          <ChevronLeft className="size-4" />
          Trước
        </Button>
        <div className="rounded-lg border border-border/80 bg-muted/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {page}/{totalPages}
        </div>
        <Button variant="secondary" size="sm" className="h-8 min-w-[78px]" onClick={onNext} disabled={page >= totalPages}>
          Sau
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
