import type { ReactNode } from "react";

import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "lucide-react";
import { cn } from "@/lib/utils";

type DataTableProps = {
  children: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyState?: ReactNode;
  loadingRows?: number;
  className?: string;
  contentClassName?: string;
};

function LoadingRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-2 p-4 lg:p-5">
      <Skeleton className="h-10 rounded-md" />
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-12 rounded-md" />
      ))}
    </div>
  );
}

export function DataTable({
  children,
  footer,
  isLoading = false,
  isEmpty = false,
  emptyState,
  loadingRows = 8,
  className,
  contentClassName,
}: DataTableProps) {
  return (
    <DataTableShell footer={footer} className={cn("min-w-0", className)} contentClassName={contentClassName}>
      {isLoading ? <LoadingRows rows={loadingRows} /> : null}
      {!isLoading && isEmpty ? (
        emptyState ?? (
          <div className="p-4 lg:p-5">
            <EmptyState
              icon={Database}
              title="Không có dữ liệu"
              description="Thử điều chỉnh bộ lọc hoặc thêm dữ liệu mới để tiếp tục."
              className="min-h-[220px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )
      ) : null}
      {!isLoading && !isEmpty ? children : null}
    </DataTableShell>
  );
}

