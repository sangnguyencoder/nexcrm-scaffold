import { AlertTriangle, Copy, PlugZap, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePosSyncLogsQuery, useSettingsQuery } from "@/hooks/useNexcrmQueries";
import { copyTextToClipboard, formatDateTime } from "@/lib/utils";
import type { PosSyncStatus } from "@/types";

function getSettingsStatusMeta(status: PosSyncStatus) {
  if (status === "success" || status === "active") {
    return {
      label: "Sẵn sàng",
      className: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    };
  }

  if (status === "processing" || status === "received") {
    return {
      label: "Đang xử lý",
      className: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
    };
  }

  return {
    label: "Lỗi cần kiểm tra",
    className: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
  };
}

function getLogStatusMeta(status: string) {
  if (status === "success") {
    return {
      label: "Thành công",
      className: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    };
  }

  if (status === "duplicate") {
    return {
      label: "Bỏ qua (duplicate)",
      className: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
    };
  }

  if (status === "processing" || status === "received") {
    return {
      label: "Đang xử lý",
      className: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
    };
  }

  return {
    label: "Thất bại",
    className: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
  };
}

function toLastSyncLabel(value: string | undefined) {
  if (!value) {
    return "Chưa có dữ liệu sync";
  }

  const parsedAt = Date.parse(value);
  if (Number.isNaN(parsedAt)) {
    return "Chưa có dữ liệu sync";
  }

  return formatDateTime(value);
}

export function PosSyncPage() {
  const navigate = useNavigate();
  const { data: logs = [], isFetching: isFetchingLogs, refetch: refetchLogs } = usePosSyncLogsQuery(150);
  const { data: settings, isFetching: isFetchingSettings, refetch: refetchSettings } = useSettingsQuery();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const statusMeta = getSettingsStatusMeta(settings?.integrations.pos_status ?? "active");
  const lastSyncLabel = toLastSyncLabel(settings?.integrations.last_sync);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (statusFilter !== "all" && log.status !== statusFilter) {
          return false;
        }

        if (!search.trim()) {
          return true;
        }

        const keyword = search.trim().toLowerCase();
        const haystack = `${log.event_id} ${log.order_external_id ?? ""} ${log.customer_phone ?? ""} ${log.customer_email ?? ""} ${log.error_message ?? ""}`.toLowerCase();
        return haystack.includes(keyword);
      }),
    [logs, search, statusFilter],
  );

  const isRefreshing = isFetchingLogs || isFetchingSettings;

  return (
    <div className="space-y-4">
      <PageHeader
        title="POS Sync"
        actions={
          <Badge className="bg-muted text-muted-foreground ring-border">
            {filteredLogs.length} log
          </Badge>
        }
      />

      {settings?.integrations.pos_status === "failed" ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="flex-1 space-y-2">
              <div className="font-semibold text-destructive">Lỗi cần kiểm tra</div>
              <div className="text-sm text-muted-foreground">
                Vui lòng kiểm tra log thất bại gần nhất và xác nhận webhook payload từ hệ thống POS.
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => navigate("/admin/settings")}
              >
                Kiểm tra cấu hình
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Webhook URL
          </div>
          <div className="mt-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
            {settings?.integrations.pos_webhook_url ?? "Chưa cấu hình"}
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const webhookUrl = settings?.integrations.pos_webhook_url ?? "";
                const copied = await copyTextToClipboard(webhookUrl);
                toast.success(copied ? "Đã copy webhook URL" : "Không thể copy webhook URL");
              }}
            >
              <Copy className="mr-2 size-4" />
              Copy URL
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void Promise.all([refetchLogs(), refetchSettings()]);
              }}
              disabled={isRefreshing}
            >
              <RefreshCcw className="mr-2 size-4" />
              {isRefreshing ? "Đang làm mới..." : "Làm mới trạng thái"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Trạng thái đồng bộ
          </div>
          <div className="mt-3">
            <StatusBadge
              label={statusMeta.label}
              className={statusMeta.className}
              dotClassName="bg-current"
            />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Last sync: <span className="font-medium text-foreground">{lastSyncLabel}</span>
          </div>
        </div>
      </div>

      <StickyFilterBar>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo event id, order id, phone, email"
          className="min-w-[260px] flex-1"
        />
        <FilterSelect
          value={statusFilter}
          onValueChange={setStatusFilter}
          options={[
            { value: "all", label: "Tất cả trạng thái" },
            { value: "success", label: "Thành công" },
            { value: "duplicate", label: "Trùng lặp" },
            { value: "processing", label: "Đang xử lý" },
            { value: "failed", label: "Thất bại" },
          ]}
          className="w-[220px]"
        />
      </StickyFilterBar>

      <DataTableShell stickyHeader>
        {filteredLogs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Kết quả</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => {
                const status = getLogStatusMeta(log.status);
                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{formatDateTime(log.created_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        Xử lý: {log.processed_at ? formatDateTime(log.processed_at) : "--"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.event_id}</div>
                      <div className="text-xs text-muted-foreground">{log.event_type}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.order_external_id ?? "--"}</div>
                      <div className="text-xs text-muted-foreground">
                        {log.customer_phone ?? log.customer_email ?? "--"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={status.label}
                        className={status.className}
                        dotClassName="bg-current"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-foreground">{log.error_message || "Đồng bộ thành công"}</div>
                      <div className="text-xs text-muted-foreground">
                        Transaction: {log.transaction_id ?? "--"}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={PlugZap}
              title="Chưa có log POS phù hợp"
              description="Thử đổi bộ lọc hoặc gửi payload thử nghiệm để kiểm tra luồng POS sync."
              className="min-h-[220px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>
    </div>
  );
}
