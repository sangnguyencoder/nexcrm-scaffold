import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { ArrowLeftRight, Banknote, CreditCard, Plus, QrCode } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { CompactPagination } from "@/components/shared/compact-pagination";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { InspectorList } from "@/components/shared/inspector-list";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
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
import { Sheet } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCustomersQuery, useTransactionsQuery } from "@/hooks/useNexcrmQueries";
import {
  formatCurrencyCompact,
  formatCurrency,
  formatDate,
  formatNumberCompact,
  formatPaymentMethod,
  formatTicketStatus,
} from "@/lib/utils";
import { transactionService } from "@/services/transactionService";
import type { Transaction } from "@/types";

const itemSchema = z.object({
  name: z.string().min(1, "Nhập tên sản phẩm"),
  qty: z.number().min(1, "Số lượng tối thiểu 1"),
  price: z.number().min(0, "Giá phải lớn hơn hoặc bằng 0"),
});

const transactionSchema = z.object({
  customer_id: z.string().min(1, "Vui lòng chọn khách hàng"),
  invoice_code: z.string().optional(),
  items: z.array(itemSchema).min(1, "Cần ít nhất 1 dòng sản phẩm"),
  discount_rate: z.number().min(0).max(100),
  tax_rate: z.number().min(0).max(20),
  payment_method: z.enum(["cash", "card", "transfer", "qr"]),
  notes: z.string().optional(),
});

type TransactionValues = z.infer<typeof transactionSchema>;

function paymentIcon(method: string) {
  if (method === "cash") return Banknote;
  if (method === "card") return CreditCard;
  if (method === "transfer") return ArrowLeftRight;
  return QrCode;
}

