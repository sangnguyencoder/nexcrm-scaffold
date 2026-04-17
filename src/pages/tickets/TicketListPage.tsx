import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  GripVertical,
  LayoutGrid,
  MessageSquare,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { CompactPagination } from "@/components/shared/compact-pagination";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { useAppMutation } from "@/hooks/useAppMutation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useCustomersQuery,
  useTicketsQuery,
  useUsersQuery,
} from "@/hooks/useNexcrmQueries";
import {
  formatTicketStatus,
  getStatusBadgeColor,
  getPriorityColor,
  timeAgo,
} from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ticketService } from "@/services/ticketService";
import { getAppErrorMessage } from "@/services/shared";
import { preloadRoutePath } from "@/routes/route-modules";
import type { TicketStatus } from "@/types";

const ticketSchema = z.object({
  customer_id: z.string().min(1, "Vui lòng chọn khách hàng"),
  title: z.string().min(5, "Tiêu đề tối thiểu 5 ký tự"),
  description: z.string().optional(),
  category: z.enum(["complaint", "feedback", "inquiry", "return"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  channel: z.enum(["phone", "email", "direct"]),
  assigned_to: z.string().optional(),
});

type TicketFormValues = z.infer<typeof ticketSchema>;

const columns: Array<{ label: string; value: TicketStatus; borderClass: string }> = [
  { label: "MỞ", value: "open", borderClass: "border-blue-500" },
  { label: "ĐANG XỬ LÝ", value: "in_progress", borderClass: "border-orange-500" },
  { label: "CHỜ", value: "pending", borderClass: "border-amber-500" },
  { label: "ĐÃ GIẢI QUYẾT", value: "resolved", borderClass: "border-emerald-500" },
  { label: "ĐÓNG", value: "closed", borderClass: "border-slate-500" },
];

function getPriorityBorderClass(priority: string) {
  if (priority === "urgent") return "border-l-destructive";
  if (priority === "high") return "border-l-warning";
  if (priority === "medium") return "border-l-info";
  return "border-l-[rgb(var(--border-medium-rgb)/1)]";
}

function TicketFormModal({
  open,
  onOpenChange,
  prefillCustomerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillCustomerId?: string;
}) {
  const queryClient = useQueryClient();
  const { data: customers = [] } = useCustomersQuery();
  const { data: users = [] } = useUsersQuery();
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDebouncedValue(customerSearch, 150);
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      customer_id: "",
      title: "",
      description: "",
      category: "inquiry",
      priority: "medium",
      channel: "email",
      assigned_to: users[0]?.id ?? "",
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      customer_id: prefillCustomerId ?? "",
      title: "",
      description: "",
      category: "inquiry",
      priority: "medium",
      channel: "email",
      assigned_to: users[0]?.id ?? "",
    });
  }, [form, open, prefillCustomerId, users]);

  const createTicket = useAppMutation({
    action: "ticket.create",
    errorMessage: "Không thể tạo ticket.",
    mutationFn: ticketService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Đã tạo ticket mới");
      form.reset();
      onOpenChange(false);
    },
  });

  const filteredCustomers = customers.filter((customer) =>
    customer.full_name.toLowerCase().includes(deferredCustomerSearch.toLowerCase()),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Tạo Ticket"
      // description="Thêm ticket hỗ trợ mới và gán người xử lý ngay từ đầu."
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) =>
          createTicket.mutate({
            ...values,
            description: values.description || "",
            assigned_to: values.assigned_to || users[0]?.id || "",
            status: "open",
          }),
        )}
      >
        {createTicket.actionError ? (
          <ActionErrorAlert
            error={createTicket.actionError}
            onDismiss={createTicket.clearActionError}
            onRetry={createTicket.canRetry ? () => void createTicket.retryLast() : undefined}
          />
        ) : null}
        <div className="space-y-2">
          <div className="text-sm font-medium">Tìm khách hàng</div>
          <Input
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Tìm theo tên khách hàng"
          />
          <Select {...form.register("customer_id")}>
            <option value="">Chọn khách hàng</option>
            {filteredCustomers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name} · {customer.customer_code}
              </option>
            ))}
          </Select>
          {form.formState.errors.customer_id ? (
            <div className="text-xs text-rose-500">
              {form.formState.errors.customer_id.message}
            </div>
          ) : null}
        </div>
        <Field label="Tiêu đề" error={form.formState.errors.title?.message}>
          <Input
            {...form.register("title")}
            placeholder="Nhập tiêu đề ticket"
          />
        </Field>
        <Field label="Mô tả">
          <Textarea {...form.register("description")} placeholder="Mô tả chi tiết vấn đề" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Danh mục">
            <Select {...form.register("category")}>
              <option value="inquiry">Yêu cầu</option>
              <option value="feedback">Phản hồi</option>
              <option value="complaint">Khiếu nại</option>
              <option value="return">Đổi trả</option>
            </Select>
          </Field>
          <Field label="Ưu tiên">
            <Select {...form.register("priority")}>
              <option value="low">Thấp</option>
              <option value="medium">Trung bình</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </Select>
          </Field>
          <Field label="Kênh">
            <Select {...form.register("channel")}>
              <option value="email">Email</option>
              <option value="phone">Điện thoại</option>
              <option value="direct">Trực tiếp</option>
            </Select>
          </Field>
          <Field label="Phụ trách">
            <Select {...form.register("assigned_to")}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.full_name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" disabled={createTicket.isPending}>
            {createTicket.isPending ? "Đang tạo..." : "Tạo ticket"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-500">{error}</span> : null}
    </label>
  );
}

