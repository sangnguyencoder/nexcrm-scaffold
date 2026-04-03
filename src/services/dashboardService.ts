import { supabase } from "@/lib/supabase";
import type {
  CustomerType,
  DashboardCustomerSummary,
  DashboardDistributionPoint,
  DashboardRevenuePoint,
  DashboardStats,
  DashboardTicketSummary,
  TicketPriority,
} from "@/types";

import {
  buildCustomerDistribution,
  buildRevenueSeries,
  ensureSupabaseConfigured,
  isMissingRpcFunctionError,
  normalizeNumber,
  withLatency,
} from "@/services/shared";

type DashboardSnapshotRow = {
  total_customers?: number | null;
  new_customers_month?: number | null;
  total_revenue_month?: number | string | null;
  total_orders_month?: number | null;
  open_tickets?: number | null;
  resolved_tickets_month?: number | null;
  revenue_chart?: unknown;
  customer_type_distribution?: unknown;
  top_customers?: unknown;
  urgent_tickets?: unknown;
};

type DashboardCustomerRow = {
  id: string;
  full_name: string;
  customer_code: string | null;
  customer_type: CustomerType | null;
  total_spent: number | string | null;
  created_at: string;
};

type DashboardTicketRow = {
  id: string;
  title: string;
  priority: TicketPriority | null;
  customer_id: string;
  status: string | null;
  resolved_at: string | null;
  created_at: string;
};

type DashboardTransactionRow = {
  created_at: string;
  total_amount: number | string | null;
  status: string | null;
};

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function getRangeStart(range: "today" | "7days" | "30days") {
  const now = new Date();
  const rangeDays = range === "today" ? 1 : range === "30days" ? 30 : 7;
  const rangeStart = new Date(now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
  rangeStart.setHours(0, 0, 0, 0);
  return rangeStart;
}

function normalizeRevenueChart(value: unknown): DashboardRevenuePoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        period: String(entry.period ?? ""),
        revenue: normalizeNumber(entry.revenue as number | string | null | undefined),
        orders: Number(entry.orders ?? 0),
      };
    })
    .filter((item) => item.period);
}

function normalizeDistribution(value: unknown): DashboardDistributionPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        type: String(entry.type ?? ""),
        count: Number(entry.count ?? 0),
        color: String(entry.color ?? "#2563eb"),
      };
    })
    .filter((item) => item.type);
}

function normalizeTopCustomers(value: unknown): DashboardCustomerSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        id: String(entry.id ?? ""),
        full_name: String(entry.full_name ?? ""),
        customer_code: String(entry.customer_code ?? ""),
        customer_type: (entry.customer_type as CustomerType | null) ?? "new",
        total_spent: normalizeNumber(entry.total_spent as number | string | null | undefined),
      };
    })
    .filter((item) => item.id && item.full_name);
}

function normalizeUrgentTickets(value: unknown): DashboardTicketSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const entry = item as Record<string, unknown>;
      return {
        id: String(entry.id ?? ""),
        title: String(entry.title ?? ""),
        priority: (entry.priority as TicketPriority | null) ?? "medium",
        customer_id: String(entry.customer_id ?? ""),
        customer_name: String(entry.customer_name ?? ""),
        created_at: String(entry.created_at ?? ""),
      };
    })
    .filter((item) => item.id && item.title);
}

function normalizeSnapshot(row: DashboardSnapshotRow): DashboardStats {
  return {
    total_customers: Number(row.total_customers ?? 0),
    new_customers_month: Number(row.new_customers_month ?? 0),
    total_revenue_month: normalizeNumber(row.total_revenue_month),
    total_orders_month: Number(row.total_orders_month ?? 0),
    open_tickets: Number(row.open_tickets ?? 0),
    resolved_tickets_month: Number(row.resolved_tickets_month ?? 0),
    revenue_chart: normalizeRevenueChart(row.revenue_chart),
    customer_type_distribution: normalizeDistribution(row.customer_type_distribution),
    top_customers: normalizeTopCustomers(row.top_customers),
    urgent_tickets: normalizeUrgentTickets(row.urgent_tickets),
  };
}

async function fetchDashboardSnapshot(range: "today" | "7days" | "30days") {
  const { data, error } = await supabase.rpc("get_dashboard_snapshot", {
    p_range: range,
  });

  if (error) {
    throw error;
  }

  const snapshot = Array.isArray(data) ? data[0] : data;
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Supabase không trả về dữ liệu dashboard hợp lệ.");
  }

  return normalizeSnapshot(snapshot as DashboardSnapshotRow);
}