function AddTransactionModal({
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
  const [customerSearch, setCustomerSearch] = useState("");
  const deferredCustomerSearch = useDebouncedValue(customerSearch, 150);
  const form = useForm<TransactionValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      customer_id: "",
      invoice_code: "",
      items: [{ name: "", qty: 1, price: 0 }],
      discount_rate: 0,
      tax_rate: 0,
      payment_method: "transfer",
      notes: "",
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });
  const watchedItems = useWatch({ control: form.control, name: "items" });
  const discountRate = useWatch({ control: form.control, name: "discount_rate" });
  const taxRate = useWatch({ control: form.control, name: "tax_rate" });
  const selectedPaymentMethod = useWatch({ control: form.control, name: "payment_method" });
  const selectedCustomerId = useWatch({ control: form.control, name: "customer_id" });

  useEffect(() => {
    if (!open) return;

    form.reset({
      customer_id: prefillCustomerId ?? "",
      invoice_code: "",
      items: [{ name: "", qty: 1, price: 0 }],
      discount_rate: 0,
      tax_rate: 0,
      payment_method: "transfer",
      notes: "",
    });
  }, [form, open, prefillCustomerId]);
  const subtotal = watchedItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountAmount = subtotal * (discountRate / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

  const createTransaction = useAppMutation({
    action: "transaction.create",
    errorMessage: "Không thể tạo giao dịch mới.",
    mutationFn: (values: TransactionValues) =>
      transactionService.create({
        customer_id: values.customer_id,
        invoice_code: values.invoice_code || undefined,
        items: values.items.map((item) => ({
          ...item,
          total: item.qty * item.price,
        })),
        discount: discountAmount,
        discount_rate: values.discount_rate,
        tax_rate: values.tax_rate,
        tax_amount: taxAmount,
        payment_method: values.payment_method,
        payment_status: "paid",
        status: "completed",
        notes: values.notes || "",
      }),
    onSuccess: (createdTransaction) => {
      queryClient.setQueriesData<Transaction[]>({ queryKey: ["transactions"] }, (current = []) => {
        const exists = current.some((item) => item.id === createdTransaction.id);
        if (exists) {
          return current.map((item) =>
            item.id === createdTransaction.id ? createdTransaction : item,
          );
        }

        return [createdTransaction, ...current];
      });
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["customers"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"], refetchType: "active" }),
      ]);
      toast.success("Đã tạo giao dịch mới");
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
      title="Thêm Giao Dịch"
      // description="Tạo hóa đơn mới với đủ thông tin thanh toán nhưng vẫn giữ biểu mẫu ngắn và dễ scan."
      className="w-[min(96vw,980px)]"
    >
      <form
        className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_320px]"
        onSubmit={form.handleSubmit((values) => createTransaction.mutate(values))}
      >
        <div className="space-y-4">
          {createTransaction.actionError ? (
            <div>
              <ActionErrorAlert
                error={createTransaction.actionError}
                onDismiss={createTransaction.clearActionError}
                onRetry={createTransaction.canRetry ? () => void createTransaction.retryLast() : undefined}
              />
            </div>
          ) : null}
          <FormSection title="Thông tin hóa đơn" /* description="Giữ mã hóa đơn, khách hàng và phương thức thanh toán ở cùng một cụm." */>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Tìm khách hàng" error={form.formState.errors.customer_id?.message}>
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
              </FormField>
              <FormField label="Mã hóa đơn" /* description="Để trống để hệ thống tự sinh mã." */>
                <Input {...form.register("invoice_code")} placeholder="Để trống để tự sinh mã" />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Chiết khấu (%)">
                <Input type="number" min={0} max={100} {...form.register("discount_rate", { valueAsNumber: true })} />
              </FormField>
              <FormField label="Thuế (%)">
                <Input type="number" min={0} max={20} {...form.register("tax_rate", { valueAsNumber: true })} />
              </FormField>
            </div>

            <FormField label="Phương thức thanh toán">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {[
                  { label: "Tiền mặt", value: "cash" },
                  { label: "Thẻ", value: "card" },
                  { label: "Chuyển khoản", value: "transfer" },
                  { label: "QR", value: "qr" },
                ].map((method) => (
                  <button
                    key={method.value}
                    type="button"
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                      selectedPaymentMethod === method.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/40"
                    }`}
                    onClick={() => form.setValue("payment_method", method.value as TransactionValues["payment_method"])}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </FormField>
          </FormSection>

          <FormSection
            title="Sản phẩm"
            // description="Giữ danh sách ngắn, mỗi dòng hiển thị đủ số lượng, đơn giá và thành tiền."
            meta={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append({ name: "", qty: 1, price: 0 })}
              >
                <Plus className="size-4" />
                Thêm dòng
              </Button>
            }
          >
            <div className="hidden items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground md:grid md:grid-cols-[minmax(0,2fr)_74px_120px_120px_40px]">
              <span>Sản phẩm / dịch vụ</span>
              <span className="text-center">SL</span>
              <span className="text-right">Đơn giá</span>
              <span className="text-right">Thành tiền</span>
              <span className="sr-only">Xóa</span>
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 md:grid-cols-[minmax(0,2fr)_74px_120px_120px_40px]">
                <Input
                  {...form.register(`items.${index}.name`)}
                  placeholder="Nhập tên sản phẩm / dịch vụ"
                  aria-label={`Tên sản phẩm dòng ${index + 1}`}
                />
                <Input
                  type="number"
                  min={1}
                  {...form.register(`items.${index}.qty`, { valueAsNumber: true })}
                  placeholder="SL"
                  aria-label={`Số lượng dòng ${index + 1}`}
                />
                <Input
                  type="number"
                  min={0}
                  {...form.register(`items.${index}.price`, { valueAsNumber: true })}
                  placeholder="Đơn giá"
                  aria-label={`Đơn giá dòng ${index + 1}`}
                />
                <Input
                  readOnly
                  value={formatCurrency((watchedItems[index]?.qty ?? 0) * (watchedItems[index]?.price ?? 0))}
                  placeholder="Thành tiền"
                  aria-label={`Thành tiền dòng ${index + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Xóa dòng sản phẩm"
                  onClick={() => (fields.length > 1 ? remove(index) : undefined)}
                >
                  x
                </Button>
              </div>
            ))}
          </FormSection>

          <FormSection title="Ghi chú giao dịch" /* description="Chỉ giữ phần thông tin bổ sung thực sự cần cho kế toán hoặc CSKH." */>
            <FormField label="Nội dung">
              <Textarea
                {...form.register("notes")}
                placeholder="Ví dụ: Khách thanh toán đủ và yêu cầu xuất hóa đơn VAT"
                rows={4}
              />
            </FormField>
          </FormSection>
        </div>

        <div className="space-y-4 lg:sticky lg:top-0">
          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tóm tắt thanh toán</div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tạm tính</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Sau chiết khấu</span>
                <span>{formatCurrency(taxableAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Thuế</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="border-t border-border/70 pt-3">
                <div className="flex justify-between text-base font-semibold">
                  <span>Tổng cộng</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardContent className="space-y-3 p-4 text-sm">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Thông tin nhanh</div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Khách hàng</span>
                <span className="text-right">{customers.find((item) => item.id === selectedCustomerId)?.full_name ?? "--"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Thanh toán</span>
                <span>{formatPaymentMethod(selectedPaymentMethod)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Sản phẩm</span>
                <span>{fields.length} dòng</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <Button type="submit" disabled={createTransaction.isPending}>
              {createTransaction.isPending ? "Đang lưu..." : "Lưu giao dịch"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export function TransactionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDebouncedValue(search, 200);
  const transactionsQuery = useTransactionsQuery({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    paymentMethod: paymentFilter,
    status: statusFilter,
  });
  const customersQuery = useCustomersQuery();
  const transactions = useMemo(() => transactionsQuery.data ?? [], [transactionsQuery.data]);
  const customers = useMemo(() => customersQuery.data ?? [], [customersQuery.data]);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [createOpenLocal, setCreateOpenLocal] = useState(false);
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

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const customerName = customerMap[transaction.customer_id]?.full_name ?? "";
        if (
          deferredSearch &&
          !`${transaction.invoice_code} ${customerName}`
            .toLowerCase()
            .includes(deferredSearch.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [customerMap, deferredSearch, transactions],
  );

  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / 20));
  const currentPage = Math.min(page, totalPages);
  const pagedTransactions = useMemo(
    () => filteredTransactions.slice((currentPage - 1) * 20, currentPage * 20),
    [currentPage, filteredTransactions],
  );

  const selectedTransaction = filteredTransactions.find((item) => item.id === selectedTransactionId);

  const summary = useMemo(() => {
    const revenue = filteredTransactions.reduce((sum, item) => sum + item.total_amount, 0);
    const orders = filteredTransactions.length;
    const average = orders ? revenue / orders : 0;
    const completionRate = orders
      ? Math.round(
          (filteredTransactions.filter((item) => item.status === "completed").length / orders) *
            100,
        )
      : 0;
    return { revenue, orders, average, completionRate };
  }, [filteredTransactions]);

  if (transactionsQuery.isLoading) {
    return <PageLoader panels={2} />;
  }

  if (transactionsQuery.error || customersQuery.error) {
    return (
      <PageErrorState
        title="Không thể tải giao dịch"
        description="Danh sách giao dịch hoặc dữ liệu khách hàng chưa tải được. Vui lòng thử lại để tiếp tục thao tác."
        onRetry={() => {
          void Promise.all([transactionsQuery.refetch(), customersQuery.refetch()]);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Giao Dịch"
        // subtitle="Doanh thu, thanh toán và trạng thái hóa đơn trên cùng một bảng thao tác."
        actions={
          <Button size="sm" onClick={() => setCreateOpenLocal(true)}>
            <Plus className="size-4" />
            Thêm Giao Dịch
          </Button>
        }
      />

      <MetricStrip>
        <MetricStripItem label="Tổng doanh thu" value={formatCurrencyCompact(summary.revenue)} helper="Theo bộ lọc hiện tại." />
        <MetricStripItem label="Số đơn" value={formatNumberCompact(summary.orders)} helper="Số giao dịch đang hiển thị." />
        <MetricStripItem label="Giá trị trung bình" value={formatCurrencyCompact(summary.average)} helper="Mỗi đơn hoàn tất trung bình." />
        <MetricStripItem label="Tỷ lệ hoàn thành" value={`${summary.completionRate}%`} helper="Tính trên trạng thái giao dịch." />
      </MetricStrip>

      <StickyFilterBar>
        <Input
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          className="w-[152px]"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          className="w-[152px]"
        />
        <Select
          value={paymentFilter}
          onChange={(event) => {
            setPaymentFilter(event.target.value);
            setPage(1);
          }}
          className="w-[170px]"
        >
          <option value="all">Tất cả thanh toán</option>
          <option value="cash">Tiền mặt</option>
          <option value="card">Thẻ</option>
          <option value="transfer">Chuyển khoản</option>
          <option value="qr">QR</option>
        </Select>
        <Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="w-[170px]"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="completed">Hoàn tất</option>
          <option value="cancelled">Đã hủy</option>
        </Select>
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Tìm theo hóa đơn hoặc khách hàng"
          className="min-w-[240px] flex-1"
        />
      </StickyFilterBar>

      <DataTableShell
        footer={
          filteredTransactions.length ? (
            <CompactPagination
              page={currentPage}
              totalPages={totalPages}
              label={`${filteredTransactions.length} giao dịch`}
              onPrevious={() => setPage(Math.max(1, currentPage - 1))}
              onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
            />
          ) : (
            <div className="text-sm text-muted-foreground">0 giao dịch</div>
          )
        }
      >
        {filteredTransactions.length ? (
          <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hóa Đơn</TableHead>
              <TableHead>Khách Hàng</TableHead>
              <TableHead>Sản Phẩm</TableHead>
              <TableHead>Tổng Tiền</TableHead>
              <TableHead>Thanh Toán</TableHead>
              <TableHead>Trạng Thái</TableHead>
              <TableHead className="text-right">Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedTransactions.map((transaction) => {
              const customer = customerMap[transaction.customer_id];
              const Icon = paymentIcon(transaction.payment_method);
              return (
                <TableRow key={transaction.id} className="cursor-pointer" onClick={() => setSelectedTransactionId(transaction.id)}>
                  <TableCell>
                    <div className="font-mono text-xs font-semibold">{transaction.invoice_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(transaction.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CustomerAvatar
                        name={customer?.full_name ?? "NA"}
                        type={customer?.customer_type ?? "potential"}
                        className="size-10 text-sm"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{customer?.full_name ?? "--"}</div>
                        <div className="text-xs text-muted-foreground">{customer?.customer_code ?? "--"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    <div className="max-w-[220px] truncate">{transaction.items[0]?.name}</div>
                    {transaction.items.length > 1 ? ` +${transaction.items.length - 1} sản phẩm khác` : ""}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold">{formatCurrencyCompact(transaction.total_amount)}</div>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon className="size-3.5" />
                      {formatPaymentMethod(transaction.payment_method)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={formatTicketStatus(transaction.payment_status)}
                      className="bg-muted text-foreground ring-border"
                      dotClassName="bg-primary"
                    />
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={formatTicketStatus(transaction.status)}
                      className="bg-muted text-foreground ring-border"
                      dotClassName="bg-primary"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm">Xem</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        ) : (
          <div className="p-4 lg:p-5">
            <EmptyState
              icon={CreditCard}
              title="Không có giao dịch phù hợp"
              description="Thử thay đổi bộ lọc hoặc tạo giao dịch mới."
              className="min-h-[240px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>

      <AddTransactionModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpenLocal(open);
          if (!open) {
            clearPrefillParams();
          }
        }}
        prefillCustomerId={prefillCustomerId}
      />

      <Sheet
        open={Boolean(selectedTransaction)}
        onOpenChange={(open) => {
          if (!open) setSelectedTransactionId(null);
        }}
        title={selectedTransaction?.invoice_code ?? "Chi tiết giao dịch"}
        // description={selectedTransaction ? "Tóm tắt hóa đơn, sản phẩm và thanh toán." : undefined}
        className="w-[min(100vw,720px)]"
        footer={
          selectedTransaction ? (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSelectedTransactionId(null)}>
                Đóng
              </Button>
            </div>
          ) : null
        }
      >
        {selectedTransaction ? (
          <div className="space-y-4">
            <InspectorList
              items={[
                {
                  label: "Khách hàng",
                  value: customerMap[selectedTransaction.customer_id]?.full_name ?? "--",
                },
                {
                  label: "Mã khách hàng",
                  value: customerMap[selectedTransaction.customer_id]?.customer_code ?? "--",
                },
                {
                  label: "Thanh toán",
                  value: formatPaymentMethod(selectedTransaction.payment_method),
                },
              ]}
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead>SL</TableHead>
                  <TableHead>Đơn giá</TableHead>
                  <TableHead>Thành tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedTransaction.items.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.qty}</TableCell>
                    <TableCell>{formatCurrency(item.price)}</TableCell>
                    <TableCell>{formatCurrency(item.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="rounded-lg bg-muted/40 p-4 text-sm">
              <div className="flex justify-between">
                <span>Tạm tính</span>
                <span>{formatCurrency(selectedTransaction.subtotal)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Chiết khấu</span>
                <span>{formatCurrency(selectedTransaction.discount)}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span>Thuế</span>
                <span>{formatCurrency(selectedTransaction.tax_amount ?? 0)}</span>
              </div>
              <div className="mt-3 flex justify-between text-base font-semibold">
                <span>Tổng cộng</span>
                <span>{formatCurrency(selectedTransaction.total_amount)}</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Thanh toán</span>
                <span>{formatPaymentMethod(selectedTransaction.payment_method)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái</span>
                <span>{formatTicketStatus(selectedTransaction.payment_status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ngày tạo</span>
                <span>{formatDate(selectedTransaction.created_at)}</span>
              </div>
            </div>
            {selectedTransaction.notes ? (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground">
                  {selectedTransaction.notes}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
