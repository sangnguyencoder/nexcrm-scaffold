import { supabase } from "@/lib/supabase";
import { formatDateInputValue } from "@/lib/utils";

import {
  ensureSupabaseConfigured,
  normalizeNumber,
  type ServiceRequestOptions,
  withAbortSignal,
  withLatency,
} from "@/services/shared";
import {
  getClientTimeZone,
  reportLogger,
  type ReportLogger,
  withTimeout,
} from "@/services/reportDiagnostics";

export type ReportTab = "revenue" | "customers" | "tickets" | "marketing";
export type ReportGroupBy = "day" | "week" | "month";

export type RevenueReportSnapshot = {
  tab: "revenue";
  revenueSeries: Array<{ period: string; revenue: number; orders: number; avg: number; growth: number }>;
  revenueTotal: number;
  revenueAvg: number;
  maxOrder: number;
  pipelineValue: number;
  winRate: number;
};

export type CustomersReportSnapshot = {
  tab: "customers";
  newCustomerSeries: Array<{ period: string; count: number }>;
  sourceBreakdown: Array<{ name: string; value: number; color: string }>;
  customerTypeRows: Array<{ type: string; total: number; percent: number }>;
};

export type TicketsReportSnapshot = {
  tab: "tickets";
  avgResolutionHours: number;
  completedTasks: number;
  overdueTasks: number;
  taskCompletionRate: number;
  ticketCategorySeries: Array<{ category: string; total: number }>;
  staffPerformance: Array<{
    id: string;
    name: string;
    assigned: number;
    resolved: number;
    avgResponse: string;
    tasksDone: number;
    tasksOverdue: number;
  }>;
};

export type MarketingReportSnapshot = {
  tab: "marketing";
  outboundTotals: { sent: number; opened: number; clicked: number; failed: number };
  campaignPerformance: Array<{
    id: string;
    name: string;
    channel: string;
    sent: number;
    opened: number;
    clicked: number;
    failed: number;
    openRate: number;
    clickRate: number;
    status: string;
  }>;
};

export type ReportSnapshot =
  | RevenueReportSnapshot
  | CustomersReportSnapshot
  | TicketsReportSnapshot
  | MarketingReportSnapshot;

export type ReportRequest = {
  tab: ReportTab;
  from: string;
  to: string;
  groupBy: ReportGroupBy;
};

type QueryResult<T> = PromiseLike<{ data: T | null; error: unknown | null }>;

type QueryBuilder<T> = {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  is: (column: string, value: unknown) => QueryBuilder<T>;
  gte: (column: string, value: string) => QueryBuilder<T>;
  lte: (column: string, value: string) => QueryBuilder<T>;
  abortSignal?: (signal: AbortSignal) => QueryBuilder<T>;
  order: (column: string, options?: { ascending?: boolean }) => QueryResult<T>;
};

type ReportClient = {
  from: <T = unknown>(table: string) => QueryBuilder<T>;
};

type ReportServiceDependencies = {
  client: ReportClient;
  logger?: ReportLogger;
  timeoutMs?: number;
  getTimeZone?: () => string;
  ensureConfigured?: () => void;
};

type RevenueTransactionRow = {
  created_at: string;
  total_amount: number | string | null;
  status: string | null;
};

type RevenueDealRow = {
  created_at: string;
  stage: string | null;
  value: number | string | null;
};

type CustomerReportRow = {
  created_at: string;
  customer_type: string | null;
  source: string | null;
};

type TicketReportRow = {
  created_at: string;
  resolved_at: string | null;
  category: string | null;
  assigned_to: string | null;
  status: string | null;
};

type TaskReportRow = {
  created_at: string;
  due_at: string | null;
  assigned_to: string | null;
  status: string | null;
};

type UserRow = {
  id: string;
  full_name: string;
};

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  status: string;
};

type OutboundMessageRow = {
  campaign_id: string | null;
  status: string | null;
  created_at: string;
};

const DEFAULT_REPORT_TIMEOUT_MS = 15_000;

function getRangeBounds(from: string, to: string) {
  const startDate = new Date(`${from}T00:00:00`);
  const endDate = new Date(`${to}T23:59:59.999`);

  return {
    start: startDate.getTime(),
    end: endDate.getTime(),
    startIso: startDate.toISOString(),
    endIso: endDate.toISOString(),
  };
}

