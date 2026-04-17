import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Plus,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { PageHeader } from "@/components/shared/page-header";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Can } from "@/components/shared/Can";
import { useAppMutation } from "@/hooks/useAppMutation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePermission } from "@/hooks/usePermission";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useCustomersQuery, useDealsQuery, useTasksQuery, useUsersQuery } from "@/hooks/useNexcrmQueries";
import {
  cn,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
  formatDealStage,
  formatNumberCompact,
  formatTaskStatus,
  getDealStageColor,
  getPriorityColor,
} from "@/lib/utils";
import { dealService } from "@/services/dealService";
import { taskService } from "@/services/taskService";
import type { Deal, DealStage, Task } from "@/types";

const stageColumns: Array<{ label: string; value: DealStage; borderClass: string }> = [
  { label: "Tiếp cận", value: "lead", borderClass: "border-slate-500" },
  { label: "Đủ điều kiện", value: "qualified", borderClass: "border-blue-500" },
  { label: "Đề xuất", value: "proposal", borderClass: "border-amber-500" },
  { label: "Đàm phán", value: "negotiation", borderClass: "border-orange-500" },
  { label: "Thành công", value: "won", borderClass: "border-emerald-500" },
  { label: "Thất bại", value: "lost", borderClass: "border-rose-500" },
];

type StageFilter = DealStage | "all";

function parseStageFilter(raw: string | null): StageFilter {
  if (
    raw === "lead" ||
    raw === "qualified" ||
    raw === "proposal" ||
    raw === "negotiation" ||
    raw === "won" ||
    raw === "lost"
  ) {
    return raw;
  }

  return "all";
}

const dealSchema = z.object({
  title: z.string().min(3, "Tên cơ hội tối thiểu 3 ký tự"),
  customer_id: z.string().min(1, "Vui lòng chọn khách hàng"),
  owner_id: z.string().min(1, "Vui lòng chọn người phụ trách"),
  stage: z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]),
  value: z.number().min(0, "Giá trị phải lớn hơn hoặc bằng 0"),
  probability: z.number().min(0).max(100),
  expected_close_at: z.string().optional(),
  description: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(3, "Tên nhiệm vụ tối thiểu 3 ký tự"),
  description: z.string().optional(),
  assigned_to: z.string().min(1, "Vui lòng chọn người phụ trách"),
  priority: z.enum(["low", "medium", "high"]),
  due_at: z.string().optional(),
});

type DealFormValues = z.infer<typeof dealSchema>;
type TaskFormValues = z.infer<typeof taskSchema>;

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
    <label className="flex flex-col text-sm">
      <span className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="size-3" />
          {error}
        </span>
      ) : null}
    </label>
  );
}

