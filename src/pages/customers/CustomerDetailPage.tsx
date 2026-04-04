import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CreditCard, MessageSquare, Plus, StickyNote, Target, Ticket } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { InspectorList } from "@/components/shared/inspector-list";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionPanel } from "@/components/shared/section-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAppMutation } from "@/hooks/useAppMutation";
import {
  queryKeys,
  useCustomerDetailQuery,
  useDealsQuery,
  useNotesQuery,
  useTasksQuery,
  useTicketsQuery,
  useTransactionsQuery,
  useUsersQuery,
} from "@/hooks/useNexcrmQueries";
import {
  cn,
  formatCurrency,
  formatCurrencyCompact,
  formatCustomerType,
  formatDate,
  formatDealStage,
  formatNumberCompact,
  formatPaymentMethod,
  formatTaskStatus,
  formatTicketStatus,
  getDealStageColor,
  getPriorityColor,
  timeAgo,
} from "@/lib/utils";
import { customerService } from "@/services/customerService";
import { taskService } from "@/services/taskService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const noteSchema = z.object({
  note_type: z.enum(["general", "call", "meeting", "internal"]),
  content: z.string().min(5, "Ghi chú tối thiểu 5 ký tự"),
});

const taskSchema = z.object({
  title: z.string().min(3, "Tên nhiệm vụ tối thiểu 3 ký tự"),
  description: z.string().optional(),
  assigned_to: z.string().min(1, "Vui lòng chọn người phụ trách"),
  priority: z.enum(["low", "medium", "high"]),
  due_at: z.string().optional(),
});

type NoteValues = z.infer<typeof noteSchema>;
type TaskValues = z.infer<typeof taskSchema>;

