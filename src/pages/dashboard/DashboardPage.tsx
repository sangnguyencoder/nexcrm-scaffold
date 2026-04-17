import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  Minus,
  RefreshCw,
  TicketCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Suspense, lazy, startTransition, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionPanel } from "@/components/shared/section-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { useDashboardStats, useReportSnapshot } from "@/hooks/useNexcrmQueries";
import {
  cn,
  formatCurrencyCompact,
  formatDateInputValue,
  formatNumberCompact,
  formatCustomerType,
  formatPercent,
  formatTicketPriority,
  getCustomerTypeColor,
  getPriorityColor,
  timeAgo,
} from "@/lib/utils";
import { getAppErrorMessage } from "@/services/shared";
import type { CustomerType, DashboardDistributionPoint, TicketPriority } from "@/types";

const DashboardChartsPanel = lazy(() =>
  import("@/pages/dashboard/DashboardChartsPanel").then((module) => ({
    default: module.DashboardChartsPanel,
  })),
);

type DashboardRange = "today" | "7days" | "30days";

const RANGE_OPTIONS: Array<{ key: DashboardRange; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "7days", label: "7 ngày" },
  { key: "30days", label: "30 ngày" },
];

const RANGE_DAYS: Record<DashboardRange, number> = {
  today: 1,
  "7days": 7,
  "30days": 30,
};

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  vip: "VIP",
  loyal: "Thân thiết",
  potential: "Tiềm năng",
  new: "Mới",
  inactive: "Không hoạt động",
};

type DeltaInsight = {
  tone: "up" | "down" | "flat";
  deltaLabel: string;
  detail: string;
};

function buildRangeWindows(range: DashboardRange) {
  const totalDays = RANGE_DAYS[range];
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const currentStart = new Date(now);
  currentStart.setDate(currentStart.getDate() - (totalDays - 1));
  currentStart.setHours(0, 0, 0, 0);

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(previousEnd.getDate() - 1);
  previousEnd.setHours(23, 59, 59, 999);

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - (totalDays - 1));
  previousStart.setHours(0, 0, 0, 0);

  return {
    current: {
      from: formatDateInputValue(currentStart),
      to: formatDateInputValue(now),
    },
    previous: {
      from: formatDateInputValue(previousStart),
      to: formatDateInputValue(previousEnd),
    },
    previousLabel:
      range === "today" ? "hôm qua" : range === "7days" ? "7 ngày trước" : "30 ngày trước",
  };
}

function buildDeltaInsight({
  current,
  previous,
  previousLabel,
  suffix,
}: {
  current: number;
  previous: number;
  previousLabel: string;
  suffix: string;
}): DeltaInsight | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  if (previous === 0) {
    if (current === 0) {
      return {
        tone: "flat",
        deltaLabel: "0%",
        detail: `Không đổi so với ${previousLabel}`,
      };
    }

    return {
      tone: current > 0 ? "up" : "down",
      deltaLabel: "Mới phát sinh",
      detail: `${suffix} so với ${previousLabel}`,
    };
  }

  const deltaPercent = ((current - previous) / Math.abs(previous)) * 100;
  const normalized = Math.round(deltaPercent * 10) / 10;
  const tone: DeltaInsight["tone"] =
    normalized > 0.2 ? "up" : normalized < -0.2 ? "down" : "flat";
  const sign = normalized > 0 ? "+" : "";

  return {
    tone,
    deltaLabel: `${sign}${normalized}%`,
    detail: `${suffix} so với ${previousLabel}`,
  };
}

function buildRateInsight({
  current,
  previous,
  previousLabel,
}: {
  current: number;
  previous: number;
  previousLabel: string;
}): DeltaInsight | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return null;
  }

  const deltaPoint = (current - previous) * 100;
  const normalized = Math.round(deltaPoint * 10) / 10;
  const sign = normalized > 0 ? "+" : "";

  return {
    tone: normalized > 0.2 ? "up" : normalized < -0.2 ? "down" : "flat",
    deltaLabel: `${sign}${normalized}đ`,
    detail: `điểm % so với ${previousLabel}`,
  };
}

function InsightText({
  insight,
  fallback,
}: {
  insight: DeltaInsight | null;
  fallback: string;
}) {
  if (!insight) {
    return <span>{fallback}</span>;
  }

  const Icon = insight.tone === "up" ? ArrowUpRight : insight.tone === "down" ? ArrowDownRight : Minus;
  const toneClassName =
    insight.tone === "up"
      ? "bg-success/12 text-success"
      : insight.tone === "down"
        ? "bg-destructive/12 text-destructive"
        : "bg-muted text-muted-foreground";

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", toneClassName)}>
        <Icon className="size-3" />
        {insight.deltaLabel}
      </span>
      <span className="text-muted-foreground">{insight.detail}</span>
    </span>
  );
}