async function buildFallbackDashboardStats(
  range: "today" | "7days" | "30days",
): Promise<DashboardStats> {
  const rangeStart = getRangeStart(range).getTime();
  const monthStart = startOfMonth().getTime();
  const transactionStart = new Date(Math.min(rangeStart, monthStart)).toISOString();

  const [{ data: customers, error: customersError }, { data: tickets, error: ticketsError }, { data: transactions, error: transactionsError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id, full_name, customer_code, customer_type, total_spent, created_at")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("total_spent", { ascending: false }),
      supabase
        .from("support_tickets")
        .select("id, title, priority, customer_id, status, resolved_at, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("created_at, total_amount, status")
        .gte("created_at", transactionStart)
        .order("created_at", { ascending: false }),
    ]);

  if (customersError) {
    throw customersError;
  }

  if (ticketsError) {
    throw ticketsError;
  }

  if (transactionsError) {
    throw transactionsError;
  }

  const customerRows = (customers ?? []) as DashboardCustomerRow[];
  const ticketRows = (tickets ?? []) as DashboardTicketRow[];
  const transactionRows = (transactions ?? []) as DashboardTransactionRow[];
  const customerMap = customerRows.reduce<Record<string, string>>((acc, customer) => {
    acc[customer.id] = customer.full_name;
    return acc;
  }, {});

  const monthTransactions = transactionRows.filter(
    (item) =>
      item.status === "completed" && new Date(item.created_at).getTime() >= monthStart,
  );
  const rangeTransactions = transactionRows
    .filter(
      (item) =>
        item.status === "completed" && new Date(item.created_at).getTime() >= rangeStart,
    )
    .map((transaction) => ({
      created_at: transaction.created_at,
      total_amount: normalizeNumber(transaction.total_amount),
      status: "completed" as const,
      id: transaction.created_at,
      customer_id: "",
      invoice_code: "",
      items: [],
      subtotal: 0,
      discount: 0,
      payment_method: "transfer" as const,
      payment_status: "paid" as const,
    }));

  return {
    total_customers: customerRows.length,
    new_customers_month: customerRows.filter(
      (item) => new Date(item.created_at).getTime() >= monthStart,
    ).length,
    total_revenue_month: monthTransactions.reduce(
      (sum, item) => sum + normalizeNumber(item.total_amount),
      0,
    ),
    total_orders_month: monthTransactions.length,
    open_tickets: ticketRows.filter((item) =>
      ["open", "in_progress", "pending"].includes(item.status ?? ""),
    ).length,
    resolved_tickets_month: ticketRows.filter((ticket) => {
      if (!ticket.resolved_at) {
        return false;
      }

      return new Date(ticket.resolved_at).getTime() >= monthStart;
    }).length,
    revenue_chart: buildRevenueSeries(rangeTransactions),
    customer_type_distribution: buildCustomerDistribution(
      customerRows.map((customer) => ({
        id: customer.id,
        customer_code: customer.customer_code ?? "",
        full_name: customer.full_name,
        phone: "",
        email: "",
        address: "",
        province: "",
        customer_type: customer.customer_type ?? "new",
        assigned_to: "",
        total_spent: normalizeNumber(customer.total_spent),
        total_orders: 0,
        last_order_at: customer.created_at,
        is_active: true,
        created_at: customer.created_at,
        source: "direct",
        tags: [],
        notes: "",
      })),
    ),
    top_customers: customerRows.slice(0, 5).map((customer) => ({
      id: customer.id,
      full_name: customer.full_name,
      customer_code: customer.customer_code ?? "",
      customer_type: customer.customer_type ?? "new",
      total_spent: normalizeNumber(customer.total_spent),
    })),
    urgent_tickets: ticketRows
      .filter((ticket) => ["urgent", "high"].includes(ticket.priority ?? ""))
      .slice(0, 5)
      .map((ticket) => ({
        id: ticket.id,
        title: ticket.title,
        priority: ticket.priority ?? "medium",
        customer_id: ticket.customer_id,
        customer_name: customerMap[ticket.customer_id] ?? "Khách hàng không xác định",
        created_at: ticket.created_at,
      })),
  };
}

export const dashboardService = {
  getStats(range: "today" | "7days" | "30days" = "7days") {
    return withLatency(
      (async (): Promise<DashboardStats> => {
        ensureSupabaseConfigured();

        try {
          return await fetchDashboardSnapshot(range);
        } catch (error) {
          if (!isMissingRpcFunctionError(error)) {
            throw error;
          }

          return buildFallbackDashboardStats(range);
        }
      })(),
    );
  },
};