function DealFormModal({
  open,
  onOpenChange,
  initialDeal,
  prefillCustomerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDeal?: Deal | null;
  prefillCustomerId?: string;
}) {
  const queryClient = useQueryClient();
  const { data: customers = [] } = useCustomersQuery();
  const { data: users = [] } = useUsersQuery();
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDebouncedValue(customerSearch, 150);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const isEdit = Boolean(initialDeal);
  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: "",
      customer_id: prefillCustomerId ?? "",
      owner_id: "",
      stage: "lead",
      value: 0,
      probability: 20,
      expected_close_at: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    form.reset({
      title: initialDeal?.title ?? "",
      customer_id: initialDeal?.customer_id ?? prefillCustomerId ?? "",
      owner_id: initialDeal?.owner_id ?? users[0]?.id ?? "",
      stage: initialDeal?.stage ?? "lead",
      value: initialDeal?.value ?? 0,
      probability: initialDeal?.probability ?? 20,
      expected_close_at: initialDeal?.expected_close_at?.slice(0, 10) ?? "",
      description: initialDeal?.description ?? "",
    });
  }, [form, initialDeal, open, prefillCustomerId, users]);

  const mutation = useAppMutation({
    action: isEdit ? "deal.update" : "deal.create",
    errorMessage: isEdit ? "Không thể cập nhật cơ hội." : "Không thể tạo cơ hội mới.",
    mutationFn: async (values: DealFormValues) => {
      const payload = {
        ...values,
        expected_close_at: values.expected_close_at
          ? new Date(`${values.expected_close_at}T09:00:00`).toISOString()
          : null,
        description: values.description || "",
      };

      if (isEdit && initialDeal) {
        return dealService.update(initialDeal.id, payload);
      }

      return dealService.create(payload);
    },
    onSuccess: (savedDeal) => {
      queryClient.setQueriesData<Deal[]>({ queryKey: ["deals"] }, (current = []) => {
        const existingIndex = current.findIndex((deal) => deal.id === savedDeal.id);
        if (existingIndex === -1) {
          return [savedDeal, ...current];
        }

        return current.map((deal) => (deal.id === savedDeal.id ? savedDeal : deal));
      });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      toast.success(isEdit ? "Đã cập nhật cơ hội" : "Đã tạo cơ hội mới");
      form.reset();
      onOpenChange(false);
    },
  });

  const filteredCustomers = customers.filter((customer) =>
    customer.full_name.toLowerCase().includes(deferredCustomerSearch.toLowerCase()),
  );

  const attemptClose = () => {
    if (form.formState.isDirty) {
      setShowCloseConfirm(true);
      return;
    }
    onOpenChange(false);
  };

  return (
    <>
      <Modal
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            attemptClose();
            return;
          }
          onOpenChange(nextOpen);
        }}
        title={isEdit ? "Cập nhật cơ hội" : "Tạo cơ hội mới"}
        // description="Theo dõi pipeline bán hàng theo từng giai đoạn xử lý."
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
          {mutation.actionError ? (
            <ActionErrorAlert
              error={mutation.actionError}
              onDismiss={mutation.clearActionError}
              onRetry={mutation.canRetry ? () => void mutation.retryLast() : undefined}
            />
          ) : null}
          <Field label="Tên cơ hội" error={form.formState.errors.title?.message}>
            <Input {...form.register("title")} placeholder="Ví dụ: Gia hạn gói CRM 12 tháng" />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tìm khách hàng" error={form.formState.errors.customer_id?.message}>
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
            </Field>

            <Field label="Phụ trách" error={form.formState.errors.owner_id?.message}>
              <Select {...form.register("owner_id")}>
                <option value="">Chọn người phụ trách</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} · {user.department}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Giai đoạn">
              <Select {...form.register("stage")}>
                {stageColumns.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Giá trị cơ hội">
              <Input type="number" min={0} {...form.register("value", { valueAsNumber: true })} />
            </Field>

            <Field label="Xác suất chốt (%)">
              <Input type="number" min={0} max={100} {...form.register("probability", { valueAsNumber: true })} />
            </Field>

            <Field label="Ngày dự kiến chốt">
              <Input type="date" {...form.register("expected_close_at")} />
            </Field>
          </div>

          <Field label="Mô tả">
            <Textarea {...form.register("description")} placeholder="Tóm tắt nhu cầu, ngân sách hoặc next step" />
          </Field>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={attemptClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo cơ hội"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={showCloseConfirm}
        onOpenChange={setShowCloseConfirm}
        title="Bạn có thay đổi chưa lưu"
        description="Bạn có thay đổi chưa lưu. Thoát không?"
        confirmLabel="Thoát"
        cancelLabel="Ở lại"
        confirmVariant="default"
        onConfirm={() => {
          form.reset();
          onOpenChange(false);
        }}
      />
    </>
  );
}

