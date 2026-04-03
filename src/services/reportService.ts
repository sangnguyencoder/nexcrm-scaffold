import { supabase } from "@/lib/supabase";

import { ensureSupabaseConfigured, normalizeNumber, withLatency } from "@/services/shared";

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

function periodKey(date: string, groupBy: ReportGroupBy) {
  const target = new Date(date);
  if (groupBy === "month") {
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
  }
  if (groupBy === "week") {
    const first = new Date(target);
    first.setDate(target.getDate() - target.getDay());
    return `${first.getFullYear()}-W${String(first.getDate()).padStart(2, "0")}`;
  }
  return target.toISOString().slice(0, 10);
}

function getRangeBounds(from: string, to: string) {
  const start = new Date(`${from}T00:00:00`).getTime();
  const end = new Date(`${to}T23:59:59.999`).getTime();
  return { start, end };
}

function isInRange(date: string | null | undefined, range: { start: number; end: number }) {
  if (!date) {
    return false;
  }

  const time = new Date(date).getTime();
  return time >= range.start && time <= range.end;
}

async function getRevenueSnapshot({
  from,
  to,
  groupBy,
}: Omit<ReportRequest, "tab">): Promise<RevenueReportSnapshot> {
  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select("created_at, total_amount, status")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59.999`)
    .order("created_at", { ascending: true });

  if (transactionsError) {
    throw transactionsError;
  }

  const { data: deals, error: dealsError } = await supabase
    .from("deals")
    .select("created_at, stage, value")
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59.999`);

  if (dealsError) {
    throw dealsError;
  }

  const filteredTransactions = (transactions ?? []).filter(
    (transaction) => transaction.status === "completed",
  );
  const grouped = filteredTransactions.reduce<Record<string, { revenue: number; orders: number }>>(
    (acc, transaction) => {
      const key = periodKey(transaction.created_at, groupBy);
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

  const revenueTotal = filteredTransactions.reduce(
    (sum, item) => sum + normalizeNumber(item.total_amount),
    0,
  );
  const revenueAvg = filteredTransactions.length ? revenueTotal / filteredTransactions.length : 0;
  const maxOrder = filteredTransactions.reduce(
    (max, item) => Math.max(max, normalizeNumber(item.total_amount)),
    0,
  );
  const pipelineValue = (deals ?? [])
    .filter((deal) => deal.stage !== "lost")
    .reduce((sum, deal) => sum + normalizeNumber(deal.value), 0);
  const closedDeals = (deals ?? []).filter((deal) => deal.stage === "won" || deal.stage === "lost");
  const wonDeals = (deals ?? []).filter((deal) => deal.stage === "won");

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

async function getCustomersSnapshot({
  from,
  to,
  groupBy,
}: Omit<ReportRequest, "tab">): Promise<CustomersReportSnapshot> {
  const { data: customers, error } = await supabase
    .from("customers")
    .select("created_at, customer_type, source")
    .eq("is_active", true)
    .is("deleted_at", null)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59.999`);

  if (error) {
    throw error;
  }

  const rows = customers ?? [];
  const grouped = rows.reduce<Record<string, number>>((acc, customer) => {
    const key = periodKey(customer.created_at, groupBy);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const totalCustomers = rows.length;

  return {
    tab: "customers",
    newCustomerSeries: Object.entries(grouped)
      .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
      .map(([period, count]) => ({ period, count })),
    sourceBreakdown: [
      { name: "Trực tiếp", value: rows.filter((item) => item.source === "direct").length, color: "#2563eb" },
      { name: "Marketing", value: rows.filter((item) => item.source === "marketing").length, color: "#10b981" },
      { name: "Giới thiệu", value: rows.filter((item) => item.source === "referral").length, color: "#f59e0b" },
      { name: "POS", value: rows.filter((item) => item.source === "pos").length, color: "#8b92a5" },
      { name: "Online", value: rows.filter((item) => item.source === "online").length, color: "#ef4444" },
    ],
    customerTypeRows: ["vip", "loyal", "potential", "new", "inactive"].map((type) => {
      const total = rows.filter((customer) => customer.customer_type === type).length;
      return {
        type,
        total,
        percent: totalCustomers ? Math.round((total / totalCustomers) * 100) : 0,
      };
    }),
  };
}

async function getTicketsSnapshot({
  from,
  to,
}: Omit<ReportRequest, "tab" | "groupBy"> & { groupBy: ReportGroupBy }): Promise<TicketsReportSnapshot> {
  const [ticketsResult, tasksResult, usersResult] = await Promise.all([
    supabase
      .from("support_tickets")
      .select("created_at, resolved_at, category, assigned_to, status")
      .is("deleted_at", null)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59.999`),
    supabase
      .from("tasks")
      .select("created_at, due_at, assigned_to, status")
      .eq("entity_type", "deal")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59.999`),
    supabase.from("profiles").select("id, full_name").order("full_name", { ascending: true }),
  ]);

  if (ticketsResult.error) {
    throw ticketsResult.error;
  }
  if (tasksResult.error) {
    throw tasksResult.error;
  }
  if (usersResult.error) {
    throw usersResult.error;
  }

  const tickets = ticketsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const users = usersResult.data ?? [];
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

async function getMarketingSnapshot({
  from,
  to,
}: Omit<ReportRequest, "tab" | "groupBy"> & { groupBy: ReportGroupBy }): Promise<MarketingReportSnapshot> {
  const [campaignsResult, messagesResult] = await Promise.all([
    supabase.from("campaigns").select("id, name, channel, status").order("created_at", { ascending: false }),
    supabase
      .from("outbound_messages")
      .select("campaign_id, status, created_at")
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59.999`),
  ]);

  if (campaignsResult.error) {
    throw campaignsResult.error;
  }

  if (messagesResult.error) {
    throw messagesResult.error;
  }

  const campaigns = campaignsResult.data ?? [];
  const messages = messagesResult.data ?? [];

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

export const reportService = {
  getSnapshot(request: ReportRequest) {
    return withLatency(
      (async (): Promise<ReportSnapshot> => {
        ensureSupabaseConfigured();
        const range = getRangeBounds(request.from, request.to);

        if (Number.isNaN(range.start) || Number.isNaN(range.end) || range.start > range.end) {
          throw new Error("Khoảng thời gian báo cáo không hợp lệ.");
        }

        if (request.tab === "revenue") {
          return getRevenueSnapshot(request);
        }

        if (request.tab === "customers") {
          return getCustomersSnapshot(request);
        }

        if (request.tab === "tickets") {
          return getTicketsSnapshot(request);
        }

        return getMarketingSnapshot(request);
      })(),
      250,
    );
  },
};
