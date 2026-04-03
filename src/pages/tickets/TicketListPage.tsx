import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid,
  MessageSquare,
  Plus,
  Table2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  getPriorityColor,
  timeAgo,
} from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { ticketService } from "@/services/ticketService";
import { getAppErrorMessage } from "@/services/shared";
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

  const createTicket = useMutation({
    mutationFn: ticketService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Đã tạo ticket mới");
      form.reset();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể tạo ticket."));
    },
  });

  const filteredCustomers = customers.filter((customer) =>
    customer.full_name.toLowerCase().includes(customerSearch.toLowerCase()),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Tạo Ticket"
      description="Thêm ticket hỗ trợ mới và gán người xử lý ngay từ đầu."
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
        <div className="space-y-2">
          <div className="text-sm font-medium">Tìm khách hàng</div>
          <input
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
          <input
            {...form.register("title")}
            className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
      <span className="font-medium">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-500">{error}</span> : null}
    </label>
  );
}

export function TicketListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: tickets = [], isLoading } = useTicketsQuery();
  const { data: users = [] } = useUsersQuery();
  const { data: customers = [] } = useCustomersQuery();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [highlightedTicketId, setHighlightedTicketId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const requestedCreate = searchParams.get("create") === "1";
  const prefillCustomerId = searchParams.get("customerId") ?? "";

  useEffect(() => {
    if (requestedCreate) {
      setCreateOpen(true);
    }
  }, [requestedCreate]);

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
        if (priorityFilter !== "all" && ticket.priority !== priorityFilter) return false;
        if (assignedFilter !== "all" && ticket.assigned_to !== assignedFilter) return false;
        if (categoryFilter !== "all" && ticket.category !== categoryFilter) return false;
        return true;
      }),
    [assignedFilter, categoryFilter, priorityFilter, tickets],
  );

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) =>
      ticketService.updateStatus(id, status),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["ticket"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(`Đã chuyển sang ${formatTicketStatus(variables.status)}`);
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể cập nhật trạng thái ticket."));
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ticket Hỗ Trợ"
        subtitle="Theo dõi luồng xử lý và phân bổ ticket chăm sóc khách hàng."
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
              >
                <LayoutGrid className="size-4" />
                Kanban
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                onClick={() => setViewMode("table")}
              >
                <Table2 className="size-4" />
                Bảng
              </Button>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Tạo Ticket
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-3">
          <Select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="all">Tất cả mức ưu tiên</option>
            <option value="urgent">Khẩn cấp</option>
            <option value="high">Cao</option>
            <option value="medium">Trung bình</option>
            <option value="low">Thấp</option>
          </Select>
          <Select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}>
            <option value="all">Tất cả phụ trách</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
          <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Tất cả danh mục</option>
            <option value="inquiry">Yêu cầu</option>
            <option value="feedback">Phản hồi</option>
            <option value="complaint">Khiếu nại</option>
            <option value="return">Đổi trả</option>
          </Select>
        </CardContent>
      </Card>

      {viewMode === "kanban" ? (
        <div className="overflow-x-auto">
          <div className="grid min-w-[1200px] grid-cols-5 gap-4">
            {columns.map((column) => {
              const columnTickets = filteredTickets.filter((ticket) => ticket.status === column.value);
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
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-sm font-semibold">{column.label}</div>
                      <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                        {columnTickets.length}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {columnTickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          draggable
                          onDragStart={() => setDraggedTicketId(ticket.id)}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                          className={`w-full rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary hover:bg-primary/5 ${
                            highlightedTicketId === ticket.id ? "ring-2 ring-primary/40" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-mono">{ticket.ticket_code}</span>
                            <span>{timeAgo(ticket.created_at)}</span>
                          </div>
                          <div className="mt-2 line-clamp-2 font-medium">{ticket.title}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {customerMap[ticket.customer_id]?.full_name ?? "--"}
                          </div>
                          <div className="mt-4 flex items-center justify-between gap-2">
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
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : filteredTickets.length ? (
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
            {filteredTickets.map((ticket) => (
              <TableRow key={ticket.id} className="cursor-pointer" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                <TableCell className="font-mono">{ticket.ticket_code}</TableCell>
                <TableCell>{ticket.title}</TableCell>
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
                <TableCell>{formatTicketStatus(ticket.status)}</TableCell>
                <TableCell>{timeAgo(ticket.created_at)}</TableCell>
                <TableCell>
                  {new Date(ticket.due_at).getTime() < Date.now() &&
                  ticket.status !== "resolved" &&
                  ticket.status !== "closed"
                    ? "Quá Hạn"
                    : "On Time"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title="Không có ticket phù hợp"
          description="Thử thay đổi bộ lọc hoặc tạo ticket mới."
        />
      )}

      <TicketFormModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            clearPrefillParams();
          }
        }}
        prefillCustomerId={prefillCustomerId}
      />
    </div>
  );
}
