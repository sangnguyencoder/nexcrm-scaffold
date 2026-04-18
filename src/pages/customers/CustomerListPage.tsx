import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Eye,
  Pencil,
  RotateCcw,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { DatePicker } from "@/components/shared/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { PageHeader } from "@/components/shared/page-header";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { UserSelect } from "@/components/shared/user-select";
import { useAppMutation } from "@/hooks/useAppMutation";
import { usePermission } from "@/hooks/usePermission";
import { useAuthStore } from "@/store/authStore";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompactPagination } from "@/components/shared/compact-pagination";
import { Checkbox } from "@/components/ui/checkbox";
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
import { queryKeys, useCustomersQuery, useNotesQuery, useUsersQuery } from "@/hooks/useNexcrmQueries";
import {
  cn,
  formatCurrencyCompact,
  formatCustomerType,
  formatDate,
  formatDateInputValue,
  formatRole,
  timeAgo,
  toSlug,
} from "@/lib/utils";
import { customerService } from "@/services/customerService";
import { getAppErrorMessage } from "@/services/shared";
import { preloadRoutePath } from "@/routes/route-modules";
import type { Customer } from "@/types";

const customerSchema = z.object({
  full_name: z
    .string()
    .min(2, "Họ tên tối thiểu 2 ký tự")
    .max(100, "Họ tên tối đa 100 ký tự"),
  phone: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^(0|\+84)[3-9]\d{8}$/.test(value), {
      message: "Số điện thoại không hợp lệ",
    }),
  email: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || z.string().email().safeParse(value).success, {
      message: "Email không hợp lệ",
    }),
  date_of_birth: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Ngày sinh không hợp lệ",
    }),
  customer_type: z.enum(["new", "potential", "loyal", "vip", "inactive"]),
  source: z.enum(["direct", "marketing", "referral", "pos", "online", "other"]),
  address: z.string().optional(),
  province: z.string().optional(),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

const chipConfig: Array<{
  label: string;
  value: Customer["customer_type"] | "all";
}> = [
  { label: "Tất cả", value: "all" },
  { label: "VIP", value: "vip" },
  { label: "Thân thiết", value: "loyal" },
  { label: "Tiềm năng", value: "potential" },
  { label: "Mới", value: "new" },
];

function normalizeSource(source?: Customer["source"]) {
  return source && source !== "other" ? source : "direct";
}

function normalizeImportHeader(value: string) {
  return toSlug(value).replace(/[^a-z0-9]/g, "");
}

function normalizeImportDate(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const slashDateMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (slashDateMatch) {
    const [, day, month, year] = slashDateMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateInputValue(parsed);
  }

  return "";
}

const maxBirthday = formatDateInputValue(new Date());

type CustomerSortKey =
  | "full_name"
  | "contact"
  | "customer_type"
  | "assigned_to"
  | "total_spent"
  | "total_orders"
  | "activity_at";

const customerTypeRank: Record<Customer["customer_type"], number> = {
  vip: 5,
  loyal: 4,
  potential: 3,
  new: 2,
  inactive: 1,
};

function normalizeSortText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function mapImportedCustomerType(value: string): Customer["customer_type"] {
  const normalized = normalizeImportHeader(value);

  if (["vip"].includes(normalized)) return "vip";
  if (["loyal", "thanthiet"].includes(normalized)) return "loyal";
  if (["potential", "tiemnang"].includes(normalized)) return "potential";
  if (["inactive", "khonghoatdong"].includes(normalized)) return "inactive";
  return "new";
}

function mapImportedSource(value: string): Customer["source"] {
  const normalized = normalizeImportHeader(value);

  if (["marketing"].includes(normalized)) return "marketing";
  if (["referral", "gioithieu"].includes(normalized)) return "referral";
  if (["pos"].includes(normalized)) return "pos";
  if (["online"].includes(normalized)) return "online";
  return "direct";
}

