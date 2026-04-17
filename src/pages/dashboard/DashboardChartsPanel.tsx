import { BarChart3, ChartSpline, ReceiptText, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { SectionPanel } from "@/components/shared/section-panel";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact, formatNumberCompact } from "@/lib/utils";
import type { DashboardRevenuePoint, DashboardStats } from "@/types";

const PRIMARY_STROKE = "hsl(var(--primary))";

function RevenueTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DashboardRevenuePoint }>;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="rounded-lg border border-[rgb(var(--border-medium-rgb))] bg-popover px-3 py-3 text-xs shadow-md">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {point.period}
      </div>
      <div className="mt-2 space-y-1.5 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Doanh thu</span>
          <span className="font-semibold text-foreground">{formatCurrencyCompact(point.revenue)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground">Đơn hoàn tất</span>
          <span className="font-semibold text-foreground">{formatNumberCompact(point.orders)}</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardChartsPanel({
  stats,
  rangeLabel,
}: {
  stats: DashboardStats;
  rangeLabel: string;
}) {
  const totalRevenue = stats.revenue_chart.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = stats.revenue_chart.reduce((sum, item) => sum + item.orders, 0);
  const averageRevenue = stats.revenue_chart.length ? totalRevenue / stats.revenue_chart.length : 0;

  return (
    <SectionPanel
      eyebrow="Nhịp doanh thu"
      title="Doanh thu hoàn tất"
      // description="Chart chính để đọc nhịp doanh thu và tốc độ chốt đơn."
      meta={<Badge className="bg-muted text-muted-foreground ring-border">{rangeLabel}</Badge>}
      className="min-w-0"
      contentClassName="space-y-4"
    >
        {stats.revenue_chart.length ? (
          <>
            <div className="h-[252px] min-w-0 rounded-lg border border-border bg-card p-5 shadow-xs">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <AreaChart data={stats.revenue_chart} margin={{ top: 10, right: 8, bottom: 0, left: -12 }}>
                  <defs>
                    <linearGradient id="dashboardRevenueFillCompact" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={PRIMARY_STROKE} stopOpacity={0.26} />
                      <stop offset="95%" stopColor={PRIMARY_STROKE} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="4 4"
                    stroke="rgb(var(--border-soft-rgb) / 1)"
                  />
                  <XAxis
                    dataKey="period"
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    tick={{ fontSize: 11, fill: "rgb(var(--text-muted-rgb) / 1)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    width={54}
                    tick={{ fontSize: 11, fill: "rgb(var(--text-muted-rgb) / 1)" }}
                    tickFormatter={(value) => formatNumberCompact(Number(value))}
                  />
                  <Tooltip
                    cursor={{ stroke: PRIMARY_STROKE, strokeDasharray: "4 4" }}
                    content={<RevenueTooltip />}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={PRIMARY_STROKE}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#dashboardRevenueFillCompact)"
                    activeDot={{ r: 4, fill: PRIMARY_STROKE, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <MetricStrip className="xl:grid-cols-3">
              <MetricStripItem
                label="Doanh thu trong kỳ"
                value={formatCurrencyCompact(totalRevenue)}
                helper="Tổng từ các giao dịch đã hoàn tất."
                icon={TrendingUp}
                tone="success"
              />
              <MetricStripItem
                label="Đơn hoàn tất"
                value={formatNumberCompact(totalOrders)}
                helper="Các đơn đang góp vào chart."
                icon={ReceiptText}
                tone="info"
              />
              <MetricStripItem
                label="Bình quân mỗi mốc"
                value={formatCurrencyCompact(averageRevenue)}
                helper="Mặt bằng doanh thu theo kỳ."
                icon={ChartSpline}
                tone="primary"
              />
            </MetricStrip>
          </>
        ) : (
          <EmptyState
            icon={BarChart3}
            title="Chưa có dữ liệu doanh thu"
            description="Khi có giao dịch hoàn tất trong khoảng thời gian đang chọn, biểu đồ doanh thu sẽ xuất hiện ở đây."
            className="min-h-[320px] border-dashed bg-transparent shadow-none"
          />
        )}
    </SectionPanel>
  );
}