function periodKey(date: string, groupBy: ReportGroupBy) {
  const target = new Date(date);
  if (groupBy === "month") {
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  }

  if (groupBy === "week") {
    const first = new Date(target);
    first.setDate(target.getDate() - target.getDay());
    return `${first.getFullYear()}-W${String(first.getMonth() + 1).padStart(2, "0")}${String(first.getDate()).padStart(2, "0")}`;
  }

  return formatDateInputValue(target);
}

async function resolveQuery<T>(
  query: QueryResult<T>,
  {
    request,
    stage,
    logger,
    timeoutMs,
    timeZone,
  }: {
    request: ReportRequest;
    stage: string;
    logger: ReportLogger;
    timeoutMs: number;
    timeZone: string;
  },
) {
  const startedAt = Date.now();

  try {
    const result = await withTimeout(Promise.resolve(query), timeoutMs, "Tải dữ liệu báo cáo bị timeout");
    if (result.error) {
      throw result.error;
    }
    return result.data ?? [];
  } catch (error) {
    logger.error("report query failed", {
      operation: "query",
      stage,
      tab: request.tab,
      from: request.from,
      to: request.to,
      groupBy: request.groupBy,
      timeoutMs,
      timeZone,
      durationMs: Date.now() - startedAt,
      error,
    });
    throw error;
  }
}

async function getRevenueSnapshot(
  client: ReportClient,
  request: ReportRequest,
  deps: { logger: ReportLogger; timeoutMs: number; timeZone: string; signal?: AbortSignal },
): Promise<RevenueReportSnapshot> {
  const bounds = getRangeBounds(request.from, request.to);
  const [transactions, deals] = await Promise.all([
    resolveQuery<RevenueTransactionRow[]>(
      withAbortSignal(
        client
          .from<RevenueTransactionRow[]>("transactions")
          .select("created_at, total_amount, status")
          .gte("created_at", bounds.startIso)
          .lte("created_at", bounds.endIso),
        deps.signal,
      ).order("created_at", { ascending: true }),
      { request, stage: "transactions", ...deps },
    ),
    resolveQuery<RevenueDealRow[]>(
      withAbortSignal(
        client
          .from<RevenueDealRow[]>("deals")
          .select("created_at, stage, value")
          .gte("created_at", bounds.startIso)
          .lte("created_at", bounds.endIso),
        deps.signal,
      ).order("created_at", { ascending: true }),
      { request, stage: "deals", ...deps },
    ),
  ]);

  const completedTransactions = transactions.filter((transaction) => transaction.status === "completed");
  const grouped = completedTransactions.reduce<Record<string, { revenue: number; orders: number }>>(
    (acc, transaction) => {
      const key = periodKey(transaction.created_at, request.groupBy);
      acc[key] ??= { revenue: 0, orders: 0 };
      acc[key].revenue += normalizeNumber(transaction.total_amount);
      acc[key].orders += 1;
      return acc;
    },
    {},
  );

  const revenueSeries = Object.entries(grouped)
    .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
    .map(([period, value], index, rows) => {
      const previousRevenue = index > 0 ? rows[index - 1][1].revenue : 0;
      const growth =
        previousRevenue > 0
          ? Math.round(((value.revenue - previousRevenue) / previousRevenue) * 100)
          : 0;

      return {
        period,
        revenue: value.revenue,
        orders: value.orders,
        avg: value.orders ? Math.round(value.revenue / value.orders) : 0,
        growth,
      };
    });

  const revenueTotal = completedTransactions.reduce(
    (sum, item) => sum + normalizeNumber(item.total_amount),
    0,
  );
  const revenueAvg = completedTransactions.length ? revenueTotal / completedTransactions.length : 0;
  const maxOrder = completedTransactions.reduce(
    (max, item) => Math.max(max, normalizeNumber(item.total_amount)),
    0,
  );
  const pipelineValue = deals
    .filter((deal) => deal.stage !== "lost")
    .reduce((sum, deal) => sum + normalizeNumber(deal.value), 0);
  const closedDeals = deals.filter((deal) => deal.stage === "won" || deal.stage === "lost");
  const wonDeals = deals.filter((deal) => deal.stage === "won");

  return {
    tab: "revenue",
    revenueSeries,
    revenueTotal,
    revenueAvg,
    maxOrder,
    pipelineValue,
    winRate: closedDeals.length ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0,
  };
}