function TaskForm({ dealId }: { dealId: string }) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsersQuery();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      assigned_to: "",
      priority: "medium",
      due_at: "",
    },
  });

  useEffect(() => {
    const current = form.getValues();
    form.reset({
      ...current,
      assigned_to: current.assigned_to || users[0]?.id || "",
    });
  }, [form, users]);

  const createTask = useAppMutation({
    action: "deal.task.create",
    errorMessage: "Không thể tạo nhiệm vụ follow-up.",
    mutationFn: (values: TaskFormValues) =>
      taskService.create({
        title: values.title,
        description: values.description || "",
        entity_type: "deal",
        entity_id: dealId,
        assigned_to: values.assigned_to,
        priority: values.priority,
        due_at: values.due_at ? new Date(`${values.due_at}T09:00:00`).toISOString() : null,
      }),
    onSuccess: (createdTask) => {
      queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (current = []) => {
        const exists = current.some((task) => task.id === createdTask.id);
        if (exists) {
          return current.map((task) => (task.id === createdTask.id ? createdTask : task));
        }

        return [createdTask, ...current];
      });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      toast.success("Đã tạo nhiệm vụ follow-up");
      form.reset({
        title: "",
        description: "",
        assigned_to: users[0]?.id ?? "",
        priority: "medium",
        due_at: "",
      });
    },
  });

  return (
    <form className="space-y-3 rounded-2xl border border-border p-4" onSubmit={form.handleSubmit((values) => createTask.mutate(values))}>
      <div className="font-medium">Tạo nhiệm vụ mới</div>
      {createTask.actionError ? (
        <ActionErrorAlert
          error={createTask.actionError}
          onDismiss={createTask.clearActionError}
          onRetry={createTask.canRetry ? () => void createTask.retryLast() : undefined}
        />
      ) : null}
      <Field label="Tiêu đề" error={form.formState.errors.title?.message}>
        <Input {...form.register("title")} placeholder="Ví dụ: Gọi xác nhận nhu cầu" />
      </Field>
      <Field label="Mô tả">
        <Textarea {...form.register("description")} placeholder="Ghi chú ngắn cho người phụ trách" />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Phụ trách" error={form.formState.errors.assigned_to?.message}>
          <Select {...form.register("assigned_to")}>
            <option value="">Chọn người phụ trách</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ưu tiên">
          <Select {...form.register("priority")}>
            <option value="low">Thấp</option>
            <option value="medium">Trung bình</option>
            <option value="high">Cao</option>
          </Select>
        </Field>
        <Field label="Deadline">
          <Input type="date" {...form.register("due_at")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={createTask.isPending}>
          {createTask.isPending ? "Đang tạo..." : "Thêm nhiệm vụ"}
        </Button>
      </div>
    </form>
  );
}