function RangeSwitcher({
  range,
  isFetching,
  onChange,
}: {
  range: DashboardRange;
  isFetching: boolean;
  onChange: (range: DashboardRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {RANGE_OPTIONS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold transition-colors",
            range === item.key
              ? "border-primary/35 bg-primary/12 text-primary shadow-xs"
              : "border-border text-muted-foreground hover:bg-muted/70 hover:text-foreground",
          )}
          aria-pressed={range === item.key}
        >
          {item.label}
        </button>
      ))}
      <Badge
        className={cn(
          "inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1",
          isFetching
            ? "bg-info/10 text-info ring-info/20 animate-pulse"
            : "bg-success/10 text-success ring-success/20",
        )}
      >
        {isFetching ? <RefreshCw className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        {isFetching ? "Đang đồng bộ" : "Đã đồng bộ"}
      </Badge>
    </div>
  );
}

function formatDistributionLabel(type: string) {
  return CUSTOMER_TYPE_LABELS[type as CustomerType] ?? type;
}

function getPriorityBorderClass(priority: TicketPriority) {
  if (priority === "urgent") return "border-l-destructive";
  if (priority === "high") return "border-l-warning";
  if (priority === "medium") return "border-l-info";
  return "border-l-[rgb(var(--border-medium-rgb)/1)]";
}