export function TicketListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("table");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const deferredSearch = useDebouncedValue(search, 180);
  const ticketsQuery = useTicketsQuery({
    priority: priorityFilter,
    assignedTo: assignedFilter,
    category: categoryFilter,
  });
  const { data: tickets = [], isLoading } = ticketsQuery;
  const { data: users = [] } = useUsersQuery();
  const { data: customers = [] } = useCustomersQuery();
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
  const [currentTimestamp] = useState(() => Date.now());
  const [page, setPage] = useState(1);
  const requestedCreate = searchParams.get("create") === "1";
  const prefillCustomerId = searchParams.get("customerId") ?? "";
  const createOpen = requestedCreate || createOpenLocal;

  const clearPrefillParams = () => {
    if (!requestedCreate && !prefillCustomerId) return;
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    next.delete("customerId");
    setSearchParams(next, { replace: true });
  };

  const customerMap = useMemo(
    () =>
      customers.reduce<Record<string, (typeof customers)[number]>>((acc, customer) => {
        acc[customer.id] = customer;
        return acc;
      }, {}),
    [customers],
  );
  const userMap = useMemo(
    () =>
      users.reduce<Record<string, string>>((acc, user) => {
        acc[user.id] = user.full_name;
        return acc;
      }, {}),
    [users],
  );

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        if (!deferredSearch) {
          return true;
        }

        const customerName = customerMap[ticket.customer_id]?.full_name ?? "";
        const haystack = `${ticket.ticket_code} ${ticket.title} ${customerName}`.toLowerCase();
        return haystack.includes(deferredSearch.toLowerCase());
      }),
    [customerMap, deferredSearch, tickets],
  );

  useEffect(() => {
    setPage(1);
  }, [assignedFilter, categoryFilter, deferredSearch, priorityFilter, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / 12));
  const currentPage = Math.min(page, totalPages);
  const pagedTickets = useMemo(
    () => filteredTickets.slice((currentPage - 1) * 12, currentPage * 12),
    [currentPage, filteredTickets],
  );

  const ticketsByStatus = useMemo(
    () =>
      filteredTickets.reduce<Record<TicketStatus, typeof filteredTickets>>(
        (acc, ticket) => {
          (acc[ticket.status] ??= []).push(ticket);
          return acc;
        },
        {
          open: [],
          in_progress: [],
          pending: [],
          resolved: [],
          closed: [],
        },
      ),
    [filteredTickets],
  );

  const updateStatus = useAppMutation({
    action: "ticket.update-status",
    errorMessage: "Không thể cập nhật trạng thái ticket.",
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      ticketService.updateStatus(id, status),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["ticket"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Đã chuyển sang ${formatTicketStatus(variables.status)}`);
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`support-tickets-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_tickets" },
        async (payload) => {
          const title = String((payload.new as { title?: string }).title ?? "Ticket mới");
          toast.info(`Ticket mới: ${title}`);
          await queryClient.invalidateQueries({ queryKey: ["tickets"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_tickets" },
        async (payload) => {
          const ticketId = String((payload.new as { id?: string }).id ?? "");
          setHighlightedTicketId(ticketId || null);
          window.setTimeout(() => setHighlightedTicketId((current) => (current === ticketId ? null : current)), 1500);
          await queryClient.invalidateQueries({ queryKey: ["tickets"] });
          await queryClient.invalidateQueries({ queryKey: ["ticket"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  if (ticketsQuery.error) {
    return (
      <PageErrorState
        title="Không thể tải danh sách ticket"
        description={getAppErrorMessage(
          ticketsQuery.error,
          "Danh sách ticket chưa tải được. Vui lòng thử lại sau ít phút.",
        )}
        onRetry={() => void ticketsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ticket Hỗ Trợ"
        // subtitle="Triage theo bảng trước, rồi chuyển sang kanban khi cần kéo thả luồng xử lý."
        actions={
          <>
            <StatusBadge
              label={`${tickets.filter((ticket) => ticket.status === "open").length} đang mở`}
              className="bg-primary/10 text-primary ring-primary/20"
              dotClassName="bg-primary"
            />
            <div className="flex rounded-2xl bg-muted p-1">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                onClick={() => setViewMode("kanban")}
                size="sm"
              >
                <LayoutGrid className="size-4" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                onClick={() => setViewMode("table")}
                size="sm"
              >
                <Table2 className="size-4" />
                Bảng
              </Button>
            </div>
            <Button onClick={() => setCreateOpenLocal(true)}>
              <Plus className="size-4" />
              Tạo Ticket
            </Button>
          </>
        }
      />

      <StickyFilterBar>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo mã ticket, tiêu đề hoặc khách hàng"
            className="pl-9"
          />
        </div>
        <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="w-[170px]">
          <option value="all">Tất cả mức ưu tiên</option>
          <option value="urgent">Khẩn cấp</option>
          <option value="high">Cao</option>
          <option value="medium">Trung bình</option>
          <option value="low">Thấp</option>
        </Select>
        <Select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)} className="w-[180px]">
          <option value="all">Tất cả phụ trách</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name}
            </option>
          ))}
        </Select>
        <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="w-[170px]">
          <option value="all">Tất cả danh mục</option>
          <option value="inquiry">Yêu cầu</option>
          <option value="feedback">Phản hồi</option>
          <option value="complaint">Khiếu nại</option>
          <option value="return">Đổi trả</option>
        </Select>
      </StickyFilterBar>

      {viewMode === "kanban" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[1200px] grid-cols-5 gap-4">
            {columns.map((column) => {
              const columnTickets = ticketsByStatus[column.value] ?? [];
              return (
                <Card
                  key={column.value}
                  className={`border-t-4 ${column.borderClass}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedTicketId) {
                      updateStatus.mutate({ id: draggedTicketId, status: column.value });
                      setDraggedTicketId(null);
                    }
                  }}
                >
                  <CardContent className="space-y-3 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="font-display text-sm font-semibold">{column.label}</div>
                        <div className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                          {columnTickets.length}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCreateOpenLocal(true)}
                        className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Thêm
                      </button>
                    </div>
                    <div className="space-y-3">
                      {columnTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedTicketId(ticket.id)}
                          onMouseEnter={() => preloadRoutePath(`/tickets/${ticket.id}`)}
                          onFocus={() => preloadRoutePath(`/tickets/${ticket.id}`)}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className={`group relative w-full rounded-lg border border-border border-l-4 bg-background p-3 text-left transition hover:border-primary hover:bg-primary/5 ${
                            highlightedTicketId === ticket.id ? "ring-2 ring-primary/40" : ""
                          } ${getPriorityBorderClass(ticket.priority)}`}
                        >
                          <GripVertical className="absolute right-2 top-2 size-4 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-mono">{ticket.ticket_code}</span>
                            <span>{timeAgo(ticket.created_at)}</span>
                          </div>
                          <div className="mt-2 line-clamp-2 text-sm font-medium">{ticket.title}</div>
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {customerMap[ticket.customer_id]?.full_name ?? "--"}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-2">
                              <StatusBadge
                                label={ticket.priority}
                                className={getPriorityColor(ticket.priority)}
                                dotClassName="bg-current"
                              />
                              <StatusBadge
                                label={ticket.category}
                                className="bg-muted text-muted-foreground ring-border"
                                dotClassName="bg-primary"
                              />
                            </div>
                            <CustomerAvatar
                              name={userMap[ticket.assigned_to] ?? "NA"}
                              type="potential"
                              className="size-6 text-[10px]"
                            />
                          </div>
                        </button>
                      ))}
                      {!columnTickets.length ? (
                        <div className="rounded-lg border border-dashed border-border/70 bg-background/75 px-3 py-4 text-center text-xs text-muted-foreground">
                          Không có ticket
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : filteredTickets.length ? (
        <DataTableShell stickyHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Tiêu đề</TableHead>
                <TableHead>Khách Hàng</TableHead>
                <TableHead>Ưu Tiên</TableHead>
                <TableHead>Danh Mục</TableHead>
                <TableHead>Phụ Trách</TableHead>
                <TableHead>Trạng Thái</TableHead>
                <TableHead>Ngày Tạo</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTickets.map((ticket) => {
                const isOverdue =
                  new Date(ticket.due_at).getTime() < currentTimestamp &&
                  ticket.status !== "resolved" &&
                  ticket.status !== "closed";

                return (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer"
                    onMouseEnter={() => preloadRoutePath(`/tickets/${ticket.id}`)}
                    onFocus={() => preloadRoutePath(`/tickets/${ticket.id}`)}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                  >
                    <TableCell className="font-mono">{ticket.ticket_code}</TableCell>
                    <TableCell>
                      <div className="max-w-[320px] truncate font-medium">{ticket.title}</div>
                    </TableCell>
                    <TableCell>{customerMap[ticket.customer_id]?.full_name ?? "--"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={ticket.priority}
                        className={getPriorityColor(ticket.priority)}
                        dotClassName="bg-current"
                      />
                    </TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{userMap[ticket.assigned_to] ?? "--"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        label={formatTicketStatus(ticket.status)}
                        className={getStatusBadgeColor(ticket.status)}
                        dotClassName="bg-current"
                      />
                    </TableCell>
                    <TableCell>{timeAgo(ticket.created_at)}</TableCell>
                    <TableCell className={isOverdue ? "text-rose-500" : ""}>
                      {isOverdue ? "Quá hạn" : "On time"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DataTableShell>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="Không có ticket phù hợp"
          description="Thử thay đổi bộ lọc hoặc tạo ticket mới."
        />
      )}

      {filteredTickets.length ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <CompactPagination
            page={currentPage}
            totalPages={totalPages}
            label={`${filteredTickets.length} ticket`}
            onPrevious={() => setPage(Math.max(1, currentPage - 1))}
            onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
          />
        </div>
      ) : null}

      <TicketFormModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpenLocal(open);
          if (!open) {
            clearPrefillParams();
          }
        }}
        prefillCustomerId={prefillCustomerId}
      />
    </div>
  );
}
