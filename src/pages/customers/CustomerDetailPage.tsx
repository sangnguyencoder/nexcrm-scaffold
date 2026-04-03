import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  StickyNote,
  Target,
  Ticket,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  formatCurrency,
  formatCustomerType,
  formatDate,
  formatDealStage,
  formatPaymentMethod,
  formatTaskStatus,
  formatTicketStatus,
  getDealStageColor,
  getPriorityColor,
  timeAgo,
} from "@/lib/utils";
import { customerService } from "@/services/customerService";
import { getAppErrorMessage } from "@/services/shared";
import { taskService } from "@/services/taskService";

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
  const { data: deals = [] } = useDealsQuery(id ? { customerId: id } : undefined);
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

  const updateCustomer = useMutation({
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
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể cập nhật hồ sơ khách hàng."));
    },
  });

  const addNote = useMutation({
    mutationFn: (values: NoteValues) =>
      customerService.addNote(id ?? "", values.content, values.note_type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customer-notes"] });
      noteForm.reset();
      toast.success("Đã thêm ghi chú mới");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể thêm ghi chú."));
    },
  });

  useEffect(() => {
    const current = taskForm.getValues();
    taskForm.reset({
      ...current,
      assigned_to: current.assigned_to || customer?.assigned_to || users[0]?.id || "",
    });
  }, [customer?.assigned_to, taskForm, users]);

  const addTask = useMutation({
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
        assigned_to: customer?.assigned_to ?? users[0]?.id ?? "",
        priority: "medium",
        due_at: "",
      });
      toast.success("Đã thêm nhiệm vụ follow-up");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể tạo nhiệm vụ follow-up."));
    },
  });

  const customerTransactions = useMemo(() => transactions, [transactions]);
  const customerTickets = useMemo(() => tickets, [tickets]);
  const customerNotes = useMemo(() => notes, [notes]);
  const customerDeals = useMemo(
    () => deals.filter((item) => item.customer_id === customer?.id),
    [customer?.id, deals],
  );
  const customerTasks = useMemo(
    () => tasks.filter((item) => item.entity_type === "customer" && item.entity_id === customer?.id),
    [customer?.id, tasks],
  );
  const assignedUser = users.find((item) => item.id === customer?.assigned_to);
  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(reassignSearch.toLowerCase()),
  );

  const historyItems = useMemo(() => {
    const transactionItems = customerTransactions.map((transaction) => ({
      id: transaction.id,
      type: "transaction",
      title: `Giao dịch ${transaction.invoice_code}`,
      description: `${formatCurrency(transaction.total_amount)} · ${transaction.items
        .map((item) => item.name)
        .join(", ")}`,
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
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
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

  return (
    <div className="grid gap-6 xl:grid-cols-[360px,minmax(0,1fr)]">
      <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex items-start gap-4">
              <CustomerAvatar name={customer.full_name} type={customer.customer_type} className="size-16 text-lg" />
              <div className="space-y-2">
                <div className="font-display text-2xl font-bold">{customer.full_name}</div>
                <div className="inline-flex rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
                  {customer.customer_code}
                </div>
              </div>
            </div>

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

            <div className="grid gap-3 rounded-2xl bg-muted/40 p-4">
              <div>
                <div className="text-sm text-muted-foreground">Tổng chi tiêu</div>
                <div className="font-display text-2xl font-bold">
                  {formatCurrency(customer.total_spent)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Số đơn</div>
                  <div className="font-semibold">{customer.total_orders}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Lần mua cuối</div>
                  <div className="font-semibold">{timeAgo(customer.last_order_at)}</div>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <InfoRow icon={Phone} label="Số điện thoại" value={customer.phone || "--"} />
              <InfoRow icon={Mail} label="Email" value={customer.email || "--"} />
              <InfoRow icon={MapPin} label="Địa chỉ" value={`${customer.address}, ${customer.province}`} />
            </div>

            <div className="space-y-3 rounded-2xl border border-border p-4">
              <div className="text-sm font-medium">Phụ trách</div>
              <div className="text-sm text-muted-foreground">
                {assignedUser?.full_name ?? "Chưa gán người phụ trách"}
              </div>
              <InputSearch value={reassignSearch} onChange={setReassignSearch} />
              <Select
                value={customer.assigned_to}
                onChange={(event) => {
                  updateCustomer.mutate({ id: id ?? "", payload: { assigned_to: event.target.value } });
                  toast.success("Đã cập nhật người phụ trách");
                }}
              >
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} · {user.department}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <StatusBadge
                  key={tag}
                  label={tag}
                  className="bg-muted text-muted-foreground ring-border"
                  dotClassName="bg-primary/70"
                />
              ))}
            </div>

            <div className="grid gap-3">
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
              <Button variant="secondary" onClick={() => setActiveTab("notes")}>
                <StickyNote className="size-4" />
                Ghi Chú
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <PageHeader
          title="Chi Tiết Khách Hàng"
          subtitle={`${formatCustomerType(customer.customer_type)} · Cập nhật ${timeAgo(customer.updated_at ?? customer.created_at)}`}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="history">Lịch Sử</TabsTrigger>
            <TabsTrigger value="deals">Cơ Hội</TabsTrigger>
            <TabsTrigger value="tasks">Nhiệm Vụ</TabsTrigger>
            <TabsTrigger value="transactions">Giao Dịch</TabsTrigger>
            <TabsTrigger value="tickets">Tickets</TabsTrigger>
            <TabsTrigger value="notes">Ghi Chú</TabsTrigger>
          </TabsList>

          <TabsContent value="history">
            <Card>
              <CardContent className="space-y-5 p-6">
                {historyItems.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="mt-1 size-3 rounded-full bg-primary" />
                    <div className="space-y-1">
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-muted-foreground">{item.description}</div>
                      <div className="text-xs text-muted-foreground">{timeAgo(item.date)}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals">
            {customerDeals.length ? (
              <div className="space-y-4">
                {customerDeals.map((deal) => (
                  <Card key={deal.id}>
                    <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">{deal.title}</div>
                        <div className="text-sm text-muted-foreground">
                          Dự kiến chốt {deal.expected_close_at ? formatDate(deal.expected_close_at) : "--"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          label={formatDealStage(deal.stage)}
                          className={getDealStageColor(deal.stage)}
                          dotClassName="bg-current"
                        />
                        <StatusBadge
                          label={formatCurrency(deal.value)}
                          className="bg-muted text-foreground ring-border"
                          dotClassName="bg-primary"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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

          <TabsContent value="tasks">
            <div className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Tạo nhiệm vụ follow-up</CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={taskForm.handleSubmit((values) => addTask.mutate(values))}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium">Tiêu đề</span>
                        <input
                          {...taskForm.register("title")}
                          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                          placeholder="Ví dụ: Gọi chốt lịch demo"
                        />
                        {taskForm.formState.errors.title ? (
                          <span className="text-xs text-rose-500">{taskForm.formState.errors.title.message}</span>
                        ) : null}
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium">Phụ trách</span>
                        <Select {...taskForm.register("assigned_to")}>
                          <option value="">Chọn người phụ trách</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.full_name}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium">Ưu tiên</span>
                        <Select {...taskForm.register("priority")}>
                          <option value="low">Thấp</option>
                          <option value="medium">Trung bình</option>
                          <option value="high">Cao</option>
                        </Select>
                      </label>
                      <label className="flex flex-col gap-2 text-sm">
                        <span className="font-medium">Deadline</span>
                        <input
                          type="date"
                          {...taskForm.register("due_at")}
                          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-2 text-sm">
                      <span className="font-medium">Mô tả</span>
                      <Textarea {...taskForm.register("description")} placeholder="Thông tin bổ sung cho người phụ trách" />
                    </label>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={addTask.isPending}>
                        <Plus className="size-4" />
                        {addTask.isPending ? "Đang lưu..." : "Thêm nhiệm vụ"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              {customerTasks.length ? (
                <div className="space-y-3">
                  {customerTasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="space-y-3 p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium">{task.title}</div>
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
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div>
                            {users.find((user) => user.id === task.assigned_to)?.full_name ?? "--"} ·{" "}
                            {task.due_at ? `Hạn ${formatDate(task.due_at)}` : "Chưa có deadline"}
                          </div>
                          <div>{timeAgo(task.updated_at ?? task.created_at)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Chưa có nhiệm vụ follow-up"
                  description="Tạo nhiệm vụ để sales hoặc CSKH bám sát cơ hội với khách hàng này."
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="transactions">
            {customerTransactions.length ? (
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
                      <TableCell className="font-mono">{transaction.invoice_code}</TableCell>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
                      <TableCell>{transaction.items.map((item) => item.name).join(", ")}</TableCell>
                      <TableCell className="font-semibold">
                        {formatCurrency(transaction.total_amount)}
                      </TableCell>
                      <TableCell>{formatPaymentMethod(transaction.payment_method)}</TableCell>
                      <TableCell>{formatTicketStatus(transaction.payment_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              <div className="space-y-4">
                {customerTickets.map((ticket) => (
                  <Card key={ticket.id}>
                    <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {ticket.ticket_code} · {ticket.title}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatDate(ticket.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          label={ticket.priority.toUpperCase()}
                          className={getPriorityColor(ticket.priority)}
                          dotClassName="bg-current"
                        />
                        <StatusBadge
                          label={formatTicketStatus(ticket.status)}
                          className="bg-muted text-foreground ring-border"
                          dotClassName="bg-primary"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="Chưa có ticket"
                description="Khách hàng này chưa có yêu cầu hỗ trợ nào."
              />
            )}
          </TabsContent>

          <TabsContent value="notes">
            <div className="grid gap-5">
              <Card>
                <CardHeader>
                  <CardTitle>Thêm ghi chú mới</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={noteForm.handleSubmit((values) => addNote.mutate(values))}
                  >
                    <Select {...noteForm.register("note_type")}>
                      <option value="general">Tổng quát</option>
                      <option value="call">Cuộc gọi</option>
                      <option value="meeting">Cuộc họp</option>
                      <option value="internal">Nội bộ</option>
                    </Select>
                    <Textarea {...noteForm.register("content")} placeholder="Nhập ghi chú chăm sóc khách hàng" />
                    {noteForm.formState.errors.content ? (
                      <div className="text-sm text-rose-500">
                        {noteForm.formState.errors.content.message}
                      </div>
                    ) : null}
                    <div className="flex justify-end">
                      <Button type="submit" disabled={addNote.isPending}>
                        {addNote.isPending ? "Đang lưu..." : "Thêm ghi chú"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
              {customerNotes.length ? (
                <div className="space-y-3">
                  {customerNotes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="space-y-2 p-5">
                        <div className="flex items-center justify-between">
                          <StatusBadge
                            label={note.note_type}
                            className="bg-muted text-muted-foreground ring-border"
                            dotClassName="bg-primary"
                          />
                          <div className="text-xs text-muted-foreground">
                            {timeAgo(note.created_at)}
                          </div>
                        </div>
                        <div className="text-sm text-foreground">{note.content}</div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={StickyNote}
                  title="Chưa có ghi chú"
                  description="Thêm ghi chú để lưu lại lần chăm sóc hoặc lịch sử làm việc."
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InputSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Tìm người phụ trách"
      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
    />
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 text-muted-foreground" />
      <div>
        <div className="text-muted-foreground">{label}</div>
        <div className="font-medium">{value}</div>
      </div>
    </div>
  );
}
