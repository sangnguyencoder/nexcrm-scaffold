import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  Search,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { z } from "zod";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useCustomersQuery, queryKeys, useUsersQuery } from "@/hooks/useNexcrmQueries";
import {
  formatCurrency,
  formatCustomerType,
  formatDate,
  timeAgo,
  toSlug,
} from "@/lib/utils";
import { customerService } from "@/services/customerService";
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
  customer_type: z.enum(["new", "potential", "loyal", "vip", "inactive"]),
  source: z.enum(["direct", "marketing", "referral", "pos", "online"]),
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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const isEdit = Boolean(initialCustomer);
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      email: "",
      customer_type: "new",
      source: "direct",
      address: "",
      province: "",
      assigned_to: users[0]?.id ?? "",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: initialCustomer?.full_name ?? "",
        phone: initialCustomer?.phone ?? "",
        email: initialCustomer?.email ?? "",
        customer_type: initialCustomer?.customer_type ?? "new",
        source: normalizeSource(initialCustomer?.source),
        address: initialCustomer?.address ?? "",
        province: initialCustomer?.province ?? "",
        assigned_to: initialCustomer?.assigned_to ?? users[0]?.id ?? "",
        notes: initialCustomer?.notes ?? "",
      });
    }
  }, [form, initialCustomer, open, users]);

  const mutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      if (isEdit && initialCustomer) {
        return customerService.update(initialCustomer.id, values);
      }

      return customerService.create({
        ...values,
        phone: values.phone || "",
        email: values.email || "",
        address: values.address || "",
        province: values.province || "",
        assigned_to: values.assigned_to || users[0]?.id || "",
        notes: values.notes || "",
        tags: [],
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
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
        description="Lưu hồ sơ khách hàng trực tiếp vào dữ liệu demo của NexCRM."
      >
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Họ và tên" error={form.formState.errors.full_name?.message}>
              <Input {...form.register("full_name")} placeholder="Nhập họ tên khách hàng" />
            </Field>
            <Field label="Số điện thoại" error={form.formState.errors.phone?.message}>
              <Input {...form.register("phone")} placeholder="090xxxxxxx" />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <Input {...form.register("email")} placeholder="email@domain.vn" />
            </Field>
            <Field label="Phân loại" error={form.formState.errors.customer_type?.message}>
              <Select {...form.register("customer_type")}>
                <option value="new">Mới</option>
                <option value="potential">Tiềm năng</option>
                <option value="loyal">Thân thiết</option>
                <option value="vip">VIP</option>
                <option value="inactive">Không hoạt động</option>
              </Select>
            </Field>
            <Field label="Nguồn">
              <Select {...form.register("source")}>
                <option value="direct">Trực tiếp</option>
                <option value="marketing">Marketing</option>
                <option value="referral">Giới thiệu</option>
                <option value="pos">POS</option>
                <option value="online">Online</option>
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
          <Field label="Địa chỉ">
            <Input {...form.register("address")} placeholder="Số nhà, đường, quận/huyện" />
          </Field>
          <Field label="Tỉnh / Thành">
            <Input {...form.register("province")} placeholder="TP. Hồ Chí Minh" />
          </Field>
          <Field label="Ghi chú">
            <Textarea {...form.register("notes")} placeholder="Thông tin thêm về khách hàng" />
          </Field>
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
      <span className="font-medium text-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs text-rose-500">{error}</span> : null}
    </label>
  );
}