async function loadSpreadsheetModule() {
  return import("xlsx");
}

function CustomerFormModal({
  open,
  onOpenChange,
  initialCustomer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCustomer?: Customer | null;
}) {
  const queryClient = useQueryClient();
  const { data: users = [] } = useUsersQuery();
  const currentUserId = useAuthStore((state) => state.profile?.id ?? state.user?.id ?? "");
  const { data: existingNotes = [] } = useNotesQuery(
    initialCustomer?.id,
    Boolean(open && initialCustomer?.id),
  );
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const isEdit = Boolean(initialCustomer);
  const latestInteractionNote = useMemo(
    () => existingNotes[0]?.content?.trim() ?? "",
    [existingNotes],
  );
  const defaultAssigneeId = currentUserId || "";
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      date_of_birth: "",
      customer_type: "new",
      source: "direct",
      address: "",
      province: "",
      assigned_to: defaultAssigneeId,
      notes: "",
    },
  });
  const watchedBirthDate = useWatch({ control: form.control, name: "date_of_birth" });
  const watchedAssignedTo = useWatch({ control: form.control, name: "assigned_to" });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: initialCustomer?.full_name ?? "",
        phone: initialCustomer?.phone ?? "",
        email: initialCustomer?.email ?? "",
        date_of_birth: initialCustomer?.date_of_birth ?? "",
        customer_type: initialCustomer?.customer_type ?? "new",
        source: normalizeSource(initialCustomer?.source),
        address: initialCustomer?.address ?? "",
        province: initialCustomer?.province ?? "",
        assigned_to: initialCustomer?.assigned_to ?? defaultAssigneeId,
        notes: "",
      });
    }
  }, [defaultAssigneeId, form, initialCustomer, open]);

  useEffect(() => {
    if (!open || !isEdit || !latestInteractionNote) {
      return;
    }

    if ((form.getValues("notes") ?? "").trim()) {
      return;
    }

    form.setValue("notes", latestInteractionNote, { shouldDirty: false });
  }, [form, isEdit, latestInteractionNote, open]);

  const mutation = useAppMutation({
    action: isEdit ? "customer.update" : "customer.create",
    errorMessage: isEdit ? "Không thể cập nhật khách hàng." : "Không thể tạo khách hàng.",
    mutationFn: async (values: CustomerFormValues) => {
      if (isEdit && initialCustomer) {
        const updatedCustomer = await customerService.update(initialCustomer.id, values);
        const normalizedNote = values.notes?.trim() ?? "";

        if (normalizedNote && normalizedNote !== latestInteractionNote) {
          try {
            await customerService.addNote(initialCustomer.id, normalizedNote, "general");
          } catch (error) {
            toast.warning(
              getAppErrorMessage(error, "Đã lưu hồ sơ nhưng chưa lưu được ghi chú tương tác."),
            );
          }
        }

        return updatedCustomer;
      }

      return customerService.create({
        ...values,
        date_of_birth: values.date_of_birth || null,
        phone: values.phone || "",
        email: values.email || "",
        address: values.address || "",
        province: values.province || "",
        assigned_to: values.assigned_to || undefined,
        notes: values.notes || "",
        tags: [],
      });
    },
    onSuccess: (savedCustomer) => {
      queryClient.setQueriesData<Customer[]>({ queryKey: ["customers"] }, (current = []) => {
        const existingIndex = current.findIndex((item) => item.id === savedCustomer.id);
        if (existingIndex === -1) {
          return [savedCustomer, ...current];
        }

        return current.map((item) => (item.id === savedCustomer.id ? savedCustomer : item));
      });
      queryClient.setQueryData(queryKeys.customer(savedCustomer.id), savedCustomer);
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"], refetchType: "active" }),
        isEdit && initialCustomer?.id
          ? queryClient.invalidateQueries({
              queryKey: queryKeys.notes({ customerId: initialCustomer.id }),
              refetchType: "active",
            })
          : Promise.resolve(),
      ]);
      toast.success(isEdit ? "Đã cập nhật khách hàng" : "Đã thêm khách hàng mới");
      onOpenChange(false);
    },
  });

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
        title={isEdit ? "Cập nhật khách hàng" : "Thêm Khách Hàng"}
        description="" //Lưu hồ sơ khách hàng trực tiếp vào dữ liệu demo của NexCRM.
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          {mutation.actionError ? (
            <ActionErrorAlert
              error={mutation.actionError}
              onDismiss={mutation.clearActionError}
              onRetry={mutation.canRetry ? () => void mutation.retryLast() : undefined}
            />
          ) : null}
          <FormSection title="Thông tin khách hàng" description="">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Họ và tên" error={form.formState.errors.full_name?.message}>
                <Input {...form.register("full_name")} placeholder="Nhập họ tên khách hàng" />
              </FormField>
              <FormField label="Số điện thoại" error={form.formState.errors.phone?.message}>
                <Input {...form.register("phone")} placeholder="090xxxxxxx" />
              </FormField>
              <FormField label="Email" error={form.formState.errors.email?.message}>
                <Input {...form.register("email")} placeholder="email@domain.vn" />
              </FormField>
              <FormField label="Ngày sinh nhật" error={form.formState.errors.date_of_birth?.message}>
                <DatePicker
                  value={watchedBirthDate}
                  onChange={(nextValue) =>
                    form.setValue("date_of_birth", nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  max={maxBirthday}
                  placeholder="Chọn ngày sinh"
                />
              </FormField>
              <FormField label="Phân loại" error={form.formState.errors.customer_type?.message}>
                <Select {...form.register("customer_type")}>
                  <option value="new">Mới</option>
                  <option value="potential">Tiềm năng</option>
                  <option value="loyal">Thân thiết</option>
                  <option value="vip">VIP</option>
                  <option value="inactive">Không hoạt động</option>
                </Select>
              </FormField>
              <FormField label="Nguồn">
                <Select {...form.register("source")}>
                  <option value="direct">Trực tiếp</option>
                  <option value="marketing">Marketing</option>
                  <option value="referral">Giới thiệu</option>
                  <option value="pos">POS</option>
                  <option value="online">Online</option>
                  <option value="other">Khác</option>
                </Select>
              </FormField>
              <FormField label="Phụ trách">
                <UserSelect
                  value={watchedAssignedTo}
                  onValueChange={(nextValue) =>
                    form.setValue("assigned_to", nextValue, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  users={users}
                  placeholder="Chọn người phụ trách"
                />
              </FormField>
            </div>
          </FormSection>
          <FormSection title="Thông tin bổ sung" description="">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Địa chỉ">
                <Input {...form.register("address")} placeholder="Số nhà, đường, quận/huyện" />
              </FormField>
              <FormField label="Tỉnh / Thành">
                <Input {...form.register("province")} placeholder="TP. Hồ Chí Minh" />
              </FormField>
            </div>
            <FormField
              label="Ghi chú tương tác gần nhất"
              description="Lưu nội dung mới để bổ sung lịch sử tương tác. Nhật ký chi tiết xem trong tab Ghi chú của hồ sơ."
            >
              <Textarea
                {...form.register("notes")}
                placeholder="Ví dụ: Khách muốn được liên hệ lại vào tuần sau"
              />
            </FormField>
          </FormSection>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={attemptClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo khách hàng"}
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

export function CustomerListPage() {
  const navigate = useNavigate();
  const currentUserId = useAuthStore((state) => state.profile?.id ?? state.user?.id ?? "");
  const { canAccess } = usePermission();
  const canCreateCustomer = canAccess("customer:create");
  const canUpdateCustomer = canAccess("customer:update");
  const canDeleteCustomer = canAccess("customer:delete");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [serverSearch, setServerSearch] = useState("");
  const [selectedType, setSelectedType] = useState<Customer["customer_type"] | "all">("all");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<CustomerSortKey>("activity_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const customersQuery = useCustomersQuery({
    search: serverSearch || undefined,
    includeInactive: showInactive,
  });
  const usersQuery = useUsersQuery();
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkType, setBulkType] = useState<Customer["customer_type"]>("potential");
  const [formOpenLocal, setFormOpenLocal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const requestedCreate = searchParams.get("create") === "1";
  const formOpen = (requestedCreate && canCreateCustomer) || formOpenLocal;

  const clearCreateParam = () => {
    if (!requestedCreate) return;
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  };

  const usersById = useMemo(
    () =>
      users.reduce<Record<string, (typeof users)[number]>>((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {}),
    [users],
  );

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      if (selectedType !== "all" && customer.customer_type !== selectedType) {
        return false;
      }

      if (assignedFilter !== "all" && customer.assigned_to !== assignedFilter) {
        return false;
      }

      return true;
    });
  }, [assignedFilter, customers, selectedType]);

  const sortedCustomers = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredCustomers].sort((left, right) => {
      if (sortKey === "total_spent") {
        return (left.total_spent - right.total_spent) * direction;
      }
      if (sortKey === "total_orders") {
        return (left.total_orders - right.total_orders) * direction;
      }
      if (sortKey === "customer_type") {
        return (customerTypeRank[left.customer_type] - customerTypeRank[right.customer_type]) * direction;
      }
      if (sortKey === "assigned_to") {
        return (
          normalizeSortText(usersById[left.assigned_to]?.full_name).localeCompare(
            normalizeSortText(usersById[right.assigned_to]?.full_name),
          ) * direction
        );
      }
      if (sortKey === "contact") {
        return (
          normalizeSortText(`${left.phone} ${left.email}`).localeCompare(
            normalizeSortText(`${right.phone} ${right.email}`),
          ) * direction
        );
      }
      if (sortKey === "activity_at") {
        const leftTime = new Date(left.last_order_at || left.updated_at || left.created_at).getTime();
        const rightTime = new Date(right.last_order_at || right.updated_at || right.created_at).getTime();
        return (leftTime - rightTime) * direction;
      }

      return normalizeSortText(left.full_name).localeCompare(normalizeSortText(right.full_name)) * direction;
    });
  }, [filteredCustomers, sortDirection, sortKey, usersById]);

  const chipCounts = useMemo(
    () => ({
      all: customers.length,
      vip: customers.filter((customer) => customer.customer_type === "vip").length,
      loyal: customers.filter((customer) => customer.customer_type === "loyal").length,
      potential: customers.filter((customer) => customer.customer_type === "potential").length,
      new: customers.filter((customer) => customer.customer_type === "new").length,
      inactive: customers.filter((customer) => customer.customer_type === "inactive").length,
    }),
    [customers],
  );

  useEffect(() => {
    setPage(1);
  }, [assignedFilter, serverSearch, selectedType, showInactive, sortDirection, sortKey]);

  useEffect(() => {
    if (!requestedCreate) return;
    if (!canCreateCustomer) {
      const next = new URLSearchParams(searchParams);
      next.delete("create");
      setSearchParams(next, { replace: true });
      toast.error("Bạn không có quyền tạo khách hàng.");
      return;
    }
    setEditingCustomer(null);
  }, [canCreateCustomer, requestedCreate, searchParams, setSearchParams]);

  const totalPages = Math.max(1, Math.ceil(sortedCustomers.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pagedCustomers = sortedCustomers.slice((currentPage - 1) * 10, currentPage * 10);

  const deleteMutation = useAppMutation({
    action: "customer.soft-delete",
    errorMessage: "Không thể xóa mềm khách hàng.",
    mutationFn: customerService.softDelete,
    onSuccess: (updatedCustomer) => {
      queryClient.setQueriesData<Customer[]>({ queryKey: ["customers"] }, (current = []) =>
        current.map((customer) =>
          customer.id === updatedCustomer.id ? updatedCustomer : customer,
        ),
      );
      queryClient.setQueryData(queryKeys.customer(updatedCustomer.id), updatedCustomer);
      void queryClient.invalidateQueries({ queryKey: ["customers"], refetchType: "active" });
      toast.success("Đã chuyển khách hàng sang trạng thái không hoạt động");
    },
  });

  const bulkDeleteMutation = useAppMutation({
    action: "customer.bulk-soft-delete",
    errorMessage: "Không thể cập nhật danh sách đã chọn.",
    mutationFn: customerService.softDeleteMany,
    onSuccess: (updatedCustomers) => {
      const updatedById = new Map(updatedCustomers.map((customer) => [customer.id, customer]));
      queryClient.setQueriesData<Customer[]>({ queryKey: ["customers"] }, (current = []) =>
        current.map((customer) => updatedById.get(customer.id) ?? customer),
      );
      for (const customer of updatedCustomers) {
        queryClient.setQueryData(queryKeys.customer(customer.id), customer);
      }
      void queryClient.invalidateQueries({ queryKey: ["customers"], refetchType: "active" });
      setSelectedIds([]);
      toast.success("Đã cập nhật trạng thái không hoạt động cho danh sách đã chọn");
    },
  });

  const bulkChangeTypeMutation = useAppMutation({
    action: "customer.bulk-change-type",
    errorMessage: "Không thể đổi phân loại khách hàng.",
    mutationFn: ({ ids, type }: { ids: string[]; type: Customer["customer_type"] }) =>
      customerService.bulkChangeType(ids, type),
    onSuccess: (updatedCustomers) => {
      const updatedById = new Map(updatedCustomers.map((customer) => [customer.id, customer]));
      queryClient.setQueriesData<Customer[]>({ queryKey: ["customers"] }, (current = []) =>
        current.map((customer) => updatedById.get(customer.id) ?? customer),
      );
      for (const customer of updatedCustomers) {
        queryClient.setQueryData(queryKeys.customer(customer.id), customer);
      }
      void queryClient.invalidateQueries({ queryKey: ["customers"], refetchType: "active" });
      toast.success("Đã cập nhật phân loại khách hàng");
    },
  });

  const allPageSelected =
    pagedCustomers.length > 0 && pagedCustomers.every((customer) => selectedIds.includes(customer.id));

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("asc");
  };

  const renderSortIcon = (key: CustomerSortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/70" />;
    }

    return sortDirection === "asc" ? (
      <ArrowUp className="size-3.5 text-primary" />
    ) : (
      <ArrowDown className="size-3.5 text-primary" />
    );
  };

  const handleExport = async () => {
    const rows = sortedCustomers.map((customer) => ({
      customer_code: customer.customer_code,
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      date_of_birth: customer.date_of_birth || "",
      customer_type: formatCustomerType(customer.customer_type),
      source: customer.source,
      address: customer.address,
      province: customer.province,
      assigned_to: usersById[customer.assigned_to]?.full_name ?? "",
      total_spent: customer.total_spent,
      total_orders: customer.total_orders,
      created_at: formatDate(customer.created_at),
    }));

    const XLSX = await loadSpreadsheetModule();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KhachHang");
    XLSX.writeFile(workbook, "nexcrm-khach-hang.xlsx");
    toast.success("Đã xuất danh sách khách hàng");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!canCreateCustomer) {
      toast.error("Bạn không có quyền nhập khách hàng.");
      event.target.value = "";
      return;
    }

    const file = event.target.files?.[0];
    if (!file) return;

    const loadingId = toast.loading("Đang nhập dữ liệu khách hàng...");

    try {
      const buffer = await file.arrayBuffer();
      const XLSX = await loadSpreadsheetModule();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });

      const existingPhones = new Set(customers.map((customer) => customer.phone).filter(Boolean));
      const existingEmails = new Set(customers.map((customer) => customer.email.toLowerCase()).filter(Boolean));
      let created = 0;
      let skipped = 0;

      for (const row of rows) {
        const normalizedRow = Object.entries(row).reduce<Record<string, string>>((acc, [key, value]) => {
          acc[normalizeImportHeader(key)] = String(value ?? "").trim();
          return acc;
        }, {});

        const fullName = normalizedRow.fullname || normalizedRow.hoten || normalizedRow.tenkhachhang;
        const phone = normalizedRow.phone || normalizedRow.sdt || normalizedRow.sodienthoai;
        const email = normalizedRow.email || normalizedRow.mail;

        if (!fullName || fullName.length < 2) {
          skipped += 1;
          continue;
        }

        if ((phone && existingPhones.has(phone)) || (email && existingEmails.has(email.toLowerCase()))) {
          skipped += 1;
          continue;
        }

        await customerService.create({
          full_name: fullName,
          date_of_birth: normalizeImportDate(
            normalizedRow.dateofbirth || normalizedRow.ngaysinh || normalizedRow.birthday || "",
          ),
          phone,
          email,
          customer_type: mapImportedCustomerType(normalizedRow.customertype || normalizedRow.phanloai),
          source: mapImportedSource(normalizedRow.source || normalizedRow.nguon),
          address: normalizedRow.address || normalizedRow.diachi || "",
          province: normalizedRow.province || normalizedRow.tinhthanh || "",
          assigned_to: currentUserId || undefined,
          notes: normalizedRow.notes || normalizedRow.ghichu || "",
          tags: [],
        });

        if (phone) existingPhones.add(phone);
        if (email) existingEmails.add(email.toLowerCase());
        created += 1;
      }

      void queryClient.invalidateQueries({ queryKey: ["customers"], refetchType: "active" });
      toast.dismiss(loadingId);
      toast.success(`Đã nhập ${created} khách hàng${skipped ? `, bỏ qua ${skipped} bản ghi trùng/không hợp lệ` : ""}`);
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error(error instanceof Error ? error.message : "Không thể nhập file khách hàng");
    } finally {
      event.target.value = "";
    }
  };

  if (customersQuery.isLoading) {
    return <PageLoader panels={2} />;
  }

  if (customersQuery.error || usersQuery.error) {
    return (
      <PageErrorState
        title="Không thể tải danh sách khách hàng"
        description={getAppErrorMessage(
          customersQuery.error ?? usersQuery.error,
          "Danh sách khách hàng hoặc người phụ trách chưa tải được. Vui lòng thử lại.",
        )}
        onRetry={() => {
          void Promise.all([customersQuery.refetch(), usersQuery.refetch()]);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Khách Hàng"
        // subtitle="Tìm kiếm, phân loại và thao tác nhanh trên cùng một màn hình."
        actions={
          <div className="flex items-center gap-2">
            <Badge className="border border-border bg-muted text-muted-foreground">{customers.length} khách hàng</Badge>
            {canCreateCustomer ? (
              <Button
                variant="secondary"
                size="sm"
                className="border-sky-500/35 bg-sky-500/10 text-sky-700 hover:bg-sky-500/15 dark:text-sky-300"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="size-4" />
                Import
              </Button>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="border-emerald-500/35 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
              onClick={() => void handleExport()}
            >
              <Download className="size-4" />
              Export
            </Button>
            {canCreateCustomer ? (
              <Button
                size="sm"
                onClick={() => {
                  setEditingCustomer(null);
                  setFormOpenLocal(true);
                }}
              >
                <UserPlus className="size-4" />
                Thêm Khách Hàng
              </Button>
            ) : null}
          </div>
        }
      />

      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleImport}
      />

      <StickyFilterBar>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            onDebouncedChange={setServerSearch}
            delayMs={300}
            placeholder="Tìm theo tên, số điện thoại hoặc email"
            wrapperClassName="min-w-[280px] flex-1"
          />
          <UserSelect
            value={assignedFilter}
            onValueChange={setAssignedFilter}
            users={users}
            includeAllOption
            allLabel="Tất cả phụ trách"
            className="w-[250px]"
          />
          <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/80 px-3 text-sm text-muted-foreground">
            <Checkbox checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
            Hiện inactive
          </label>
          <Button
            variant="secondary"
            className="h-11"
            onClick={() => {
              setSearch("");
              setServerSearch("");
              setSelectedType("all");
              setAssignedFilter("all");
              setShowInactive(false);
              setSortKey("activity_at");
              setSortDirection("desc");
            }}
          >
            <RotateCcw className="size-4 text-primary" />
            Xóa bộ lọc
          </Button>
        </div>
        <div className="flex basis-full flex-wrap items-center gap-1 border-b border-border pt-1">
          {chipConfig.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setSelectedType(chip.value)}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition",
                selectedType === chip.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{chip.label}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {chipCounts[chip.value]}
              </span>
            </button>
          ))}
        </div>
      </StickyFilterBar>

      {selectedIds.length ? (
        <BulkActionBar>
          <div className="text-sm font-medium text-primary">{selectedIds.length} khách hàng đã chọn</div>
          <div className="flex flex-wrap items-center gap-2">
            {canUpdateCustomer ? (
              <>
                <Select
                  value={bulkType}
                  onChange={(event) => setBulkType(event.target.value as Customer["customer_type"])}
                  className="w-[180px]"
                >
                  <option value="potential">Tiềm năng</option>
                  <option value="new">Mới</option>
                  <option value="loyal">Thân thiết</option>
                  <option value="vip">VIP</option>
                  <option value="inactive">Không hoạt động</option>
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => bulkChangeTypeMutation.mutate({ ids: selectedIds, type: bulkType })}
                  disabled={bulkChangeTypeMutation.isPending || bulkDeleteMutation.isPending}
                >
                  Đổi phân loại
                </Button>
              </>
            ) : null}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteOpen(true)}
              hidden={!canDeleteCustomer}
              disabled={bulkDeleteMutation.isPending || bulkChangeTypeMutation.isPending}
            >
              Xóa mềm
            </Button>
          </div>
        </BulkActionBar>
      ) : null}

      <DataTableShell
        stickyHeader
        footer={
          <CompactPagination
            page={currentPage}
            totalPages={totalPages}
            label={`${sortedCustomers.length} kết quả`}
            onPrevious={() => setPage(Math.max(1, currentPage - 1))}
            onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
          />
        }
      >
        {sortedCustomers.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={allPageSelected}
                    onChange={(event) =>
                      setSelectedIds((current) => {
                        if (event.target.checked) {
                          return Array.from(new Set([...current, ...pagedCustomers.map((item) => item.id)]));
                        }
                        return current.filter((id) => !pagedCustomers.some((item) => item.id === id));
                      })
                    }
                  />
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("full_name")}>
                  <span className="inline-flex items-center gap-1.5">
                    Khách Hàng
                    {renderSortIcon("full_name")}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("contact")}>
                  <span className="inline-flex items-center gap-1.5">
                    Liên Hệ
                    {renderSortIcon("contact")}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("customer_type")}>
                  <span className="inline-flex items-center gap-1.5">
                    Phân Loại
                    {renderSortIcon("customer_type")}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("assigned_to")}>
                  <span className="inline-flex items-center gap-1.5">
                    Phụ Trách
                    {renderSortIcon("assigned_to")}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("total_spent")}>
                  <span className="inline-flex items-center gap-1.5">
                    Tổng Chi Tiêu
                    {renderSortIcon("total_spent")}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("total_orders")}>
                  <span className="inline-flex items-center gap-1.5">
                    Đơn Hàng
                    {renderSortIcon("total_orders")}
                  </span>
                </TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("activity_at")}>
                  <span className="inline-flex items-center gap-1.5">
                    Lần Cuối
                    {renderSortIcon("activity_at")}
                  </span>
                </TableHead>
                <TableHead className="w-[128px] text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="group cursor-pointer"
                  onMouseEnter={() => preloadRoutePath(`/customers/${customer.id}`)}
                  onFocus={() => preloadRoutePath(`/customers/${customer.id}`)}
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(customer.id)}
                      onChange={(event) =>
                        setSelectedIds((current) =>
                          event.target.checked
                            ? [...current, customer.id]
                            : current.filter((id) => id !== customer.id),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CustomerAvatar
                        name={customer.full_name}
                        type={customer.customer_type}
                        gender={customer.gender}
                        className="size-9"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{customer.full_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {customer.customer_code}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div className="text-sm text-foreground">{customer.phone || "--"}</div>
                      <div className="break-all text-xs text-muted-foreground">{customer.email || "--"}</div>
                      {/* <div className="text-xs text-muted-foreground">
                        Sinh nhật: {customer.date_of_birth ? formatDate(customer.date_of_birth) : "--"}
                      </div> */}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={formatCustomerType(customer.customer_type)}
                      className="bg-muted text-foreground ring-border"
                      dotClassName="bg-primary"
                    />
                  </TableCell>
                  <TableCell>
                    {usersById[customer.assigned_to] ? (
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={usersById[customer.assigned_to]?.full_name ?? "Phụ trách"}
                          src={usersById[customer.assigned_to]?.avatar_url}
                          className="size-7"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {usersById[customer.assigned_to]?.full_name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {formatRole(usersById[customer.assigned_to]?.role ?? "sales")}
                          </span>
                        </span>
                      </div>
                    ) : (
                      "--"
                    )}
                  </TableCell>
                  <TableCell className={cn("tabular-nums", customer.total_spent > 10_000_000 ? "font-semibold" : "")}>
                    {formatCurrencyCompact(customer.total_spent)}
                  </TableCell>
                  <TableCell>{customer.total_orders}</TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <div>{timeAgo(customer.last_order_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(customer.created_at)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex justify-end gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button size="icon" variant="ghost" aria-label={`Xem hồ sơ ${customer.full_name}`} onClick={() => navigate(`/customers/${customer.id}`)}>
                        <Eye className="size-4" />
                      </Button>
                      {canUpdateCustomer ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Chỉnh sửa ${customer.full_name}`}
                          onClick={() => {
                            setEditingCustomer(customer);
                            setFormOpenLocal(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      ) : null}
                      {canDeleteCustomer ? (
                        <Button size="icon" variant="ghost" aria-label={`Xóa mềm ${customer.full_name}`} onClick={() => setDeleteTarget(customer)}>
                          <Trash2 className="size-4 text-rose-500" />
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4 lg:p-5">
            <EmptyState
              icon={Users}
              title="Không có khách hàng phù hợp"
              description="Thử đổi bộ lọc, tìm kiếm khác hoặc thêm khách hàng mới vào danh sách."
              className="min-h-[240px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>

      <CustomerFormModal
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpenLocal(open);
          if (!open) {
            clearCreateParam();
          }
        }}
        initialCustomer={editingCustomer}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget) && canDeleteCustomer}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Xóa khách hàng ${deleteTarget?.full_name ?? ""}?`}
        description="Xóa khách hàng không thể hoàn tác. Hệ thống sẽ chuyển trạng thái sang không hoạt động."
        confirmLabel="Xóa khách hàng"
        onConfirm={() => {
          if (deleteTarget && canDeleteCustomer) {
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen && canDeleteCustomer}
        onOpenChange={setBulkDeleteOpen}
        title="Xóa mềm danh sách đã chọn?"
        description="Các khách hàng này sẽ được chuyển sang trạng thái không hoạt động."
        confirmLabel="Xác nhận"
        onConfirm={() => {
          if (!canDeleteCustomer) {
            return;
          }
          bulkDeleteMutation.mutate(selectedIds);
        }}
      />
    </div>
  );
}
