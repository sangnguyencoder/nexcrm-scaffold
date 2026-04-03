import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFieldArray, useForm } from "react-hook-form";
import { ArrowLeftRight, Banknote, CreditCard, Plus, QrCode } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { z } from "zod";

import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
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
  formatCurrency,
  formatDate,
  formatPaymentMethod,
  formatTicketStatus,
} from "@/lib/utils";
import { transactionService } from "@/services/transactionService";

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
  const watchedItems = form.watch("items");
  const discountRate = form.watch("discount_rate");
  const taxRate = form.watch("tax_rate");
  const subtotal = watchedItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const discountAmount = subtotal * (discountRate / 100);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = taxableAmount * (taxRate / 100);
  const total = taxableAmount + taxAmount;

  const createTransaction = useMutation({
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
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      toast.success("Đã tạo giao dịch mới");
      form.reset();
      onOpenChange(false);
    },
  });

  const filteredCustomers = customers.filter((customer) =>
    customer.full_name.toLowerCase().includes(customerSearch.toLowerCase()),
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Thêm Giao Dịch"
      description="Tạo hóa đơn mới và cập nhật tổng chi tiêu khách hàng."
    >
      <form
        className="space-y-4"
        onSubmit={form.handleSubmit((values) => createTransaction.mutate(values))}
      >
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
          <Field label="Mã hóa đơn">
            <Input {...form.register("invoice_code")} placeholder="Để trống để tự sinh mã" />
          </Field>
        </div>

        <div className="space-y-3 rounded-2xl border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="font-medium">Sản phẩm</div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => append({ name: "", qty: 1, price: 0 })}
            >
              <Plus className="size-4" />
              Thêm sản phẩm
            </Button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="grid gap-3 md:grid-cols-[2fr,80px,140px,140px,48px]">
              <Input {...form.register(`items.${index}.name`)} placeholder="Tên sản phẩm" />
              <Input type="number" min={1} {...form.register(`items.${index}.qty`, { valueAsNumber: true })} />
              <Input type="number" min={0} {...form.register(`items.${index}.price`, { valueAsNumber: true })} />
              <Input
                readOnly
                value={formatCurrency((watchedItems[index]?.qty ?? 0) * (watchedItems[index]?.price ?? 0))}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => (fields.length > 1 ? remove(index) : undefined)}
              >
                x
              </Button>
            </div>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Chiết khấu (%)">
            <Input type="number" min={0} max={100} {...form.register("discount_rate", { valueAsNumber: true })} />
          </Field>
          <Field label="Thuế (%)">
            <Input type="number" min={0} max={20} {...form.register("tax_rate", { valueAsNumber: true })} />
          </Field>
        </div>

        <div className="rounded-2xl bg-muted/40 p-4 text-sm">
          <div className="flex justify-between">
            <span>Tạm tính</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>Sau chiết khấu</span>
            <span>{formatCurrency(taxableAmount)}</span>
          </div>
          <div className="mt-2 flex justify-between">
            <span>Thuế</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="mt-3 flex justify-between text-base font-semibold">
            <span>Tổng cộng</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <Field label="Phương thức thanh toán">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: "Tiền mặt", value: "cash" },
              { label: "Thẻ", value: "card" },
              { label: "Chuyển khoản", value: "transfer" },
              { label: "QR", value: "qr" },
            ].map((method) => (
              <button
                key={method.value}
                type="button"
                className={`rounded-2xl border px-4 py-3 text-sm transition ${
                  form.watch("payment_method") === method.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => form.setValue("payment_method", method.value as TransactionValues["payment_method"])}
              >
                {method.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Ghi chú">
          <Textarea {...form.register("notes")} placeholder="Thông tin thêm về giao dịch" />
        </Field>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button type="submit" disabled={createTransaction.isPending}>
            {createTransaction.isPending ? "Đang lưu..." : "Lưu giao dịch"}
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

export function TransactionListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: transactions = [], isLoading } = useTransactionsQuery();
  const { data: customers = [] } = useCustomersQuery();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
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

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const created = new Date(transaction.created_at).getTime();
        if (dateFrom && created < new Date(dateFrom).getTime()) return false;
        if (dateTo && created > new Date(dateTo).getTime() + 86_399_999) return false;
        if (paymentFilter !== "all" && transaction.payment_method !== paymentFilter) return false;
        if (statusFilter !== "all" && transaction.status !== statusFilter) return false;
        const customerName = customerMap[transaction.customer_id]?.full_name ?? "";
        if (
          search &&
          !`${transaction.invoice_code} ${customerName}`
            .toLowerCase()
            .includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [customerMap, dateFrom, dateTo, paymentFilter, search, statusFilter, transactions],
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

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Giao Dịch"
        subtitle={`Tổng doanh thu hiển thị theo bộ lọc hiện tại: ${formatCurrency(summary.revenue)}`}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Thêm Giao Dịch
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <MiniStat label="Tổng doanh thu" value={formatCurrency(summary.revenue)} />
        <MiniStat label="Số đơn" value={String(summary.orders)} />
        <MiniStat label="Giá trị TB" value={formatCurrency(summary.average)} />
        <MiniStat label="Tỷ lệ hoàn thành" value={`${summary.completionRate}%`} />
      </div>

      <Card>
        <CardContent className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-5">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
            <option value="all">Tất cả thanh toán</option>
            <option value="cash">Tiền mặt</option>
            <option value="card">Thẻ</option>
            <option value="transfer">Chuyển khoản</option>
            <option value="qr">QR</option>
          </Select>
          <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="completed">Hoàn tất</option>
            <option value="cancelled">Đã hủy</option>
          </Select>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm theo hóa đơn hoặc khách hàng"
          />
        </CardContent>
      </Card>

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
              <TableHead>Chi tiết</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((transaction) => {
              const customer = customerMap[transaction.customer_id];
              const Icon = paymentIcon(transaction.payment_method);
              return (
                <TableRow key={transaction.id} className="cursor-pointer" onClick={() => setSelectedTransactionId(transaction.id)}>
                  <TableCell>
                    <div className="font-mono">{transaction.invoice_code}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(transaction.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <CustomerAvatar
                        name={customer?.full_name ?? "NA"}
                        type={customer?.customer_type ?? "potential"}
                      />
                      <div>{customer?.full_name ?? "--"}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {transaction.items[0]?.name}
                    {transaction.items.length > 1 ? ` +${transaction.items.length - 1} sản phẩm khác` : ""}
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold">{formatCurrency(transaction.total_amount)}</div>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
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
                  <TableCell>
                    <Button variant="ghost">Xem chi tiết</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          icon={CreditCard}
          title="Không có giao dịch phù hợp"
          description="Thử thay đổi bộ lọc hoặc tạo giao dịch mới."
        />
      )}

      <AddTransactionModal
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
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
        description={selectedTransaction ? "Tóm tắt hóa đơn, sản phẩm và thanh toán." : undefined}
      >
        {selectedTransaction ? (
          <div className="space-y-5">
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="font-semibold">
                  {customerMap[selectedTransaction.customer_id]?.full_name}
                </div>
                <div className="text-sm text-muted-foreground">
                  {customerMap[selectedTransaction.customer_id]?.customer_code}
                </div>
              </CardContent>
            </Card>
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
            <div className="rounded-2xl bg-muted/40 p-4 text-sm">
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
                <CardContent className="p-5 text-sm text-muted-foreground">
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-display text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
