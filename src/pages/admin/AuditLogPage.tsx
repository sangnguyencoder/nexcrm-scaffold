import { useMemo, useState } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useAuditQuery, useUsersQuery } from "@/hooks/useNexcrmQueries";
import { formatDateTime } from "@/lib/utils";

export function AuditLogPage() {
  const { data: logs = [] } = useAuditQuery();
  const { data: users = [] } = useUsersQuery();
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (userFilter !== "all" && log.user_id !== userFilter) return false;
        if (actionFilter !== "all" && log.action !== actionFilter) return false;
        if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
        if (dateFilter && !log.created_at.startsWith(dateFilter)) return false;
        return true;
      }),
    [actionFilter, dateFilter, entityFilter, logs, userFilter],
  );

  const grouped = filteredLogs.reduce<Record<string, typeof filteredLogs>>((acc, item) => {
    const key = item.created_at.slice(0, 10);
    acc[key] ??= [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader title="Nhật Ký Hệ Thống" subtitle="Theo dõi mọi thao tác thay đổi trên dữ liệu demo." />

      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-4">
          <Select value={userFilter} onChange={(event) => setUserFilter(event.target.value)}>
            <option value="all">Tất cả người dùng</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
          <Select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="all">Tất cả hành động</option>
            <option value="create">Tạo</option>
            <option value="update">Cập nhật</option>
            <option value="delete">Xóa</option>
          </Select>
          <Select value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)}>
            <option value="all">Tất cả thực thể</option>
            <option value="customer">Customer</option>
            <option value="ticket">Ticket</option>
            <option value="campaign">Campaign</option>
            <option value="transaction">Transaction</option>
            <option value="user">User</option>
          </Select>
          <input
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
        </CardContent>
      </Card>

      <div className="space-y-6">
        {Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="space-y-3">
            <div className="font-display text-lg font-bold">{date}</div>
            {items.map((item) => {
              const user = users.find((entry) => entry.id === item.user_id);
              return (
                <Card key={item.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-2">
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(item.created_at)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{user?.full_name ?? "Hệ thống"}</span>
                          <span className="text-sm text-muted-foreground">{user?.role}</span>
                          <StatusBadge
                            label={item.action}
                            className={
                              item.action === "create"
                                ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25"
                                : item.action === "update"
                                  ? "bg-amber-500/15 text-amber-600 ring-amber-500/25"
                                  : "bg-rose-500/15 text-rose-600 ring-rose-500/25"
                            }
                            dotClassName="bg-current"
                          />
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.entity_type} · <span className="font-mono">{item.entity_id}</span>
                        </div>
                        <div className="text-sm">{item.message}</div>
                      </div>
                      <Button variant="secondary" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                        Xem chi tiết
                      </Button>
                    </div>
                    {expandedId === item.id ? (
                      <div className="grid gap-4 rounded-2xl bg-muted/40 p-4 md:grid-cols-2">
                        <div>
                          <div className="mb-2 font-medium">Before</div>
                          <pre className="overflow-auto rounded-xl bg-card p-3 text-xs">
                            {JSON.stringify(item.before, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="mb-2 font-medium">After</div>
                          <pre className="overflow-auto rounded-xl bg-card p-3 text-xs">
                            {JSON.stringify(item.after, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