export function DealPipelinePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canAccess } = usePermission();
  const canUpdateDeal = canAccess("deal:update");
  const canDeleteDeal = canAccess("deal:delete");
  const canDeleteTask = canAccess("task:delete");
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [ownerFilter, setOwnerFilter] = useState(() => searchParams.get("owner") ?? "all");
  const [stageFilter, setStageFilter] = useState<StageFilter>(() =>
    parseStageFilter(searchParams.get("stage")),
  );
  const deferredSearch = useDebouncedValue(search, 250);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const normalizedSearch = search.trim();

    if (normalizedSearch) {
      next.set("q", normalizedSearch);
    } else {
      next.delete("q");
    }

    if (ownerFilter !== "all") {
      next.set("owner", ownerFilter);
    } else {
      next.delete("owner");
    }

    if (stageFilter !== "all") {
      next.set("stage", stageFilter);
    } else {
      next.delete("stage");
    }

    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [ownerFilter, search, searchParams, setSearchParams, stageFilter]);

  const dealsQuery = useDealsQuery({
    ownerId: ownerFilter,
    stage: stageFilter,
  });
  const customersQuery = useCustomersQuery();
  const usersQuery = useUsersQuery();
  const tasksQuery = useTasksQuery({ entityType: "deal" });
  const deals = useMemo(() => dealsQuery.data ?? [], [dealsQuery.data]);
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const [formOpenLocal, setFormOpenLocal] = useState(false);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [deleteDealTarget, setDeleteDealTarget] = useState<Deal | null>(null);
  const [deleteTaskTarget, setDeleteTaskTarget] = useState<Task | null>(null);

  const requestedCreate = searchParams.get("create") === "1";
  const prefillCustomerId = searchParams.get("customerId") ?? "";
  const formOpen = requestedCreate || formOpenLocal;

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
      users.reduce<Record<string, (typeof users)[number]>>((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {}),
    [users],
  );

  const tasksByDealId = useMemo(
    () =>
      tasks.reduce<Record<string, Task[]>>((acc, task) => {
        if (task.entity_type !== "deal") {
          return acc;
        }

        (acc[task.entity_id] ??= []).push(task);
        return acc;
      }, {}),
    [tasks],
  );

  const filteredDeals = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();

    return deals.filter((deal) => {
      if (ownerFilter !== "all" && deal.owner_id !== ownerFilter) {
        return false;
      }

      if (stageFilter !== "all" && deal.stage !== stageFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const customer = customerMap[deal.customer_id];
      const owner = userMap[deal.owner_id];
      const haystack = [
        deal.title,
        deal.description,
        customer?.full_name,
        customer?.customer_code,
        owner?.full_name,
        formatDealStage(deal.stage),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(keyword);
    });
  }, [customerMap, deals, deferredSearch, ownerFilter, stageFilter, userMap]);

  const selectedDeal =
    filteredDeals.find((deal) => deal.id === selectedDealId) ??
    deals.find((deal) => deal.id === selectedDealId) ??
    null;

  const selectedDealTasks = useMemo(
    () => (selectedDeal?.id ? tasksByDealId[selectedDeal.id] ?? [] : []),
    [selectedDeal?.id, tasksByDealId],
  );

  const summary = useMemo(() => {
    const totalValue = filteredDeals.reduce((sum, deal) => sum + deal.value, 0);
    const wonValue = filteredDeals.filter((deal) => deal.stage === "won").reduce((sum, deal) => sum + deal.value, 0);
    const filteredDealIds = new Set(filteredDeals.map((deal) => deal.id));
    const openTasks = tasks.filter(
      (task) => task.status !== "done" && filteredDealIds.has(task.entity_id),
    ).length;
    return {
      totalValue,
      wonValue,
      dealsCount: filteredDeals.length,
      openTasks,
    };
  }, [filteredDeals, tasks]);

  const updateStage = useAppMutation({
    action: "deal.update-stage",
    errorMessage: "Không thể cập nhật giai đoạn cơ hội.",
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) => dealService.updateStage(id, stage),
    onSuccess: (updatedDeal, variables) => {
      queryClient.setQueriesData<Deal[]>({ queryKey: ["deals"] }, (current = []) =>
        current.map((deal) => (deal.id === updatedDeal.id ? updatedDeal : deal)),
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      toast.success(`Đã chuyển cơ hội sang ${formatDealStage(variables.stage)}`);
    },
  });

  const deleteDeal = useAppMutation({
    action: "deal.delete",
    errorMessage: "Không thể xóa cơ hội.",
    mutationFn: (id: string) => dealService.delete(id),
    onSuccess: (_, deletedDealId) => {
      queryClient.setQueriesData<Deal[]>({ queryKey: ["deals"] }, (current = []) =>
        current.filter((deal) => deal.id !== deletedDealId),
      );
      queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (current = []) =>
        current.filter((task) => !(task.entity_type === "deal" && task.entity_id === deletedDealId)),
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deals"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      setSelectedDealId(null);
      toast.success("Đã xóa cơ hội");
    },
  });

  const completeTask = useAppMutation({
    action: "deal.task.complete",
    errorMessage: "Không thể cập nhật nhiệm vụ.",
    mutationFn: (id: string) => taskService.complete(id),
    onSuccess: (updatedTask) => {
      queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (current = []) =>
        current.map((task) => (task.id === updatedTask.id ? updatedTask : task)),
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      toast.success("Đã đánh dấu hoàn thành nhiệm vụ");
    },
  });

  const deleteTask = useAppMutation({
    action: "deal.task.delete",
    errorMessage: "Không thể xóa nhiệm vụ.",
    mutationFn: (id: string) => taskService.delete(id),
    onSuccess: (_, deletedTaskId) => {
      queryClient.setQueriesData<Task[]>({ queryKey: ["tasks"] }, (current = []) =>
        current.filter((task) => task.id !== deletedTaskId),
      );
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      toast.success("Đã xóa nhiệm vụ");
    },
  });

  const completingTaskId = completeTask.isPending ? completeTask.variables : null;
  const deletingTaskId = deleteTask.isPending ? deleteTask.variables : null;

  if (dealsQuery.isLoading) {
    return <PageLoader panels={2} />;
  }

  if (dealsQuery.error || customersQuery.error || usersQuery.error || tasksQuery.error) {
    return (
      <PageErrorState
        title="Không thể tải phễu cơ hội bán hàng"
        description="Danh sách cơ hội, khách hàng hoặc nhiệm vụ follow-up chưa tải được. Vui lòng thử lại để đồng bộ dữ liệu mới nhất."
        onRetry={() => {
          void Promise.all([
            dealsQuery.refetch(),
            customersQuery.refetch(),
            usersQuery.refetch(),
            tasksQuery.refetch(),
          ]);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Phễu Cơ Hội Bán Hàng"
        subtitle="Quản lý cơ hội theo giai đoạn xử lý, kết hợp bảng nhiệm vụ follow-up để theo sát tiến trình chốt deal."
        actions={
          <Can roles={["super_admin", "admin", "director", "sales"]}>
            <Button
              onClick={() => {
                setEditingDeal(null);
                setFormOpenLocal(true);
              }}
            >
              <Plus className="size-4" />
              Tạo cơ hội
            </Button>
          </Can>
        }
      />

      <MetricStrip>
        <MetricStripItem label="Tổng value pipeline" value={formatCurrencyCompact(summary.totalValue)} helper={`${formatNumberCompact(summary.dealsCount)} cơ hội đang theo dõi`} />
        <MetricStripItem label="Đã chốt" value={formatCurrencyCompact(summary.wonValue)} helper="Giá trị các deal won" />
        <MetricStripItem label="Số cơ hội" value={formatNumberCompact(summary.dealsCount)} helper="Theo bộ lọc hiện tại" />
        <MetricStripItem label="Nhiệm vụ mở" value={formatNumberCompact(summary.openTasks)} helper="Follow-up chưa hoàn thành" />
      </MetricStrip>

      <StickyFilterBar>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder="Tìm theo cơ hội, khách hàng hoặc người phụ trách"
          />
        </div>
        <Select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)} className="w-[220px]">
          <option value="all">Tất cả phụ trách</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name}
            </option>
          ))}
        </Select>
        <Select
          value={stageFilter}
          onChange={(event) => setStageFilter(parseStageFilter(event.target.value))}
          className="w-[190px]"
        >
          <option value="all">Tất cả giai đoạn</option>
          {stageColumns.map((stage) => (
            <option key={stage.value} value={stage.value}>
              {stage.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          onClick={() => {
            setSearch("");
            setOwnerFilter("all");
            setStageFilter("all");
          }}
        >
          Xóa lọc
        </Button>
      </StickyFilterBar>

      {filteredDeals.length ? (
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-max gap-4 px-1">
            {stageColumns.map((column) => {
              const columnDeals = filteredDeals.filter((deal) => deal.stage === column.value);
              const columnValue = columnDeals.reduce((sum, deal) => sum + deal.value, 0);
              return (
                <Card
                  key={column.value}
                  className={`w-[280px] min-w-[280px] rounded-lg border border-border bg-muted/50 shadow-none`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!canUpdateDeal || !draggedDealId || updateStage.isPending) return;
                    updateStage.mutate({ id: draggedDealId, stage: column.value });
                    setDraggedDealId(null);
                  }}
                >
                  <CardContent className="space-y-3 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">{column.label}</div>
                        <div className="font-mono text-xs text-muted-foreground">{formatCurrencyCompact(columnValue)}</div>
                      </div>
                      <div className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">
                        {formatNumberCompact(columnDeals.length)}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {columnDeals.map((deal) => {
                        const customer = customerMap[deal.customer_id];
                        const owner = userMap[deal.owner_id];
                        const relatedTasks = tasksByDealId[deal.id] ?? [];

                        return (
                          <button
                            key={deal.id}
                            type="button"
                            draggable={canUpdateDeal}
                            onDragStart={() => {
                              if (!canUpdateDeal) return;
                              setDraggedDealId(deal.id);
                            }}
                            onClick={() => setSelectedDealId(deal.id)}
                            className={cn(
                              "w-full rounded-lg border border-border bg-card p-3.5 text-left shadow-xs transition-all duration-150 hover:-translate-y-px hover:border-[rgb(var(--border-medium-rgb))] hover:shadow-md",
                              draggedDealId === deal.id && "rotate-1 opacity-90 shadow-xl",
                            )}
                          >
                            <div className="line-clamp-2 text-sm font-medium text-foreground">{deal.title}</div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                                {(customer?.full_name ?? "?").slice(0, 1).toUpperCase()}
                              </span>
                              <span className="truncate">{customer?.full_name ?? "Khách hàng không xác định"}</span>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-sm">
                              <div className="font-mono text-sm font-semibold text-foreground">
                                {formatCurrencyCompact(deal.value)}
                              </div>
                              <div className="truncate pl-3 text-xs text-muted-foreground">{owner?.full_name ?? "--"}</div>
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <StatusBadge
                                label={formatDealStage(deal.stage)}
                                className={getDealStageColor(deal.stage)}
                                dotClassName="bg-current"
                              />
                              <span className="font-mono text-xs text-muted-foreground">{deal.probability}%</span>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{deal.expected_close_at ? formatDate(deal.expected_close_at) : "Chưa có ngày chốt"}</span>
                              <span>{formatNumberCompact(relatedTasks.filter((task) => task.status !== "done").length)} việc mở</span>
                            </div>
                          </button>
                        );
                      })}
                      {!columnDeals.length ? (
                        <div className="rounded-lg border border-dashed border-border bg-card px-3 py-4 text-center text-xs text-muted-foreground">
                          Không có cơ hội
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Target}
          title="Chưa có cơ hội phù hợp bộ lọc"
          description="Thử đổi tiêu chí tìm kiếm/lọc hoặc tạo mới cơ hội bán hàng để bắt đầu theo dõi pipeline."
          actionLabel="Tạo cơ hội"
          onAction={() => {
            setEditingDeal(null);
            setFormOpenLocal(true);
          }}
        />
      )}

      <DealFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpenLocal(open);
          if (!open) {
            setEditingDeal(null);
            clearPrefillParams();
          }
        }}
        initialDeal={editingDeal}
        prefillCustomerId={prefillCustomerId}
      />

      <Sheet
        open={Boolean(selectedDeal)}
        onOpenChange={(open) => {
          if (!open) setSelectedDealId(null);
        }}
        title={selectedDeal?.title ?? "Chi tiết cơ hội bán hàng"}
        // description={selectedDeal ? "Theo dõi thông tin chốt deal và các nhiệm vụ follow-up." : undefined}
        className="w-[min(100vw,760px)]"
        footer={
          selectedDeal ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setSelectedDealId(null)}>
                Đóng
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  disabled={!canUpdateDeal}
                  onClick={() => {
                    setEditingDeal(selectedDeal);
                    setFormOpenLocal(true);
                  }}
                >
                  Cập nhật
                </Button>
                {canDeleteDeal ? (
                  <Button variant="destructive" onClick={() => setDeleteDealTarget(selectedDeal)}>
                    <Trash2 className="size-4" />
                    Xóa cơ hội
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null
        }
      >
        {selectedDeal ? (
          <div className="space-y-5">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="font-display text-xl font-bold">{selectedDeal.title}</div>
                    <StatusBadge label={formatDealStage(selectedDeal.stage)} className={getDealStageColor(selectedDeal.stage)} dotClassName="bg-current" />
                  </div>
                </div>

                <div className="rounded-2xl bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Giá trị cơ hội</span>
                    <span className="font-display text-2xl font-bold">{formatCurrencyCompact(selectedDeal.value)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Xác suất</div>
                      <div className="font-semibold">{selectedDeal.probability}%</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ngày chốt dự kiến</div>
                      <div className="font-semibold">{selectedDeal.expected_close_at ? formatDate(selectedDeal.expected_close_at) : "--"}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <BriefcaseBusiness className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Khách hàng</div>
                      <button type="button" className="font-medium hover:text-primary" onClick={() => navigate(`/customers/${selectedDeal.customer_id}`)}>
                        {customerMap[selectedDeal.customer_id]?.full_name ?? "--"}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CircleDot className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Người phụ trách</div>
                      <div className="font-medium">{userMap[selectedDeal.owner_id]?.full_name ?? "--"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 size-4 text-muted-foreground" />
                    <div>
                      <div className="text-muted-foreground">Tạo lúc</div>
                      <div className="font-medium">{formatDateTime(selectedDeal.created_at)}</div>
                    </div>
                  </div>
                </div>

                {selectedDeal.description ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">{selectedDeal.description}</CardContent>
                  </Card>
                ) : null}
              </CardContent>
            </Card>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-semibold">Nhiệm vụ follow-up</div>
                <div className="text-sm text-muted-foreground">{selectedDealTasks.length} nhiệm vụ</div>
              </div>

              <TaskForm dealId={selectedDeal.id} />

              {selectedDealTasks.length ? (
                <div className="space-y-3">
                  {selectedDealTasks.map((task) => (
                    <Card key={task.id}>
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium">{task.title}</div>
                            <div className="text-sm text-muted-foreground">{task.description || "Không có ghi chú thêm"}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge
                              label={formatTaskStatus(task.status)}
                              className={cn(
                                "ring-border",
                                task.status === "done"
                                  ? "bg-emerald-500/15 text-emerald-600"
                                  : task.status === "overdue"
                                    ? "bg-rose-500/15 text-rose-600"
                                    : "bg-muted text-foreground",
                              )}
                              dotClassName="bg-current"
                            />
                            <StatusBadge label={task.priority} className={getPriorityColor(task.priority)} dotClassName="bg-current" />
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                          <div>
                            {userMap[task.assigned_to]?.full_name ?? "--"} · {task.due_at ? `Hạn ${formatDate(task.due_at)}` : "Chưa có deadline"}
                          </div>
                          <div className="flex gap-2">
                            {task.status !== "done" ? (
                              <Button
                                variant="secondary"
                                onClick={() => completeTask.mutate(task.id)}
                                disabled={completingTaskId === task.id || deletingTaskId === task.id}
                              >
                                <CheckCircle2 className="size-4" />
                                Hoàn thành
                              </Button>
                            ) : null}
                            {canDeleteTask ? (
                              <Button
                                variant="ghost"
                                onClick={() => setDeleteTaskTarget(task)}
                                disabled={deletingTaskId === task.id || completingTaskId === task.id}
                              >
                                <Trash2 className="size-4 text-rose-500" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={CheckCircle2}
                  title="Chưa có nhiệm vụ follow-up"
                  description="Tạo nhiệm vụ để giao việc cho sales hoặc CSKH theo cơ hội này."
                />
              )}
            </div>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleteDealTarget) && canDeleteDeal}
        onOpenChange={(open) => {
          if (!open) setDeleteDealTarget(null);
        }}
        title={`Xóa cơ hội ${deleteDealTarget?.title ?? ""}?`}
        description="Cơ hội sẽ bị xóa khỏi pipeline. Các follow-up liên quan cần được kiểm tra lại."
        confirmLabel="Xóa cơ hội"
        onConfirm={() => {
          if (!canDeleteDeal) {
            toast.error("Bạn không có quyền xóa cơ hội.");
            return;
          }
          if (deleteDealTarget) {
            deleteDeal.mutate(deleteDealTarget.id);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTaskTarget) && canDeleteTask}
        onOpenChange={(open) => {
          if (!open) setDeleteTaskTarget(null);
        }}
        title={`Xóa nhiệm vụ ${deleteTaskTarget?.title ?? ""}?`}
        description="Nhiệm vụ follow-up này sẽ bị xóa khỏi hệ thống."
        confirmLabel="Xóa nhiệm vụ"
        onConfirm={() => {
          if (!canDeleteTask) {
            toast.error("Bạn không có quyền xóa nhiệm vụ.");
            return;
          }
          if (deleteTaskTarget) {
            deleteTask.mutate(deleteTaskTarget.id);
          }
        }}
      />
    </div>
  );
}