function getHistoryAccent(type: string) {
  if (type === "transaction") return "bg-emerald-500";
  if (type === "ticket") return "bg-amber-500";
  if (type === "deal") return "bg-blue-500";
  if (type === "task") return "bg-violet-500";
  return "bg-slate-400";
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customer, isLoading } = useCustomerDetailQuery(id);
  const { data: transactions = [] } = useTransactionsQuery(
    id ? { customerId: id } : undefined,
    Boolean(id),
  );
  const { data: tickets = [] } = useTicketsQuery(
    id ? { customerId: id } : undefined,
    Boolean(id),
  );
  const { data: deals = [] } = useDealsQuery(id ? { customerId: id } : undefined, Boolean(id));
  const { data: tasks = [] } = useTasksQuery(id ? { entityType: "customer", entityId: id } : undefined);
  const { data: notes = [] } = useNotesQuery(id, Boolean(id));
  const { data: users = [] } = useUsersQuery();
  const [activeTab, setActiveTab] = useState("history");
  const [reassignSearch, setReassignSearch] = useState("");

  const noteForm = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note_type: "general", content: "" },
  });
  const taskForm = useForm<TaskValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", assigned_to: "", priority: "medium", due_at: "" },
  });

  const updateCustomer = useAppMutation({
    action: "customer.update",
    errorMessage: "Không thể cập nhật hồ sơ khách hàng.",
    mutationFn: ({
      id: customerId,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof customerService.update>[1];
    }) => customerService.update(customerId, payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.customer(id ?? "") }),
      ]);
      toast.success("Đã cập nhật hồ sơ khách hàng");
    },
  });

  const addNote = useAppMutation({
    action: "customer.note.create",
    errorMessage: "Không thể thêm ghi chú.",
    mutationFn: (values: NoteValues) =>
      customerService.addNote(id ?? "", values.content, values.note_type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-notes"] });
      noteForm.reset();
      toast.success("Đã thêm ghi chú mới");
    },
  });

  const defaultAssigneeId = customer?.assigned_to ?? users[0]?.id ?? "";

  useEffect(() => {
    if (!defaultAssigneeId) {
      return;
    }

    const assignedTo = taskForm.getValues("assigned_to");
    if (!assignedTo) {
      taskForm.setValue("assigned_to", defaultAssigneeId, { shouldDirty: false });
    }
  }, [defaultAssigneeId, taskForm]);

  const addTask = useAppMutation({
    action: "customer.task.create",
    errorMessage: "Không thể tạo nhiệm vụ follow-up.",
    mutationFn: (values: TaskValues) =>
      taskService.create({
        title: values.title,
        description: values.description || "",
        entity_type: "customer",
        entity_id: id ?? "",
        assigned_to: values.assigned_to,
        priority: values.priority,
        due_at: values.due_at ? new Date(`${values.due_at}T09:00:00`).toISOString() : null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
      taskForm.reset({
        title: "",
        description: "",
        assigned_to: defaultAssigneeId,
        priority: "medium",
        due_at: "",
      });
      toast.success("Đã thêm nhiệm vụ follow-up");
    },
  });

  const customerTransactions = useMemo(() => transactions, [transactions]);
  const customerTickets = useMemo(() => tickets, [tickets]);
  const customerNotes = useMemo(
    () =>
      [...notes].sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      ),
    [notes],
  );
  const customerDeals = useMemo(
    () => deals.filter((item) => item.customer_id === customer?.id),
    [customer?.id, deals],
  );
  const customerTasks = useMemo(
    () =>
      tasks
        .filter((item) => item.entity_type === "customer" && item.entity_id === customer?.id)
        .sort(
          (left, right) =>
            new Date(right.updated_at ?? right.created_at).getTime() -
            new Date(left.updated_at ?? left.created_at).getTime(),
        ),
    [customer?.id, tasks],
  );

  const assignedUser = users.find((item) => item.id === customer?.assigned_to);
  const filteredUsers = useMemo(
    () =>
      users.filter((user) =>
        user.full_name.toLowerCase().includes(reassignSearch.toLowerCase()),
      ),
    [reassignSearch, users],
  );

  const historyItems = useMemo(() => {
    const transactionItems = customerTransactions.map((transaction) => ({
      id: transaction.id,
      type: "transaction",
      title: `Giao dịch ${transaction.invoice_code}`,
      description: `${formatCurrency(transaction.total_amount)} · ${transaction.items.map((item) => item.name).join(", ")}`,
      date: transaction.created_at,
    }));
    const ticketItems = customerTickets.map((ticket) => ({
      id: ticket.id,
      type: "ticket",
      title: `${ticket.ticket_code} · ${ticket.title}`,
      description: `Ticket ${formatTicketStatus(ticket.status)}`,
      date: ticket.created_at,
    }));
    const noteItems = customerNotes.map((note) => ({
      id: note.id,
      type: "note",
      title: `Ghi chú ${note.note_type}`,
      description: note.content,
      date: note.created_at,
    }));
    const dealItems = customerDeals.map((deal) => ({
      id: deal.id,
      type: "deal",
      title: `Cơ hội ${deal.title}`,
      description: `${formatDealStage(deal.stage)} · ${formatCurrency(deal.value)}`,
      date: deal.updated_at ?? deal.created_at,
    }));
    const taskItems = customerTasks.map((task) => ({
      id: task.id,
      type: "task",
      title: `Nhiệm vụ ${task.title}`,
      description: `${formatTaskStatus(task.status)}${task.due_at ? ` · Hạn ${formatDate(task.due_at)}` : ""}`,
      date: task.updated_at ?? task.created_at,
    }));

    return [...transactionItems, ...ticketItems, ...noteItems, ...dealItems, ...taskItems].sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
  }, [customerDeals, customerNotes, customerTasks, customerTickets, customerTransactions]);

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  if (!customer) {
    return (
      <EmptyState
        icon={StickyNote}
        title="Không tìm thấy khách hàng"
        description="Hồ sơ khách hàng này không tồn tại hoặc đã bị ẩn khỏi hệ thống."
        actionLabel="Quay lại danh sách"
        onAction={() => navigate("/customers")}
      />
    );
  }

  const activeDealsCount = customerDeals.filter((deal) => deal.stage !== "won" && deal.stage !== "lost").length;
  const openTicketsCount = customerTickets.filter((ticket) => ticket.status !== "resolved" && ticket.status !== "closed").length;
  const pendingTasksCount = customerTasks.filter((task) => task.status !== "done").length;
  const locationLabel = [customer.address, customer.province].filter(Boolean).join(", ") || "--";
  const latestActivityAt = historyItems[0]?.date ?? customer.updated_at ?? customer.created_at;

  return (
    <div className="grid gap-5 xl:grid-cols-[320px,minmax(0,1fr)]">
      <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <SectionPanel
          eyebrow="Customer record"
          title={customer.full_name}
          // description={`${customer.customer_code} · ${formatCustomerType(customer.customer_type)}`}
          contentClassName="space-y-4"
        >
          <div className="flex items-start gap-4">
            <CustomerAvatar name={customer.full_name} type={customer.customer_type} className="size-16 text-lg" />
            <div className="min-w-0 space-y-2">
              <div className="text-xs text-muted-foreground">Cập nhật {timeAgo(customer.updated_at ?? customer.created_at)}</div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge
                  label={formatCustomerType(customer.customer_type)}
                  className="bg-muted text-foreground ring-border"
                  dotClassName="bg-primary"
                />
                {customer.tags.slice(0, 3).map((tag) => (
                  <StatusBadge
                    key={tag}
                    label={tag}
                    className="bg-muted/70 text-muted-foreground ring-border"
                    dotClassName="bg-primary/70"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/70 bg-muted/25 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Lifetime value
            </div>
            <div className="mt-2 font-display text-[30px] font-semibold tracking-[-0.04em] text-foreground">
              {formatCurrencyCompact(customer.total_spent)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Số đơn</div>
                <div className="font-semibold text-foreground">{customer.total_orders}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Mua gần nhất</div>
                <div className="font-semibold text-foreground">{timeAgo(customer.last_order_at)}</div>
              </div>
            </div>
          </div>

          <InspectorList
            items={[
              { label: "Điện thoại", value: customer.phone || "--" },
              { label: "Email", value: customer.email || "--" },
              { label: "Địa chỉ", value: locationLabel },
              { label: "Nguồn", value: customer.source || "--" },
              { label: "Lần chạm gần nhất", value: timeAgo(latestActivityAt) },
            ]}
          />
        </SectionPanel>

        <SectionPanel
          title="Điều phối hồ sơ"
          // description="Giữ người phụ trách và thao tác chính trong cùng một khối để xử lý nhanh."
          contentClassName="space-y-4"
        >
          {updateCustomer.actionError ? (
            <ActionErrorAlert
              error={updateCustomer.actionError}
              onDismiss={updateCustomer.clearActionError}
              onRetry={updateCustomer.canRetry ? () => void updateCustomer.retryLast() : undefined}
            />
          ) : null}

          <FormSection
            title="Phụ trách"
            // description={assignedUser ? `${assignedUser.full_name} · ${assignedUser.department}` : "Chưa gán người phụ trách"}
          >
            <FormField label="Tìm theo tên">
              <Input
                value={reassignSearch}
                onChange={(event) => setReassignSearch(event.target.value)}
                placeholder="Tìm người phụ trách…"
                aria-label="Tìm người phụ trách"
              />
            </FormField>
            <FormField label="Người phụ trách">
              <Select
                value={customer.assigned_to}
                onChange={(event) => {
                  updateCustomer.mutate({ id: id ?? "", payload: { assigned_to: event.target.value } });
                }}
              >
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} · {user.department}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Phân loại khách hàng">
              <Select
                value={customer.customer_type}
                onChange={(event) =>
                  updateCustomer.mutate({
                    id: id ?? "",
                    payload: { customer_type: event.target.value as typeof customer.customer_type },
                  })
                }
              >
                <option value="new">Mới</option>
                <option value="potential">Tiềm năng</option>
                <option value="loyal">Thân thiết</option>
                <option value="vip">VIP</option>
                <option value="inactive">Không hoạt động</option>
              </Select>
            </FormField>
          </FormSection>

          <div className="grid gap-2">
            <Button variant="secondary" onClick={() => navigate(`/tickets?customerId=${customer.id}&create=1`)}>
              <Ticket className="size-4" />
              Tạo Ticket
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/transactions?customerId=${customer.id}&create=1`)}>
              <CreditCard className="size-4" />
              Thêm Giao Dịch
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/pipeline?customerId=${customer.id}&create=1`)}>
              <Target className="size-4" />
              Tạo Cơ Hội
            </Button>
            <Button variant="ghost" onClick={() => setActiveTab("notes")}>
              <StickyNote className="size-4" />
              Mở Ghi Chú
            </Button>
          </div>
        </SectionPanel>
      </aside>

      <main className="min-w-0 space-y-5">
        <PageHeader
          title="Chi Tiết Khách Hàng"
          // subtitle={`${formatCustomerType(customer.customer_type)} · Hồ sơ đủ dữ liệu để sales và CSKH thao tác nhanh trong một màn.`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setActiveTab("tasks")}>
                <Plus className="size-4" />
                Follow-up
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setActiveTab("transactions")}>
                <CreditCard className="size-4" />
                Giao dịch
              </Button>
              <Button size="sm" onClick={() => navigate(`/pipeline?customerId=${customer.id}&create=1`)}>
                <Target className="size-4" />
                Tạo Cơ Hội
              </Button>
            </div>
          }
        />

        <MetricStrip>
          <MetricStripItem label="Doanh thu" value={formatCurrencyCompact(customer.total_spent)} helper="Tổng chi tiêu của hồ sơ này." />
          <MetricStripItem label="Đơn hàng" value={formatNumberCompact(customer.total_orders)} helper={`Lần mua gần nhất ${timeAgo(customer.last_order_at)}.`} />
          <MetricStripItem label="Cơ hội mở" value={formatNumberCompact(activeDealsCount)} helper="Lead đang còn trong pipeline." />
          <MetricStripItem label="Ticket mở" value={formatNumberCompact(openTicketsCount)} helper="Case cần xử lý hoặc theo dõi." />
          <MetricStripItem label="Task chờ" value={formatNumberCompact(pendingTasksCount)} helper="Follow-up chưa hoàn tất." />
        </MetricStrip>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="history">Lịch Sử</TabsTrigger>
            <TabsTrigger value="deals">Cơ Hội</TabsTrigger>
            <TabsTrigger value="tasks">Nhiệm Vụ</TabsTrigger>
            <TabsTrigger value="transactions">Giao Dịch</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="notes">Ghi Chú</TabsTrigger>
          </TabsList>

          <TabsContent value="history" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),320px]">
              <SectionPanel
                title="Timeline hoạt động"
                // description="Mọi tương tác được dồn vào cùng một trục để scan nhanh các mốc quan trọng."
            contentClassName="p-0 lg:p-0"
              >
                {historyItems.length ? (
                  <div className="divide-y divide-border/70">
                    {historyItems.map((item) => (
                      <div key={item.id} className="flex gap-4 px-4 py-3">
                        <div className={cn("mt-1.5 size-2.5 rounded-full", getHistoryAccent(item.type))} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                            <div className="text-xs text-muted-foreground">{timeAgo(item.date)}</div>
                          </div>
                          <div className="text-sm text-muted-foreground">{item.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <EmptyState
                      icon={StickyNote}
                      title="Chưa có hoạt động"
                      description="Hồ sơ này chưa có giao dịch, cơ hội hoặc ghi chú để hiển thị trên timeline."
                      className="min-h-[220px] border-dashed bg-transparent shadow-none"
                    />
                  </div>
                )}
              </SectionPanel>

              <div className="space-y-5">
                <SectionPanel
                  title="Tóm tắt vận hành"
                  // description="Những điểm cần chú ý ngay mà không phải mở thêm tab."
                >
                  <InspectorList
                    items={[
                      { label: "Người phụ trách", value: assignedUser?.full_name ?? "--" },
                      { label: "Ticket đang mở", value: String(openTicketsCount) },
                      { label: "Task cần làm", value: String(pendingTasksCount) },
                      { label: "Cơ hội đang chạy", value: String(activeDealsCount) },
                    ]}
                  />
                </SectionPanel>

                <SectionPanel
                  title="Ghi chú gần nhất"
                  // description="Snapshot của các ghi chú mới nhất để hạn chế đổi ngữ cảnh."
                  contentClassName="space-y-3"
                >
                  {customerNotes.slice(0, 3).length ? (
                    customerNotes.slice(0, 3).map((note) => (
                      <div key={note.id} className="rounded-lg border border-border/70 bg-muted/25 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge
                            label={note.note_type}
                            className="bg-muted text-muted-foreground ring-border"
                            dotClassName="bg-primary"
                          />
                          <div className="text-xs text-muted-foreground">{timeAgo(note.created_at)}</div>
                        </div>
                        <div className="mt-2 text-sm text-foreground">{note.content}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Chưa có ghi chú nào cho hồ sơ này.</div>
                  )}
                </SectionPanel>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="deals">
            {customerDeals.length ? (
              <DataTableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cơ hội</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Giá trị</TableHead>
                      <TableHead>Khả năng</TableHead>
                      <TableHead>Dự kiến chốt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerDeals.map((deal) => (
                      <TableRow key={deal.id}>
                        <TableCell>
                          <div className="font-medium">{deal.title}</div>
                          <div className="text-xs text-muted-foreground">{deal.description || "Chưa có mô tả"}</div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={formatDealStage(deal.stage)}
                            className={getDealStageColor(deal.stage)}
                            dotClassName="bg-current"
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(deal.value)}</TableCell>
                        <TableCell>{deal.probability}%</TableCell>
                        <TableCell>{deal.expected_close_at ? formatDate(deal.expected_close_at) : "--"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataTableShell>
            ) : (
              <EmptyState
                icon={Target}
                title="Chưa có cơ hội bán hàng"
                description="Tạo cơ hội mới để theo dõi pipeline cho khách hàng này."
                actionLabel="Tạo Cơ Hội"
                onAction={() => navigate(`/pipeline?customerId=${customer.id}&create=1`)}
              />
            )}
          </TabsContent>

          <TabsContent value="tasks" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[360px,minmax(0,1fr)]">
              <SectionPanel
                title="Tạo nhiệm vụ follow-up"
                // description="Giữ form ngắn và ưu tiên deadline, assignee, priority."
              >
                <form className="space-y-4" onSubmit={taskForm.handleSubmit((values) => addTask.mutate(values))}>
                  {addTask.actionError ? (
                    <ActionErrorAlert
                      error={addTask.actionError}
                      onDismiss={addTask.clearActionError}
                      onRetry={addTask.canRetry ? () => void addTask.retryLast() : undefined}
                    />
                  ) : null}
                  <FormSection title="Thông tin nhiệm vụ" /* description="Tạo việc mới mà không phải mở modal riêng." */>
                    <div className="grid gap-4">
                      <FormField label="Tiêu đề" error={taskForm.formState.errors.title?.message}>
                        <Input {...taskForm.register("title")} placeholder="Ví dụ: Gọi chốt lịch demo" />
                      </FormField>
                      <FormField label="Phụ trách">
                        <Select {...taskForm.register("assigned_to")}>
                          <option value="">Chọn người phụ trách</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.full_name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                      <div className="grid gap-4 md:grid-cols-2">
                        <FormField label="Ưu tiên">
                          <Select {...taskForm.register("priority")}>
                            <option value="low">Thấp</option>
                            <option value="medium">Trung bình</option>
                            <option value="high">Cao</option>
                          </Select>
                        </FormField>
                        <FormField label="Deadline">
                          <Input type="date" {...taskForm.register("due_at")} />
                        </FormField>
                      </div>
                      <FormField label="Mô tả">
                        <Textarea
                          {...taskForm.register("description")}
                          placeholder="Thông tin bổ sung cho người phụ trách"
                        />
                      </FormField>
                    </div>
                  </FormSection>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={addTask.isPending}>
                      <Plus className="size-4" />
                      {addTask.isPending ? "Đang lưu…" : "Thêm nhiệm vụ"}
                    </Button>
                  </div>
                </form>
              </SectionPanel>

              <SectionPanel
                title="Backlog nhiệm vụ"
                // description="Danh sách follow-up gọn, đủ để scan status, assignee và deadline."
            contentClassName="p-0 lg:p-0"
              >
                {customerTasks.length ? (
                  <div className="divide-y divide-border/70">
                    {customerTasks.map((task) => (
                      <div key={task.id} className="space-y-3 px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-medium text-foreground">{task.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {task.description || "Không có ghi chú thêm"}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge
                              label={formatTaskStatus(task.status)}
                              className={task.status === "done" ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25" : "bg-muted text-foreground ring-border"}
                              dotClassName="bg-current"
                            />
                            <StatusBadge
                              label={task.priority}
                              className={getPriorityColor(task.priority)}
                              dotClassName="bg-current"
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                          <div>
                            {users.find((user) => user.id === task.assigned_to)?.full_name ?? "--"} ·{" "}
                            {task.due_at ? `Hạn ${formatDate(task.due_at)}` : "Chưa có deadline"}
                          </div>
                          <div>{timeAgo(task.updated_at ?? task.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <EmptyState
                      icon={CheckCircle2}
                      title="Chưa có nhiệm vụ follow-up"
                      description="Tạo nhiệm vụ để sales hoặc CSKH bám sát cơ hội với khách hàng này."
                      className="min-h-[240px] border-dashed bg-transparent shadow-none"
                    />
                  </div>
                )}
              </SectionPanel>
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            {customerTransactions.length ? (
              <DataTableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hóa đơn</TableHead>
                      <TableHead>Ngày</TableHead>
                      <TableHead>Sản phẩm</TableHead>
                      <TableHead>Tổng</TableHead>
                      <TableHead>Thanh toán</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerTransactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell className="font-mono text-xs">{transaction.invoice_code}</TableCell>
                        <TableCell>{formatDate(transaction.created_at)}</TableCell>
                        <TableCell className="max-w-[320px] truncate">
                          {transaction.items.map((item) => item.name).join(", ")}
                        </TableCell>
                        <TableCell className="font-semibold">{formatCurrency(transaction.total_amount)}</TableCell>
                        <TableCell>{formatPaymentMethod(transaction.payment_method)}</TableCell>
                        <TableCell>{formatTicketStatus(transaction.payment_status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataTableShell>
            ) : (
              <EmptyState
                icon={CreditCard}
                title="Chưa có giao dịch"
                description="Khách hàng này chưa phát sinh giao dịch nào trong dữ liệu demo."
              />
            )}
          </TabsContent>

          <TabsContent value="tickets">
            {customerTickets.length ? (
              <DataTableShell>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Ngày tạo</TableHead>
                      <TableHead>Ưu tiên</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead className="text-right">Mở</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerTickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="font-medium">{ticket.ticket_code}</div>
                          <div className="text-xs text-muted-foreground">{ticket.title}</div>
                        </TableCell>
                        <TableCell>{formatDate(ticket.created_at)}</TableCell>
                        <TableCell>
                          <StatusBadge
                            label={ticket.priority.toUpperCase()}
                            className={getPriorityColor(ticket.priority)}
                            dotClassName="bg-current"
                          />
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={formatTicketStatus(ticket.status)}
                            className="bg-muted text-foreground ring-border"
                            dotClassName="bg-primary"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/tickets/${ticket.id}`)}>
                            Xem
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DataTableShell>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="Chưa có ticket"
                description="Khách hàng này chưa có yêu cầu hỗ trợ nào."
              />
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-5">
            <div className="grid gap-5 xl:grid-cols-[360px,minmax(0,1fr)]">
              <SectionPanel
                title="Thêm ghi chú mới"
                // description="Lưu nhanh thông tin call, meeting hoặc nội bộ ngay trên hồ sơ."
              >
                <form className="space-y-4" onSubmit={noteForm.handleSubmit((values) => addNote.mutate(values))}>
                  {addNote.actionError ? (
                    <ActionErrorAlert
                      error={addNote.actionError}
                      onDismiss={addNote.clearActionError}
                      onRetry={addNote.canRetry ? () => void addNote.retryLast() : undefined}
                    />
                  ) : null}
                  <FormSection title="Nội dung ghi chú" description="Giữ cấu trúc ngắn để đội vận hành nhập nhanh hơn.">
                    <FormField label="Loại ghi chú">
                      <Select {...noteForm.register("note_type")}>
                        <option value="general">Tổng quát</option>
                        <option value="call">Cuộc gọi</option>
                        <option value="meeting">Cuộc họp</option>
                        <option value="internal">Nội bộ</option>
                      </Select>
                    </FormField>
                    <FormField label="Nội dung" error={noteForm.formState.errors.content?.message}>
                      <Textarea {...noteForm.register("content")} placeholder="Nhập ghi chú chăm sóc khách hàng" />
                    </FormField>
                  </FormSection>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={addNote.isPending}>
                      {addNote.isPending ? "Đang lưu…" : "Thêm ghi chú"}
                    </Button>
                  </div>
                </form>
              </SectionPanel>

              <SectionPanel
                title="Sổ ghi chú"
                description="Danh sách compact để tra cứu nhanh các lần chăm sóc trước đó."
            contentClassName="p-0 lg:p-0"
              >
                {customerNotes.length ? (
                  <div className="divide-y divide-border/70">
                    {customerNotes.map((note) => (
                      <div key={note.id} className="space-y-2 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <StatusBadge
                            label={note.note_type}
                            className="bg-muted text-muted-foreground ring-border"
                            dotClassName="bg-primary"
                          />
                          <div className="text-xs text-muted-foreground">{timeAgo(note.created_at)}</div>
                        </div>
                        <div className="text-sm text-foreground">{note.content}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <EmptyState
                      icon={StickyNote}
                      title="Chưa có ghi chú"
                      description="Thêm ghi chú để lưu lại lần chăm sóc hoặc lịch sử làm việc."
                      className="min-h-[240px] border-dashed bg-transparent shadow-none"
                    />
                  </div>
                )}
              </SectionPanel>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
