import { ScrollText } from "lucide-react";
import { useMemo, useState } from "react";

import { DataTableShell } from "@/components/shared/data-table-shell";
import { DatePicker } from "@/components/shared/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { InspectorList } from "@/components/shared/inspector-list";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuditQuery, useUsersQuery } from "@/hooks/useNexcrmQueries";
import { formatDateTime } from "@/lib/utils";

function getActionColor(action: string) {
  if (action === "create") {
    return "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300";
  }

  if (action === "update") {
    return "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300";
  }

  return "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300";
}

export function AuditLogPage() {
  const { data: logs = [] } = useAuditQuery();
  const { data: users = [] } = useUsersQuery();
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const userMap = useMemo(
    () =>
      users.reduce<Record<string, (typeof users)[number]>>((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {}),
    [users],
  );

  const filteredLogs = useMemo(
    () =>
      [...logs]
        .filter((log) => {
          if (userFilter !== "all" && log.user_id !== userFilter) return false;
          if (actionFilter !== "all" && log.action !== actionFilter) return false;
          if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
          if (dateFilter && !log.created_at.startsWith(dateFilter)) return false;

          if (search.trim()) {
            const keyword = search.toLowerCase();
            const user = userMap[log.user_id];
            const haystack = `${user?.full_name ?? "Hệ thống"} ${log.entity_type} ${log.entity_id} ${log.message}`.toLowerCase();
            if (!haystack.includes(keyword)) {
              return false;
            }
          }

          return true;
        })
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()),
    [actionFilter, dateFilter, entityFilter, logs, search, userFilter, userMap],
  );

  const selectedLog =
    filteredLogs.find((item) => item.id === selectedLogId) ??
    logs.find((item) => item.id === selectedLogId) ??
    null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nhật Ký Hệ Thống"
        // subtitle="Tập trung vào thao tác, thực thể và thay đổi để đội vận hành đọc log nhanh hơn."
        actions={<Badge className="bg-muted text-muted-foreground ring-border">{filteredLogs.length} log</Badge>}
      />

      <StickyFilterBar>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo người dùng, thực thể hoặc nội dung"
          className="min-w-[260px] flex-1"
        />
        <FilterSelect
          value={userFilter}
          onValueChange={setUserFilter}
          options={[
            { value: "all", label: "Tất cả người dùng" },
            ...users.map((user) => ({
              value: user.id,
              label: user.full_name,
            })),
          ]}
          className="w-[190px]"
        />
        <FilterSelect
          value={actionFilter}
          onValueChange={setActionFilter}
          options={[
            { value: "all", label: "Tất cả hành động" },
            { value: "create", label: "Tạo" },
            { value: "update", label: "Cập nhật" },
            { value: "delete", label: "Xóa" },
          ]}
          className="w-[180px]"
        />
        <FilterSelect
          value={entityFilter}
          onValueChange={setEntityFilter}
          options={[
            { value: "all", label: "Tất cả thực thể" },
            { value: "customer", label: "Khách hàng" },
            { value: "ticket", label: "Ticket" },
            { value: "campaign", label: "Chiến dịch" },
            { value: "transaction", label: "Giao dịch" },
            { value: "user", label: "Người dùng" },
          ]}
          className="w-[190px]"
        />
        <DatePicker value={dateFilter} onChange={setDateFilter} className="w-[190px]" />
      </StickyFilterBar>

      <DataTableShell stickyHeader>
        {filteredLogs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Thời gian</TableHead>
                <TableHead>Người dùng</TableHead>
                <TableHead>Hành động</TableHead>
                <TableHead>Thực thể</TableHead>
                <TableHead>Nội dung</TableHead>
                <TableHead className="text-right">Chi tiết</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((item) => {
                const user = userMap[item.user_id];

                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="text-sm font-medium">{formatDateTime(item.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{user?.full_name ?? "Hệ thống"}</div>
                      <div className="text-xs text-muted-foreground">{user?.role ?? "--"}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={item.action}
                        className={getActionColor(item.action)}
                        dotClassName="bg-current"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{item.entity_type}</div>
                      <div className="font-mono text-xs text-muted-foreground">{item.entity_id}</div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[520px] truncate text-sm text-foreground">{item.message}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLogId(item.id)}>
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={ScrollText}
              title="Không có log phù hợp"
              description="Thử đổi bộ lọc hoặc khoảng ngày để xem các thay đổi khác."
              className="min-h-[200px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>

      <Sheet
        open={Boolean(selectedLog)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLogId(null);
          }
        }}
        title={selectedLog ? `Log ${selectedLog.entity_type}` : "Chi tiết log"}
        // description={selectedLog ? "Xem nhanh metadata và payload trước/sau của thay đổi." : undefined}
      >
        {selectedLog ? (
          <div className="space-y-4">
            <InspectorList
              items={[
                { label: "Thời gian", value: formatDateTime(selectedLog.created_at) },
                { label: "Người dùng", value: userMap[selectedLog.user_id]?.full_name ?? "Hệ thống" },
                { label: "Hành động", value: selectedLog.action },
                { label: "Thực thể", value: `${selectedLog.entity_type} / ${selectedLog.entity_id}` },
              ]}
            />
            <div className="rounded-lg border border-border/80 bg-muted/25 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Message</div>
              <div className="mt-2 text-sm text-foreground">{selectedLog.message}</div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-lg border border-border/80 bg-muted/25 p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Before</div>
                <pre className="overflow-auto rounded-lg bg-card p-3 text-xs">
                  {JSON.stringify(selectedLog.before, null, 2)}
                </pre>
              </div>
              <div className="rounded-lg border border-border/80 bg-muted/25 p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">After</div>
                <pre className="overflow-auto rounded-lg bg-card p-3 text-xs">
                  {JSON.stringify(selectedLog.after, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
