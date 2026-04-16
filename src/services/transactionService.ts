import { transactionService as dataLayerTransactionService } from "@/services/data-layer";
import type { Transaction } from "@/types";

import type { ServiceRequestOptions, TransactionFilters } from "@/services/shared";

type DataLayerResult<T> = {
  data: T | null;
  error: { message?: string } | null;
  page?: { nextCursor: string | null; hasMore: boolean };
};

export type TransactionCreateInput = {
  customer_id: string;
  invoice_code?: string;
  items: Transaction["items"];
  discount?: number;
  discount_rate?: number;
  tax_rate?: number;
  tax_amount?: number;
  payment_method: Transaction["payment_method"];
  payment_status?: Transaction["payment_status"];
  status?: Transaction["status"];
  notes?: string;
};

export type TransactionUpdateInput = Partial<TransactionCreateInput>;

function unwrap<T>(result: DataLayerResult<T>, fallbackMessage: string): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  if (result.data == null) {
    throw new Error(fallbackMessage);
  }
  return result.data;
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  const items = Array.isArray(row.items)
    ? row.items.map((item) => {
        const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name: String(raw.name ?? ""),
          qty: Number(raw.qty ?? 0),
          price: Number(raw.price ?? 0),
          total: Number(raw.total ?? Number(raw.qty ?? 0) * Number(raw.price ?? 0)),
        };
      })
    : [];

  const totalAmount = Number(row.total_amount ?? 0);

  return {
    id: String(row.id ?? ""),
    customer_id: String(row.customer_id ?? ""),
    invoice_code: row.invoice_code ? String(row.invoice_code) : "",
    items,
    subtotal: Number(row.subtotal ?? totalAmount),
    discount: 0,
    tax_amount: 0,
    total_amount: totalAmount,
    payment_method:
      row.payment_method === "cash" ||
      row.payment_method === "card" ||
      row.payment_method === "transfer" ||
      row.payment_method === "qr" ||
      row.payment_method === "other"
        ? row.payment_method
        : "cash",
    payment_status:
      row.payment_status === "pending" ||
      row.payment_status === "paid" ||
      row.payment_status === "partial" ||
      row.payment_status === "refunded" ||
      row.payment_status === "cancelled"
        ? row.payment_status
        : "pending",
    status:
      row.status === "pending" ||
      row.status === "processing" ||
      row.status === "completed" ||
      row.status === "cancelled" ||
      row.status === "refunded"
        ? row.status
        : "pending",
    created_at: String(row.created_at ?? ""),
    notes: row.notes ? String(row.notes) : "",
  };
}

async function collectTransactions(filters: TransactionFilters = {}) {
  const rows: Transaction[] = [];
  let cursor: string | null = null;
  const maxIterations = 8;
  const pageLimit = 100;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await dataLayerTransactionService.getList({
      customerId: filters.customerId,
      status:
        filters.status &&
        filters.status !== "all" &&
        (filters.status === "pending" ||
          filters.status === "processing" ||
          filters.status === "completed" ||
          filters.status === "cancelled" ||
          filters.status === "refunded")
          ? filters.status
          : undefined,
      from: filters.dateFrom,
      to: filters.dateTo,
      limit: pageLimit,
      cursor,
    });

    const pageRows = unwrap(
      result as DataLayerResult<Array<Record<string, unknown>>>,
      "Không thể tải danh sách giao dịch.",
    ).map(mapTransaction);

    rows.push(...pageRows);

    if (!result.page?.hasMore || !result.page.nextCursor) {
      break;
    }
    cursor = result.page.nextCursor;
  }

  return rows.filter((item) => {
    if (
      filters.paymentMethod &&
      filters.paymentMethod !== "all" &&
      item.payment_method !== filters.paymentMethod
    ) {
      return false;
    }

    if (filters.search) {
      const keyword = filters.search.trim().toLowerCase();
      const haystack = [item.invoice_code, item.notes, item.id].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}

export const transactionService = {
  async getList(filters: TransactionFilters = {}, options: ServiceRequestOptions = {}) {
    void options;
    return collectTransactions(filters);
  },

  async getById(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTransactionService.getById(id);
    return mapTransaction(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không tìm thấy giao dịch."),
    );
  },

  async create(payload: TransactionCreateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTransactionService.create({
      customer_id: payload.customer_id,
      invoice_code: payload.invoice_code,
      items: payload.items,
      payment_method: payload.payment_method,
      payment_status: payload.payment_status,
      status: payload.status,
      notes: payload.notes,
      source: "manual",
    });
    return mapTransaction(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể tạo giao dịch."),
    );
  },

  async update(id: string, payload: TransactionUpdateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTransactionService.update(id, {
      customer_id: payload.customer_id,
      invoice_code: payload.invoice_code,
      items: payload.items,
      payment_method: payload.payment_method,
      payment_status: payload.payment_status,
      status: payload.status,
      notes: payload.notes,
      source: "manual",
    });
    return mapTransaction(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể cập nhật giao dịch."),
    );
  },

  async softDelete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const current = await transactionService.getById(id);
    const result = await dataLayerTransactionService.softDelete(id);
    unwrap(
      result as DataLayerResult<{ id: string; deleted_at: string }>,
      "Không thể xóa mềm giao dịch.",
    );
    return {
      ...current,
      status: "cancelled" as const,
    };
  },
};