export function CustomerListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: customers = [], isLoading } = useCustomersQuery();
  const { data: users = [] } = useUsersQuery();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedType, setSelectedType] = useState<Customer["customer_type"] | "all">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [sortKey, setSortKey] = useState<"full_name" | "total_spent" | "created_at">(
    "created_at",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkType, setBulkType] = useState<Customer["customer_type"]>("potential");
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const customerMap = useMemo(
    () =>
      users.reduce<Record<string, string>>((acc, user) => {
        acc[user.id] = user.full_name;
        return acc;
      }, {}),
    [users],
  );

  const filteredCustomers = useMemo(() => {
    const keyword = toSlug(debouncedSearch);
    const result = customers
      .filter((customer) => (showInactive ? true : customer.is_active))
      .filter((customer) =>
        selectedType === "all" ? true : customer.customer_type === selectedType,
      )
      .filter((customer) => {
        if (!keyword) return true;
        return toSlug([customer.full_name, customer.phone, customer.email].join(" ")).includes(keyword);
      })
      .sort((a, b) => {
        const direction = sortDirection === "asc" ? 1 : -1;
        if (sortKey === "full_name") {
          return a.full_name.localeCompare(b.full_name, "vi") * direction;
        }
        if (sortKey === "total_spent") {
          return (a.total_spent - b.total_spent) * direction;
        }
        return (
          (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) *
          direction
        );
      });

    return result;
  }, [customers, debouncedSearch, selectedType, showInactive, sortDirection, sortKey]);

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
  }, [debouncedSearch, selectedType, showInactive, sortDirection, sortKey]);

  const pagedCustomers = filteredCustomers.slice((page - 1) * 10, page * 10);
  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / 10));

  const deleteMutation = useMutation({
    mutationFn: customerService.softDelete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Đã chuyển khách hàng sang trạng thái không hoạt động");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: customerService.softDeleteMany,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      setSelectedIds([]);
      toast.success("Đã cập nhật trạng thái không hoạt động cho danh sách đã chọn");
    },
  });

  const bulkChangeTypeMutation = useMutation({
    mutationFn: ({ ids, type }: { ids: string[]; type: Customer["customer_type"] }) =>
      customerService.bulkChangeType(ids, type),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
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

  const handleExport = () => {
    const rows = filteredCustomers.map((customer) => ({
      customer_code: customer.customer_code,
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email,
      customer_type: formatCustomerType(customer.customer_type),
      source: customer.source,
      address: customer.address,
      province: customer.province,
      assigned_to: customerMap[customer.assigned_to] ?? "",
      total_spent: customer.total_spent,
      total_orders: customer.total_orders,
      created_at: formatDate(customer.created_at),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KhachHang");
    XLSX.writeFile(workbook, "nexcrm-khach-hang.xlsx");
    toast.success("Đã xuất danh sách khách hàng");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const loadingId = toast.loading("Đang nhập dữ liệu khách hàng...");

    try {
      const buffer = await file.arrayBuffer();
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
          phone,
          email,
          customer_type: mapImportedCustomerType(normalizedRow.customertype || normalizedRow.phanloai),
          source: mapImportedSource(normalizedRow.source || normalizedRow.nguon),
          address: normalizedRow.address || normalizedRow.diachi || "",
          province: normalizedRow.province || normalizedRow.tinhthanh || "",
          assigned_to: users[0]?.id ?? "",
          notes: normalizedRow.notes || normalizedRow.ghichu || "",
          tags: [],
        });

        if (phone) existingPhones.add(phone);
        if (email) existingEmails.add(email.toLowerCase());
        created += 1;
      }

      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.dismiss(loadingId);
      toast.success(`Đã nhập ${created} khách hàng${skipped ? `, bỏ qua ${skipped} bản ghi trùng/không hợp lệ` : ""}`);
    } catch (error) {
      toast.dismiss(loadingId);
      toast.error(error instanceof Error ? error.message : "Không thể nhập file khách hàng");
    } finally {
      event.target.value = "";
    }
  };

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách Hàng"
        subtitle="Quản lý danh sách khách hàng và theo dõi tình trạng chăm sóc."
        actions={
          <>
            <Badge className="bg-primary/10 text-primary ring-primary/20">
              {customers.length} khách hàng
            </Badge>
            <Button variant="secondary" onClick={() => importInputRef.current?.click()}>
              Nhập Excel
            </Button>
            <Button variant="secondary" onClick={handleExport}>
              Xuất Excel
            </Button>
            <Button onClick={() => {
              setEditingCustomer(null);
              setFormOpen(true);
            }}>
              <UserPlus className="size-4" />
              Thêm Khách Hàng
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="space-y-5 p-5">
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <div className="grid gap-3 lg:grid-cols-[2fr,1fr,auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo tên, số điện thoại hoặc email"
                className="pl-9"
              />
            </div>
            <Select
              value={selectedType}
              onChange={(event) =>
                setSelectedType(event.target.value as Customer["customer_type"] | "all")
              }
            >
              <option value="all">Tất cả phân loại</option>
              <option value="vip">VIP</option>
              <option value="loyal">Thân thiết</option>
              <option value="potential">Tiềm năng</option>
              <option value="new">Mới</option>
              <option value="inactive">Không hoạt động</option>
            </Select>
            <label className="inline-flex items-center gap-2 rounded-xl border border-border px-4 text-sm text-muted-foreground">
              <Checkbox checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Hiện cả inactive
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            {chipConfig.map((chip) => (
              <button
                key={chip.value}
                type="button"
                onClick={() => setSelectedType(chip.value)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  selectedType === chip.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                }`}
              >
                {chip.label} ({chipCounts[chip.value]})
              </button>
            ))}
          </div>

          {selectedIds.length ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm font-medium text-primary">
                {selectedIds.length} đã chọn
              </div>
              <div className="flex flex-wrap items-center gap-3">
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
                  onClick={() =>
                    bulkChangeTypeMutation.mutate({ ids: selectedIds, type: bulkType })
                  }
                >
                  Đổi phân loại
                </Button>
                <Button variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                  Xóa mềm
                </Button>
              </div>
            </div>
          ) : null}

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
                  Khách Hàng
                </TableHead>
                <TableHead>Liên Hệ</TableHead>
                <TableHead>Phân Loại</TableHead>
                <TableHead>Phụ Trách</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("total_spent")}>
                  Tổng Chi Tiêu
                </TableHead>
                <TableHead>Đơn Hàng</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort("created_at")}>
                  Lần Cuối
                </TableHead>
                <TableHead className="w-[160px] text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="group cursor-pointer"
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
                      <CustomerAvatar name={customer.full_name} type={customer.customer_type} />
                      <div>
                        <div className="font-medium">{customer.full_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {customer.customer_code}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 text-sm">
                      <div>{customer.phone || "--"}</div>
                      <div className="text-muted-foreground">{customer.email || "--"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={formatCustomerType(customer.customer_type)}
                      className="bg-muted text-foreground ring-border"
                      dotClassName="bg-primary"
                    />
                  </TableCell>
                  <TableCell>{customerMap[customer.assigned_to] ?? "--"}</TableCell>
                  <TableCell className={customer.total_spent > 10_000_000 ? "font-semibold" : ""}>
                    {formatCurrency(customer.total_spent)}
                  </TableCell>
                  <TableCell>{customer.total_orders}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div>{timeAgo(customer.last_order_at)}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(customer.created_at)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div
                      className="flex justify-end gap-2 opacity-0 transition group-hover:opacity-100"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Button size="icon" variant="ghost" onClick={() => navigate(`/customers/${customer.id}`)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setEditingCustomer(customer);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(customer)}>
                        <Trash2 className="size-4 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Trang {page}/{totalPages} · {filteredCustomers.length} kết quả
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setPage((value) => Math.max(1, value - 1))}>
                Trang trước
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              >
                Trang sau
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!filteredCustomers.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="mx-auto mb-4 size-12 text-muted-foreground" />
            <div className="font-display text-xl font-semibold">Không có khách hàng phù hợp</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Thử thay đổi bộ lọc hoặc thêm khách hàng mới vào danh sách.
            </div>
          </CardContent>
        </Card>
      ) : null}

      <CustomerFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        initialCustomer={editingCustomer}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Xóa khách hàng ${deleteTarget?.full_name ?? ""}?`}
        description="Xóa khách hàng không thể hoàn tác. Hệ thống sẽ chuyển trạng thái sang không hoạt động."
        confirmLabel="Xóa khách hàng"
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Xóa mềm danh sách đã chọn?"
        description="Các khách hàng này sẽ được chuyển sang trạng thái không hoạt động."
        confirmLabel="Xác nhận"
        onConfirm={() => bulkDeleteMutation.mutate(selectedIds)}
      />
    </div>
  );
}