function CustomerMixRow({
  item,
  total,
}: {
  item: DashboardDistributionPoint;
  total: number;
}) {
  const share = total ? Math.round((item.count / total) * 100) : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg border border-border/70 bg-muted/35 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
        <span className="truncate text-sm font-medium text-foreground">{formatDistributionLabel(item.type)}</span>
      </div>
      <span className="text-sm font-semibold text-foreground">{formatNumberCompact(item.count)}</span>
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{share}%</span>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<DashboardRange>("7days");
  const statsQuery = useDashboardStats(range);
  const rangeWindows = useMemo(() => buildRangeWindows(range), [range]);
  const currentRevenueQuery = useReportSnapshot({
    tab: "revenue",
    from: rangeWindows.current.from,
    to: rangeWindows.current.to,
    groupBy: "day",
  });
  const previousRevenueQuery = useReportSnapshot({
    tab: "revenue",
    from: rangeWindows.previous.from,
    to: rangeWindows.previous.to,
    groupBy: "day",
  });
  const currentCustomersQuery = useReportSnapshot({
    tab: "customers",
    from: rangeWindows.current.from,
    to: rangeWindows.current.to,
    groupBy: "day",
  });
  const previousCustomersQuery = useReportSnapshot({
    tab: "customers",
    from: rangeWindows.previous.from,
    to: rangeWindows.previous.to,
    groupBy: "day",
  });
  const currentTicketsQuery = useReportSnapshot({
    tab: "tickets",
    from: rangeWindows.current.from,
    to: rangeWindows.current.to,
    groupBy: "day",
  });
  const previousTicketsQuery = useReportSnapshot({
    tab: "tickets",
    from: rangeWindows.previous.from,
    to: rangeWindows.previous.to,
    groupBy: "day",
  });
  const stats = statsQuery.data;
  const rangeLabel = RANGE_OPTIONS.find((item) => item.key === range)?.label ?? "7 ngày";

  const derived = useMemo(() => {
    if (!stats) {
      return null;
    }

    const totalTicketFlow = stats.open_tickets + stats.resolved_tickets_month;
    const resolutionRate = totalTicketFlow > 0 ? stats.resolved_tickets_month / totalTicketFlow : 0;
    const averageOrderValue =
      stats.total_orders_month > 0 ? stats.total_revenue_month / stats.total_orders_month : 0;

    return {
      resolutionRate,
      averageOrderValue,
    };
  }, [stats]);

  if (!stats && statsQuery.isLoading) {
    return <PageLoader panels={2} />;
  }

  if (statsQuery.error) {
    return (
      <PageErrorState
        title="Không thể tải dashboard"
        description={getAppErrorMessage(
          statsQuery.error,
          "Dữ liệu tổng quan chưa tải được. Vui lòng thử lại để đồng bộ doanh thu, khách hàng và ticket.",
        )}
        onRetry={() => void statsQuery.refetch()}
      />
    );
  }

  if (!stats || !derived) {
    return <PageLoader panels={2} />;
  }

  const currentRevenueSnapshot = currentRevenueQuery.data?.tab === "revenue" ? currentRevenueQuery.data : null;
  const previousRevenueSnapshot = previousRevenueQuery.data?.tab === "revenue" ? previousRevenueQuery.data : null;
  const currentCustomersSnapshot = currentCustomersQuery.data?.tab === "customers" ? currentCustomersQuery.data : null;
  const previousCustomersSnapshot = previousCustomersQuery.data?.tab === "customers" ? previousCustomersQuery.data : null;
  const currentTicketsSnapshot = currentTicketsQuery.data?.tab === "tickets" ? currentTicketsQuery.data : null;
  const previousTicketsSnapshot = previousTicketsQuery.data?.tab === "tickets" ? previousTicketsQuery.data : null;

  const currentNewCustomers = currentCustomersSnapshot?.newCustomerSeries.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const previousNewCustomers = previousCustomersSnapshot?.newCustomerSeries.reduce((sum, item) => sum + item.count, 0) ?? 0;

  const revenueInRange = currentRevenueSnapshot?.revenueTotal ?? stats.total_revenue_month;
  const previousRevenueInRange = previousRevenueSnapshot?.revenueTotal ?? 0;
  const averageOrderInRange = currentRevenueSnapshot?.revenueAvg ?? derived.averageOrderValue;
  const previousAverageOrderInRange = previousRevenueSnapshot?.revenueAvg ?? 0;

  const currentAssignedTickets = currentTicketsSnapshot?.staffPerformance.reduce((sum, row) => sum + row.assigned, 0) ?? 0;
  const previousAssignedTickets = previousTicketsSnapshot?.staffPerformance.reduce((sum, row) => sum + row.assigned, 0) ?? 0;
  const currentResolvedTickets = currentTicketsSnapshot?.staffPerformance.reduce((sum, row) => sum + row.resolved, 0) ?? 0;
  const previousResolvedTickets = previousTicketsSnapshot?.staffPerformance.reduce((sum, row) => sum + row.resolved, 0) ?? 0;
  const currentResolutionRate =
    currentAssignedTickets > 0 ? currentResolvedTickets / currentAssignedTickets : derived.resolutionRate;
  const previousResolutionRate =
    previousAssignedTickets > 0 ? previousResolvedTickets / previousAssignedTickets : 0;

  const customerInsight = buildDeltaInsight({
    current: currentNewCustomers,
    previous: previousNewCustomers,
    previousLabel: rangeWindows.previousLabel,
    suffix: "khách mới",
  });
  const revenueInsight = buildDeltaInsight({
    current: revenueInRange,
    previous: previousRevenueInRange,
    previousLabel: rangeWindows.previousLabel,
    suffix: "doanh thu",
  });
  const averageOrderInsight = buildDeltaInsight({
    current: averageOrderInRange,
    previous: previousAverageOrderInRange,
    previousLabel: rangeWindows.previousLabel,
    suffix: "giá trị đơn trung bình",
  });
  const ticketInsight = buildRateInsight({
    current: currentResolutionRate,
    previous: previousResolutionRate,
    previousLabel: rangeWindows.previousLabel,
  });

  return (
    <div className="enterprise-grid">
      <PageHeader
        title="Tổng quan vận hành"
        // subtitle="Một màn hình để đọc doanh thu, queue hỗ trợ và nhóm khách hàng quan trọng nhất."
        actions={
          <RangeSwitcher
            range={range}
            isFetching={statsQuery.isFetching}
            onChange={(nextRange) =>
              startTransition(() => {
                setRange(nextRange);
              })
            }
          />
        }
      />

      <MetricStrip>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <MetricStripItem
            label="Tổng khách hàng"
            value={formatNumberCompact(stats.total_customers)}
            helper={
              <InsightText
                insight={customerInsight}
                fallback={`${stats.new_customers_month} khách mới từ đầu tháng`}
              />
            }
            icon={Users}
            tone="info"
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-delay:70ms]">
          <MetricStripItem
            label="Doanh thu hoàn tất"
            value={formatCurrencyCompact(revenueInRange)}
            helper={
              <InsightText
                insight={revenueInsight}
                fallback={`${stats.total_orders_month} đơn đã hoàn tất`}
              />
            }
            icon={Wallet}
            tone="success"
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-delay:120ms]">
          <MetricStripItem
            label="Đơn trung bình"
            value={formatCurrencyCompact(averageOrderInRange)}
            helper={
              <InsightText
                insight={averageOrderInsight}
                fallback={`Theo khung ${rangeLabel.toLowerCase()}`}
              />
            }
            icon={CircleDollarSign}
            tone="primary"
          />
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-delay:180ms]">
          <MetricStripItem
            label="Tỷ lệ xử lý ticket"
            value={formatPercent(currentResolutionRate)}
            helper={
              <InsightText
                insight={ticketInsight}
                fallback={`${stats.open_tickets} ticket đang mở`}
              />
            }
            icon={TicketCheck}
            tone="warning"
          />
        </div>
      </MetricStrip>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Suspense fallback={<PageLoader panels={1} />}>
          <DashboardChartsPanel stats={stats} rangeLabel={rangeLabel} />
        </Suspense>

        <SectionPanel
          eyebrow="Vận hành hỗ trợ"
          title="Ticket ưu tiên"
          // description="Các yêu cầu cần đụng vào trước."
          meta={<Badge className="bg-muted text-muted-foreground ring-border">{stats.urgent_tickets.length} ticket</Badge>}
          contentClassName="space-y-2"
        >
            {stats.urgent_tickets.length ? (
              stats.urgent_tickets.slice(0, 4).map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                  className={cn(
                    "w-full rounded-lg border border-border border-l-2 px-3 py-2.5 text-left transition hover:bg-muted/35",
                    getPriorityBorderClass(ticket.priority as TicketPriority),
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-medium text-foreground">{ticket.title}</div>
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        {ticket.customer_name || "Khách hàng chưa xác định"}
                      </div>
                    </div>
                    <StatusBadge
                      label={formatTicketPriority(ticket.priority as TicketPriority)}
                      className={getPriorityColor(ticket.priority as TicketPriority)}
                      dotClassName="bg-current"
                      icon={AlertCircle}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{timeAgo(ticket.created_at)}</span>
                    <span>Xem</span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyState
                icon={AlertCircle}
                title="Không có ticket khẩn cấp"
                description="Hàng đợi hỗ trợ hiện chưa có ticket ưu tiên cao hoặc khẩn cấp."
                className="min-h-[240px] border-dashed bg-transparent shadow-none"
              />
            )}
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.9fr)]">
        <SectionPanel
          eyebrow="Giá trị khách hàng"
          title="Top khách hàng"
          // description="Những tài khoản nên ưu tiên giữ nhịp."
          meta={<Badge className="bg-muted text-muted-foreground ring-border">Top {stats.top_customers.length}</Badge>}
          contentClassName="space-y-1.5 p-0 lg:p-0"
        >
            {stats.top_customers.length ? (
              stats.top_customers.map((customer, index) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 px-4 py-3 text-left transition hover:bg-muted/35 last:border-b-0 lg:px-5"
                >
                  <span className="tabular-nums text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 items-center gap-3">
                    <CustomerAvatar name={customer.full_name} type={customer.customer_type} className="size-10 text-sm" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{customer.full_name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{customer.customer_code}</span>
                        <span className="text-border">/</span>
                        <span>{formatCustomerType(customer.customer_type)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground">{formatCurrencyCompact(customer.total_spent)}</div>
                      <Badge className={cn("mt-1", getCustomerTypeColor(customer.customer_type))}>
                        {formatDistributionLabel(customer.customer_type)}
                      </Badge>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 lg:p-5">
                <EmptyState
                  icon={Users}
                  title="Chưa có khách hàng nổi bật"
                  description="Khi phát sinh dữ liệu giao dịch, khu vực này sẽ hiển thị các tài khoản nên ưu tiên giữ nhịp."
                  className="min-h-[220px] border-dashed bg-transparent shadow-none"
                />
              </div>
            )}
        </SectionPanel>

        <SectionPanel
          eyebrow="Cơ cấu khách hàng"
          title="Cơ cấu khách hàng"
          // description={
          //   derived.dominantSegment
          //     ? `${formatDistributionLabel(derived.dominantSegment.type)} đang chiếm tỷ trọng lớn nhất.`
          //     : "Danh mục khách hàng theo phân loại hiện tại."
          // }
          meta={<Badge className="bg-muted text-muted-foreground ring-border">{formatNumberCompact(stats.total_customers)} hồ sơ</Badge>}
          contentClassName="space-y-2"
        >
            {stats.customer_type_distribution.length ? (
              stats.customer_type_distribution.map((item) => (
                <CustomerMixRow
                  key={item.type}
                  item={item}
                  total={stats.customer_type_distribution.reduce((sum, entry) => sum + entry.count, 0)}
                />
              ))
            ) : (
              <EmptyState
                icon={Wallet}
                title="Chưa có dữ liệu phân nhóm"
                description="Khi dữ liệu khách hàng đầy đủ hơn, cơ cấu theo phân loại sẽ hiển thị tại đây."
                className="min-h-[220px] border-dashed bg-transparent shadow-none"
              />
            )}
        </SectionPanel>
      </div>
    </div>
  );
}