async function getCustomersSnapshot(
  client: ReportClient,
  request: ReportRequest,
  deps: { logger: ReportLogger; timeoutMs: number; timeZone: string; signal?: AbortSignal },
): Promise<CustomersReportSnapshot> {
  const bounds = getRangeBounds(request.from, request.to);
  const customers = await resolveQuery<CustomerReportRow[]>(
    withAbortSignal(
      client
        .from<CustomerReportRow[]>("customers")
        .select("created_at, customer_type, source")
        .eq("is_active", true)
        .is("deleted_at", null)
        .gte("created_at", bounds.startIso)
        .lte("created_at", bounds.endIso),
      deps.signal,
    ).order("created_at", { ascending: true }),
    { request, stage: "customers", ...deps },
  );

  const grouped = customers.reduce<Record<string, number>>((acc, customer) => {
    const key = periodKey(customer.created_at, request.groupBy);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return {
    tab: "customers",
    newCustomerSeries: Object.entries(grouped)
      .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
      .map(([period, count]) => ({ period, count })),
    sourceBreakdown: [
      { name: "Trực tiếp", value: customers.filter((item) => item.source === "direct").length, color: "#2563eb" },
      { name: "Marketing", value: customers.filter((item) => item.source === "marketing").length, color: "#10b981" },
      { name: "Giới thiệu", value: customers.filter((item) => item.source === "referral").length, color: "#f59e0b" },
      { name: "POS", value: customers.filter((item) => item.source === "pos").length, color: "#8b92a5" },
      { name: "Online", value: customers.filter((item) => item.source === "online").length, color: "#ef4444" },
    ],
    customerTypeRows: ["vip", "loyal", "potential", "new", "inactive"].map((type) => {
      const total = customers.filter((customer) => customer.customer_type === type).length;
      return {
        type,
        total,
        percent: customers.length ? Math.round((total / customers.length) * 100) : 0,
      };
    }),
  };
}

async function getTicketsSnapshot(
  client: ReportClient,
  request: ReportRequest,
  deps: { logger: ReportLogger; timeoutMs: number; timeZone: string; signal?: AbortSignal },
): Promise<TicketsReportSnapshot> {
  const bounds = getRangeBounds(request.from, request.to);
  const [tickets, tasks, users] = await Promise.all([
    resolveQuery<TicketReportRow[]>(
      withAbortSignal(
        client
          .from<TicketReportRow[]>("support_tickets")
          .select("created_at, resolved_at, category, assigned_to, status")
          .is("deleted_at", null)
          .gte("created_at", bounds.startIso)
          .lte("created_at", bounds.endIso),
        deps.signal,
      ).order("created_at", { ascending: true }),
      { request, stage: "support_tickets", ...deps },
    ),
    resolveQuery<TaskReportRow[]>(
      withAbortSignal(
        client
          .from<TaskReportRow[]>("tasks")
          .select("created_at, due_at, assigned_to, status")
          .eq("entity_type", "deal")
          .gte("created_at", bounds.startIso)
          .lte("created_at", bounds.endIso),
        deps.signal,
      ).order("created_at", { ascending: true }),
      { request, stage: "tasks", ...deps },
    ),
    resolveQuery<UserRow[]>(
      withAbortSignal(
        client.from<UserRow[]>("profiles").select("id, full_name"),
        deps.signal,
      ).order("full_name", { ascending: true }),
      { request, stage: "profiles", ...deps },
    ),
  ]);

  const resolved = tickets.filter((ticket) => ticket.resolved_at);
  const totalResolutionHours = resolved.reduce((sum, ticket) => {
    const start = new Date(ticket.created_at).getTime();
    const end = new Date(ticket.resolved_at ?? ticket.created_at).getTime();
    return sum + (end - start) / (1000 * 60 * 60);
  }, 0);
  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const overdueTasks = tasks.filter((task) => task.status === "overdue").length;

  return {
    tab: "tickets",
    avgResolutionHours: resolved.length ? totalResolutionHours / resolved.length : 0,
    completedTasks,
    overdueTasks,
    taskCompletionRate: tasks.length ? Math.round((completedTasks / tasks.length) * 100) : 0,
    ticketCategorySeries: [
      { category: "complaint", total: tickets.filter((item) => item.category === "complaint").length },
      { category: "feedback", total: tickets.filter((item) => item.category === "feedback").length },
      { category: "inquiry", total: tickets.filter((item) => item.category === "inquiry").length },
      { category: "return", total: tickets.filter((item) => item.category === "return").length },
    ],
    staffPerformance: users.map((user) => {
      const assigned = tickets.filter((ticket) => ticket.assigned_to === user.id);
      const resolvedTickets = assigned.filter(
        (ticket) => ticket.status === "resolved" || ticket.status === "closed",
      );
      const assignedTasks = tasks.filter((task) => task.assigned_to === user.id);
      const completed = assignedTasks.filter((task) => task.status === "done").length;
      const overdue = assignedTasks.filter((task) => task.status === "overdue").length;

      return {
        id: user.id,
        name: user.full_name,
        assigned: assigned.length,
        resolved: resolvedTickets.length,
        avgResponse: `${Math.max(1, 2 + assigned.length / 4).toFixed(1)} giờ`,
        tasksDone: completed,
        tasksOverdue: overdue,
      };
    }),
  };
}

async function getMarketingSnapshot(
  client: ReportClient,
  request: ReportRequest,
  deps: { logger: ReportLogger; timeoutMs: number; timeZone: string; signal?: AbortSignal },
): Promise<MarketingReportSnapshot> {
  const bounds = getRangeBounds(request.from, request.to);
  const [campaigns, messages] = await Promise.all([
    resolveQuery<CampaignRow[]>(
      withAbortSignal(
        client.from<CampaignRow[]>("campaigns").select("id, name, channel, status"),
        deps.signal,
      ).order("created_at", { ascending: false }),
      { request, stage: "campaigns", ...deps },
    ),
    resolveQuery<OutboundMessageRow[]>(
      withAbortSignal(
        client
          .from<OutboundMessageRow[]>("outbound_messages")
          .select("campaign_id, status, created_at")
          .gte("created_at", bounds.startIso)
          .lte("created_at", bounds.endIso),
        deps.signal,
      ).order("created_at", { ascending: false }),
      { request, stage: "outbound_messages", ...deps },
    ),
  ]);

  return {
    tab: "marketing",
    outboundTotals: {
      sent: messages.filter((message) =>
        ["sent", "delivered", "opened", "clicked"].includes(message.status ?? ""),
      ).length,
      opened: messages.filter((message) => ["opened", "clicked"].includes(message.status ?? "")).length,
      clicked: messages.filter((message) => message.status === "clicked").length,
      failed: messages.filter((message) => message.status === "failed").length,
    },
    campaignPerformance: campaigns.map((campaign) => {
      const related = messages.filter((message) => message.campaign_id === campaign.id);
      const sent = related.filter((message) =>
        ["sent", "delivered", "opened", "clicked"].includes(message.status ?? ""),
      ).length;
      const opened = related.filter((message) =>
        ["opened", "clicked"].includes(message.status ?? ""),
      ).length;
      const clicked = related.filter((message) => message.status === "clicked").length;
      const failed = related.filter((message) => message.status === "failed").length;

      return {
        id: campaign.id,
        name: campaign.name,
        channel: campaign.channel,
        sent,
        opened,
        clicked,
        failed,
        openRate: sent ? Math.round((opened / sent) * 100) : 0,
        clickRate: sent ? Math.round((clicked / sent) * 100) : 0,
        status: campaign.status,
      };
    }),
  };
}

export function createReportService({
  client,
  logger = reportLogger,
  timeoutMs = DEFAULT_REPORT_TIMEOUT_MS,
  getTimeZone = getClientTimeZone,
  ensureConfigured = ensureSupabaseConfigured,
}: ReportServiceDependencies) {
  return {
    getSnapshot(request: ReportRequest, options: ServiceRequestOptions = {}) {
      return withLatency(
        (async (): Promise<ReportSnapshot> => {
          ensureConfigured();
          const bounds = getRangeBounds(request.from, request.to);

          if (Number.isNaN(bounds.start) || Number.isNaN(bounds.end) || bounds.start > bounds.end) {
            throw new Error("Khoảng thời gian báo cáo không hợp lệ.");
          }

          const deps = {
            logger,
            timeoutMs,
            timeZone: getTimeZone(),
            signal: options.signal,
          };

          if (request.tab === "revenue") {
            return getRevenueSnapshot(client, request, deps);
          }

          if (request.tab === "customers") {
            return getCustomersSnapshot(client, request, deps);
          }

          if (request.tab === "tickets") {
            return getTicketsSnapshot(client, request, deps);
          }

          return getMarketingSnapshot(client, request, deps);
        })(),
        250,
      );
    },
  };
}

export const reportService = createReportService({
  client: supabase as unknown as ReportClient,
});
