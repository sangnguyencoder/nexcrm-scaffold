import { AlertCircle, ArrowUpRight, Users, Wallet } from "lucide-react";
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
import { useDashboardStats } from "@/hooks/useNexcrmQueries";
import {
  cn,
  formatCurrencyCompact,
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

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  vip: "VIP",
  loyal: "Thân thiết",
  potential: "Tiềm năng",
  new: "Mới",
  inactive: "Không hoạt động",
};

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
    <div className="toolbar-shell p-1">
      {RANGE_OPTIONS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition",
            range === item.key
              ? "bg-foreground text-background shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          aria-pressed={range === item.key}
        >
          {item.label}
        </button>
      ))}
      <Badge className="bg-muted text-muted-foreground ring-border">
        {isFetching ? "Đang đồng bộ" : "Đã đồng bộ"}
      </Badge>
    </div>
  );
}

function formatDistributionLabel(type: string) {
  return CUSTOMER_TYPE_LABELS[type as CustomerType] ?? type;
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
    const dominantSegment = [...stats.customer_type_distribution].sort((left, right) => right.count - left.count)[0];

    return {
      resolutionRate,
      averageOrderValue,
      dominantSegment,
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
        <MetricStripItem
          label="Tổng khách hàng"
          value={formatNumberCompact(stats.total_customers)}
          helper={`${stats.new_customers_month} khách mới từ đầu tháng`}
        />
        <MetricStripItem
          label="Doanh thu tháng"
          value={formatCurrencyCompact(stats.total_revenue_month)}
          helper={`${stats.total_orders_month} đơn đã hoàn tất`}
        />
        <MetricStripItem
          label="Đơn trung bình"
          value={formatCurrencyCompact(derived.averageOrderValue)}
          helper={`Theo khung ${rangeLabel.toLowerCase()}`}
        />
        <MetricStripItem
          label="Tỷ lệ xử lý ticket"
          value={formatPercent(derived.resolutionRate)}
          helper={`${stats.open_tickets} ticket đang mở`}
        />
      </MetricStrip>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.95fr)]">
        <Suspense fallback={<PageLoader panels={1} />}>
          <DashboardChartsPanel stats={stats} rangeLabel={rangeLabel} />
        </Suspense>

        <SectionPanel
          eyebrow="Support queue"
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
                  className="w-full rounded-lg border border-border/70 px-3 py-2.5 text-left transition hover:bg-muted/35"
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
          eyebrow="Customer value"
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
                  <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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
          eyebrow="Customer mix"
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
