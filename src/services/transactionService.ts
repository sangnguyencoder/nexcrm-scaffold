import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

import {
  type ServiceRequestOptions,
  type TransactionFilters,
  type TransactionRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  normalizeTransactionItems,
  runBestEffort,
  toTransaction,
  withAbortSignal,
  withLatency,
} from "@/services/shared";

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

function generateInvoiceCode() {
  return `HD-${new Date().getFullYear()}-${String(
    Math.floor(1000 + Math.random() * 9000),
  )}`;
}

async function fetchTransactionRow(id: string, options: ServiceRequestOptions = {}) {
  const { data, error } = await withAbortSignal(
    supabase
      .from("transactions")
      .select("*")
      .eq("id", id),
    options.signal,
  ).single();

  if (error) {
    throw error;
  }

  return data;
}

export const transactionService = {
  getList(filters: TransactionFilters = {}, options: ServiceRequestOptions = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = withAbortSignal(
          supabase.from("transactions").select("*"),
          options.signal,
        ).order("created_at", {
          ascending: false,
        });

        if (filters.customerId) {
          query = query.eq("customer_id", filters.customerId);
        }

        if (filters.paymentMethod && filters.paymentMethod !== "all") {
          query = query.eq("payment_method", filters.paymentMethod);
        }

        if (filters.status && filters.status !== "all") {
          query = query.eq("status", filters.status);
        }

        if (filters.dateFrom) {
          query = query.gte("created_at", `${filters.dateFrom}T00:00:00`);
        }

        if (filters.dateTo) {
          query = query.lte("created_at", `${filters.dateTo}T23:59:59.999`);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return ((data ?? []) as TransactionRow[]).map(toTransaction);
      })(),
    );
  },

  getById(id: string, options: ServiceRequestOptions = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const row = await fetchTransactionRow(id, options);
        return toTransaction(row);
      })(),
    );
  },

  create(payload: TransactionCreateInput, options: ServiceRequestOptions = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        const normalizedItems = normalizeTransactionItems(payload.items);
        const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
        const discountAmount =
          typeof payload.discount === "number"
            ? payload.discount
            : subtotal * ((payload.discount_rate ?? 0) / 100);
        const taxableAmount = Math.max(subtotal - discountAmount, 0);
        const taxAmount =
          typeof payload.tax_amount === "number"
            ? payload.tax_amount
            : taxableAmount * ((payload.tax_rate ?? 0) / 100);
        const totalAmount = taxableAmount + taxAmount;
        const invoiceCode = payload.invoice_code?.trim() || generateInvoiceCode();

        const { data, error } = await withAbortSignal(
          supabase.from("transactions").insert({
            customer_id: payload.customer_id,
            invoice_code: invoiceCode,
            items: normalizedItems,
            subtotal,
            discount: discountAmount,
            tax: taxAmount,
            total_amount: totalAmount,
            payment_method: payload.payment_method,
            payment_status: payload.payment_status ?? "paid",
            status: payload.status ?? "completed",
            notes: payload.notes || null,
            created_by: currentUserId,
          }),
          options.signal,
        )
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("transaction.create.audit", () =>
          createAuditLog({
            action: "create",
            entityType: "transaction",
            entityId: data.id,
            newData: {
              message: `Tạo giao dịch ${invoiceCode}`,
              invoice_code: invoiceCode,
              total_amount: totalAmount,
              customer_id: payload.customer_id,
            },
            userId: currentUserId,
          }),
        );

        return toTransaction(data);
      })(),
    );
  },
};
