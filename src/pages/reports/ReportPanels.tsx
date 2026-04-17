import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  BadgePercent,
  ChartNoAxesCombined,
  CircleCheckBig,
  CircleDollarSign,
  MailCheck,
  MailWarning,
  ShoppingCart,
  UsersRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { SectionHeaderCompact } from "@/components/shared/section-header-compact";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrencyCompact, formatNumberCompact, formatCurrency } from "@/lib/utils";
import type {
  CustomersReportSnapshot,
  MarketingReportSnapshot,
  ReportSnapshot,
  RevenueReportSnapshot,
  TicketsReportSnapshot,
} from "@/services/reportService";

function ChartPanel({
  title,
  description,
  children,
  meta,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  meta?: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="compact-panel-header">
        <SectionHeaderCompact title={title} description={description} meta={meta} />
      </CardHeader>
      <CardContent className="h-[260px] min-w-0 p-4 lg:p-5">{children}</CardContent>
    </Card>
  );
}

const subtleBadgeClassName = "bg-muted text-muted-foreground ring-border";

function EmptyChart({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState
      icon={BarChart3}
      title={title}
      description={description}
      className="min-h-[220px] border-dashed bg-transparent shadow-none"
    />
  );
}

function CustomTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/80 bg-popover px-3 py-2 text-xs shadow-panel">
      {label ? <div className="font-semibold text-foreground">{label}</div> : null}
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div key={`${item.name}-${item.value}`} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.name}</span>
            </div>
            <span className="font-medium text-foreground">
              {typeof item.value === "number" ? valueFormatter?.(item.value) ?? formatNumberCompact(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryTable({
  title,
  description,
  headers,
  rows,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: Array<{ key: string; cells: React.ReactNode[]; sortValues?: Array<string | number | null | undefined> }>;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [sortIndex, setSortIndex] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRows = useMemo(() => {
    if (sortIndex === null) {
      return rows;
    }

    const hasSortableValue = rows.some((row) => row.sortValues?.[sortIndex] !== undefined && row.sortValues?.[sortIndex] !== null);
    if (!hasSortableValue) {
      return rows;
    }

    const clone = [...rows];
    clone.sort((leftRow, rightRow) => {
      const left = leftRow.sortValues?.[sortIndex];
      const right = rightRow.sortValues?.[sortIndex];

      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;

      const result =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "vi", {
              numeric: true,
              sensitivity: "base",
            });

      return sortDirection === "asc" ? result : -result;
    });
    return clone;
  }, [rows, sortDirection, sortIndex]);

  return (
    <DataTableShell stickyHeader>
      <div className="border-b border-border/70 px-4 py-3 lg:px-5">
        <SectionHeaderCompact title={title} description={description} />
      </div>
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header, index) => {
                const sortable = rows.some(
                  (row) => row.sortValues?.[index] !== undefined && row.sortValues?.[index] !== null,
                );
                const active = sortIndex === index;

                return (
                  <TableHead key={header}>
                    {sortable ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 transition hover:text-foreground"
                        onClick={() => {
                          if (active) {
                            setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                            return;
                          }

                          setSortIndex(index);
                          setSortDirection("desc");
                        }}
                      >
                        <span>{header}</span>
                        {active ? (
                          sortDirection === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUp className="size-3.5" />
                          )
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-75" />
                        )}
                      </button>
                    ) : (
                      header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow key={row.key}>
                {row.cells.map((cell, index) => (
                  <TableCell key={`${row.key}-${index}`}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-4 lg:p-5">
          <EmptyState
            icon={BarChart3}
            title={emptyTitle}
            description={emptyDescription}
            className="min-h-[220px] border-dashed bg-transparent shadow-none"
          />
        </div>
      )}
    </DataTableShell>
  );
}

export function RevenuePanel({
  snapshot,
  previousSnapshot,
}: {
  snapshot: RevenueReportSnapshot;
  previousSnapshot?: RevenueReportSnapshot | null;
}) {
  const bestPeriod = snapshot.revenueSeries.reduce(
    (current, item) => (item.revenue > current.revenue ? item : current),
    snapshot.revenueSeries[0] ?? { period: "--", revenue: 0, orders: 0, avg: 0, growth: 0 },
  );

  return (
    <div className="space-y-4">
      <MetricStrip className="xl:grid-cols-5">
        <MetricStripItem
          label="Tổng doanh thu"
          value={formatCurrencyCompact(snapshot.revenueTotal)}
          helper={<ComparisonText current={snapshot.revenueTotal} previous={previousSnapshot?.revenueTotal} suffix="doanh thu" />}
          icon={CircleDollarSign}
          tone="success"
        />
        <MetricStripItem
          label="TB mỗi đơn"
          value={formatCurrencyCompact(snapshot.revenueAvg)}
          helper={<ComparisonText current={snapshot.revenueAvg} previous={previousSnapshot?.revenueAvg} suffix="giá trị đơn" />}
          icon={ShoppingCart}
          tone="primary"
        />
        <MetricStripItem
          label="Đơn lớn nhất"
          value={formatCurrencyCompact(snapshot.maxOrder)}
          helper={<ComparisonText current={snapshot.maxOrder} previous={previousSnapshot?.maxOrder} suffix="đơn hàng lớn nhất" />}
          icon={ChartNoAxesCombined}
          tone="info"
        />
        <MetricStripItem
          label="Pipeline mở"
          value={formatCurrencyCompact(snapshot.pipelineValue)}
          helper={<ComparisonText current={snapshot.pipelineValue} previous={previousSnapshot?.pipelineValue} suffix="pipeline mở" />}
          icon={BarChart3}
          tone="warning"
        />
        <MetricStripItem
          label="Tỉ lệ thắng"
          value={`${snapshot.winRate}%`}
          helper={<ComparisonText current={snapshot.winRate} previous={previousSnapshot?.winRate} suffix="tỉ lệ thắng" pointMode />}
          icon={BadgePercent}
          tone="primary"
        />
      </MetricStrip>

      <div className="grid gap-4 xl:grid-cols-[1.8fr,1fr]">
        <ChartPanel
          title="Xu hướng doanh thu"
          description="" //Chart chính để xem nhịp tăng trưởng sau khi đọc bảng.
          meta={<Badge className={subtleBadgeClassName}>Top kỳ: {bestPeriod.period}</Badge>}
        >
          {snapshot.revenueSeries.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={snapshot.revenueSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={(value) => formatNumberCompact(Number(value))}
                />
                <Tooltip content={<CustomTooltip valueFormatter={(value) => formatCurrency(value)} />} />
                <Legend />
                <Bar dataKey="revenue" name="Doanh thu" fill="#2563eb" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart title="Không có dữ liệu chart" description="Bảng tóm tắt vẫn hiển thị, nhưng chart cần có ít nhất 1 kỳ dữ liệu." />
          )}
        </ChartPanel>

        <Card>
          <CardHeader className="compact-panel-header">
            <SectionHeaderCompact
              title="Điểm nhấn"
              // description="Các số cần quyết định nhanh bước tiếp theo."
            />
          </CardHeader>
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Kỳ tốt nhất</div>
              <div className="mt-2 font-semibold text-foreground">{bestPeriod.period}</div>
              <div className="text-xs text-muted-foreground">{formatCurrencyCompact(bestPeriod.revenue)} từ {formatNumberCompact(bestPeriod.orders)} đơn</div>
            </div>
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nhịp tăng trưởng</div>
              <div className="mt-2 font-semibold text-foreground">{snapshot.revenueSeries.at(-1)?.growth ?? 0}%</div>
              <div className="text-xs text-muted-foreground">So với kỳ liền trước trong bảng trên.</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <SummaryTable
        title="Tóm tắt doanh thu theo kỳ"
        description="" //Bảng breakdown chi tiết sau khi đã xem chart tổng quan.
        headers={["Kỳ", "Doanh thu", "Đơn hàng", "TB / đơn", "Tăng trưởng"]}
        rows={snapshot.revenueSeries.map((row) => ({
          key: row.period,
          cells: [
            row.period,
            <span className="font-medium">{formatCurrency(row.revenue)}</span>,
            row.orders,
            formatCurrency(row.avg),
            <span className={row.growth >= 0 ? "text-emerald-600" : "text-rose-600"}>{row.growth}%</span>,
          ],
          sortValues: [row.period, row.revenue, row.orders, row.avg, row.growth],
        }))}
        emptyTitle="Chưa có dữ liệu doanh thu"
        emptyDescription="Chọn khoảng ngày khác hoặc thử đổi nhóm thời gian để xem số liệu."
      />
    </div>
  );
}

function ComparisonText({
  current,
  previous,
  suffix,
  inverse = false,
  pointMode = false,
  fallback = "Theo bộ lọc hiện tại.",
}: {
  current: number;
  previous?: number | null;
  suffix: string;
  inverse?: boolean;
  pointMode?: boolean;
  fallback?: string;
}) {
  if (!Number.isFinite(current) || previous == null || !Number.isFinite(previous)) {
    return <span>{fallback}</span>;
  }

  const rawDelta = pointMode ? current - previous : previous === 0 ? 0 : ((current - previous) / Math.abs(previous)) * 100;
  const normalized = Math.round(rawDelta * 10) / 10;
  const displaySign = normalized > 0 ? "+" : "";
  const effective = inverse ? -normalized : normalized;
  const toneClassName =
    effective > 0.2
      ? "bg-success/12 text-success"
      : effective < -0.2
        ? "bg-destructive/12 text-destructive"
        : "bg-muted text-muted-foreground";

  const Icon = effective > 0.2 ? ArrowUp : effective < -0.2 ? ArrowDown : ArrowUpDown;

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", toneClassName)}>
        <Icon className="size-3" />
        {pointMode ? `${displaySign}${normalized}đ` : `${displaySign}${normalized}%`}
      </span>
      <span className="text-muted-foreground">{suffix} so với kỳ trước</span>
    </span>
  );
}

export function CustomersPanel({
  snapshot,
  previousSnapshot,
}: {
  snapshot: CustomersReportSnapshot;
  previousSnapshot?: CustomersReportSnapshot | null;
}) {
  const totalNewCustomers = snapshot.newCustomerSeries.reduce((sum, item) => sum + item.count, 0);
  const previousTotalNewCustomers =
    previousSnapshot?.newCustomerSeries.reduce((sum, item) => sum + item.count, 0) ?? 0;
  const topSource = snapshot.sourceBreakdown.reduce(
    (current, item) => (item.value > current.value ? item : current),
    snapshot.sourceBreakdown[0] ?? { name: "--", value: 0, color: "#94a3b8" },
  );
  const previousTopSourceValue =
    previousSnapshot?.sourceBreakdown.find((item) => item.name === topSource.name)?.value ?? 0;
  const dominantSegmentTotal = snapshot.customerTypeRows[0]?.total ?? 0;
  const previousDominantSegmentTotal = previousSnapshot?.customerTypeRows[0]?.total ?? 0;
  const activeSourceCount = snapshot.sourceBreakdown.filter((item) => item.value > 0).length;
  const previousActiveSourceCount =
    previousSnapshot?.sourceBreakdown.filter((item) => item.value > 0).length ?? 0;

  return (
    <div className="space-y-4">
      <MetricStrip className="xl:grid-cols-4">
        <MetricStripItem
          label="Khách mới"
          value={formatNumberCompact(totalNewCustomers)}
          helper={<ComparisonText current={totalNewCustomers} previous={previousTotalNewCustomers} suffix="khách mới" />}
          icon={UsersRound}
          tone="info"
        />
        <MetricStripItem
          label="Nguồn chính"
          value={topSource.name}
          helper={<ComparisonText current={topSource.value} previous={previousTopSourceValue} suffix={`nguồn ${topSource.name}`} />}
          icon={ChartNoAxesCombined}
          tone="primary"
        />
        <MetricStripItem
          label="Phân khúc lớn nhất"
          value={snapshot.customerTypeRows[0]?.type ?? "--"}
          helper={<ComparisonText current={dominantSegmentTotal} previous={previousDominantSegmentTotal} suffix="quy mô phân khúc" />}
          icon={BadgePercent}
          tone="warning"
        />
        <MetricStripItem
          label="Số nguồn active"
          value={String(activeSourceCount)}
          helper={<ComparisonText current={activeSourceCount} previous={previousActiveSourceCount} suffix="số nguồn active" />}
          icon={BarChart3}
          tone="success"
        />
      </MetricStrip>

      <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
        <ChartPanel
          title="Khách hàng mới theo kỳ"
          description="" // Dùng để xem nhịp tăng trưởng sau khi đã chốt phân khúc trong bảng.
          meta={<Badge className={subtleBadgeClassName}>{snapshot.newCustomerSeries.length} mốc thời gian</Badge>}
        >
          {snapshot.newCustomerSeries.length ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={snapshot.newCustomerSeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
                <XAxis dataKey="period" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip content={<CustomTooltip valueFormatter={(value) => `${value} khách`} />} />
                <Legend />
                <Line type="monotone" dataKey="count" name="Khách mới" stroke="#2563eb" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart title="Chưa có chuỗi khách hàng mới" description="Dữ liệu sẽ xuất hiện khi có ít nhất 1 mốc tăng trưởng trong kỳ." />
          )}
        </ChartPanel>

        <ChartPanel
          title="Nguồn khách hàng"
          description="" // Legend và màu sắc được giữ tối giản để đọc nhanh.
          meta={<Badge className={subtleBadgeClassName}>{topSource.name}</Badge>}
        >
          {snapshot.sourceBreakdown.some((item) => item.value > 0) ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={snapshot.sourceBreakdown} dataKey="value" nameKey="name" innerRadius={56} outerRadius={88} paddingAngle={2}>
                  {snapshot.sourceBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip valueFormatter={(value) => `${value} khách`} />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart title="Chưa có breakdown nguồn" description="Không có đủ dữ liệu để vẽ pie chart cho nguồn khách hàng." />
          )}
        </ChartPanel>
      </div>

      <SummaryTable
        title="Cơ cấu khách hàng"
        description="" // Tập trung vào phân khúc và tỷ trọng thay vì mô tả dài.
        headers={["Phân loại", "Số lượng", "Tỷ trọng"]}
        rows={snapshot.customerTypeRows.map((row) => ({
          key: row.type,
          cells: [row.type, row.total, `${row.percent}%`],
          sortValues: [row.type, row.total, row.percent],
        }))}
        emptyTitle="Chưa có dữ liệu khách hàng"
        emptyDescription="Báo cáo này sẽ hiển thị khi có khách hàng mới trong khoảng ngày đã chọn."
      />
    </div>
  );
}

export function TicketsPanel({
  snapshot,
  previousSnapshot,
}: {
  snapshot: TicketsReportSnapshot;
  previousSnapshot?: TicketsReportSnapshot | null;
}) {
  return (
    <div className="space-y-4">
      <MetricStrip className="xl:grid-cols-4">
        <MetricStripItem
          label="TB xử lý"
          value={`${snapshot.avgResolutionHours.toFixed(1)} giờ`}
          helper={<ComparisonText current={snapshot.avgResolutionHours} previous={previousSnapshot?.avgResolutionHours} suffix="thời gian xử lý" inverse />}
          icon={ChartNoAxesCombined}
          tone="info"
        />
        <MetricStripItem
          label="Task hoàn thành"
          value={formatNumberCompact(snapshot.completedTasks)}
          helper={<ComparisonText current={snapshot.completedTasks} previous={previousSnapshot?.completedTasks} suffix="task hoàn thành" />}
          icon={CircleCheckBig}
          tone="success"
        />
        <MetricStripItem
          label="Task quá hạn"
          value={formatNumberCompact(snapshot.overdueTasks)}
          helper={<ComparisonText current={snapshot.overdueTasks} previous={previousSnapshot?.overdueTasks} suffix="task quá hạn" inverse />}
          icon={MailWarning}
          tone="danger"
        />
        <MetricStripItem
          label="Tỷ lệ hoàn thành"
          value={`${snapshot.taskCompletionRate}%`}
          helper={<ComparisonText current={snapshot.taskCompletionRate} previous={previousSnapshot?.taskCompletionRate} suffix="tỷ lệ hoàn thành" pointMode />}
          icon={BadgePercent}
          tone="primary"
        />
      </MetricStrip>

      <ChartPanel
        title="Phân bố ticket theo danh mục"
        description="" // Dùng để phát hiện cụm vấn đề chính sau khi đã xem bảng hiệu suất.
        meta={<Badge className={subtleBadgeClassName}>{snapshot.ticketCategorySeries.length} danh mục</Badge>}
      >
        {snapshot.ticketCategorySeries.some((item) => item.total > 0) ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={snapshot.ticketCategorySeries} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" vertical={false} />
              <XAxis dataKey="category" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip content={<CustomTooltip valueFormatter={(value) => `${value} ticket`} />} />
              <Legend />
              <Bar dataKey="total" name="Ticket" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart title="Chưa có dữ liệu danh mục" description="Không có ticket đủ điều kiện để dựng chart trong kỳ này." />
        )}
      </ChartPanel>

      <SummaryTable
        title="Hiệu suất nhân sự"
        description="" // Bảng chính để đọc tải ticket và năng lực xử lý theo từng người.
        headers={["Nhân sự", "Assigned", "Resolved", "Avg response", "Task done", "Task overdue"]}
        rows={snapshot.staffPerformance.map((row) => ({
          key: row.id,
          cells: [row.name, row.assigned, row.resolved, row.avgResponse, row.tasksDone, row.tasksOverdue],
          sortValues: [
            row.name,
            row.assigned,
            row.resolved,
            Number.parseFloat(row.avgResponse) || 0,
            row.tasksDone,
            row.tasksOverdue,
          ],
        }))}
        emptyTitle="Chưa có dữ liệu nhân sự"
        emptyDescription="Hiệu suất nhân sự sẽ xuất hiện khi ticket và task được gán trong khoảng ngày đã chọn."
      />
    </div>
  );
}

export function MarketingPanel({
  snapshot,
  previousSnapshot,
}: {
  snapshot: MarketingReportSnapshot;
  previousSnapshot?: MarketingReportSnapshot | null;
}) {
  const topCampaign = snapshot.campaignPerformance.reduce(
    (current, item) => (item.sent > current.sent ? item : current),
    snapshot.campaignPerformance[0] ?? {
      id: "none",
      name: "--",
      channel: "email",
      sent: 0,
      opened: 0,
      clicked: 0,
      failed: 0,
      openRate: 0,
      clickRate: 0,
      status: "draft",
    },
  );

  return (
    <div className="space-y-4">
      <MetricStrip className="xl:grid-cols-4">
        <MetricStripItem
          label="Đã gửi"
          value={formatNumberCompact(snapshot.outboundTotals.sent)}
          helper={<ComparisonText current={snapshot.outboundTotals.sent} previous={previousSnapshot?.outboundTotals.sent} suffix="số tin gửi" />}
          icon={MailCheck}
          tone="success"
        />
        <MetricStripItem
          label="Đã mở"
          value={formatNumberCompact(snapshot.outboundTotals.opened)}
          helper={<ComparisonText current={snapshot.outboundTotals.opened} previous={previousSnapshot?.outboundTotals.opened} suffix="số lượt mở" />}
          icon={UsersRound}
          tone="info"
        />
        <MetricStripItem
          label="Đã nhấp"
          value={formatNumberCompact(snapshot.outboundTotals.clicked)}
          helper={<ComparisonText current={snapshot.outboundTotals.clicked} previous={previousSnapshot?.outboundTotals.clicked} suffix="số lượt nhấp" />}
          icon={BadgePercent}
          tone="primary"
        />
        <MetricStripItem
          label="Thất bại"
          value={formatNumberCompact(snapshot.outboundTotals.failed)}
          helper={<ComparisonText current={snapshot.outboundTotals.failed} previous={previousSnapshot?.outboundTotals.failed} suffix="tỷ lệ lỗi gửi" inverse />}
          icon={MailWarning}
          tone="danger"
        />
      </MetricStrip>

      <ChartPanel
        title="Top campaign theo lượng gửi"
        description="" // Chart phụ để so sánh khối lượng gửi giữa các chiến dịch đang hiện có.
        meta={<Badge className={subtleBadgeClassName}>Top: {topCampaign.name}</Badge>}
      >
        {snapshot.campaignPerformance.length ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={snapshot.campaignPerformance.slice(0, 6)} layout="vertical" margin={{ top: 4, right: 8, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={120} />
              <Tooltip content={<CustomTooltip valueFormatter={(value) => `${value} tin nhắn`} />} />
              <Legend />
              <Bar dataKey="sent" name="Đã gửi" fill="#2563eb" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart title="Chưa có chiến dịch để so sánh" description="Chart sẽ hiển thị khi có ít nhất 1 chiến dịch trong báo cáo marketing." />
        )}
      </ChartPanel>

      <SummaryTable
        title="Hiệu quả chiến dịch"
        description="" // Bảng chính để scan nhanh trạng thái, open rate và click rate của từng campaign.
        headers={["Chiến dịch", "Kênh", "Đã gửi", "Thất bại", "Tỷ lệ mở", "Tỷ lệ nhấp", "Trạng thái"]}
        rows={snapshot.campaignPerformance.map((campaign) => ({
          key: campaign.id,
          cells: [
            <div className="min-w-0">
              <div className="truncate font-medium">{campaign.name}</div>
            </div>,
            campaign.channel,
            campaign.sent,
            campaign.failed,
            `${campaign.openRate}%`,
            `${campaign.clickRate}%`,
            campaign.status,
          ],
          sortValues: [
            campaign.name,
            campaign.channel,
            campaign.sent,
            campaign.failed,
            campaign.openRate,
            campaign.clickRate,
            campaign.status,
          ],
        }))}
        emptyTitle="Chưa có dữ liệu marketing"
        emptyDescription="Chiến dịch và outbound message sẽ xuất hiện tại đây khi đã có dữ liệu gửi."
      />
    </div>
  );
}

export function ReportContent({
  snapshot,
  previousSnapshot,
}: {
  snapshot: ReportSnapshot;
  previousSnapshot?: ReportSnapshot | null;
}) {
  if (snapshot.tab === "revenue") {
    const previousRevenue = previousSnapshot?.tab === "revenue" ? previousSnapshot : null;
    return <RevenuePanel snapshot={snapshot} previousSnapshot={previousRevenue} />;
  }

  if (snapshot.tab === "customers") {
    const previousCustomers = previousSnapshot?.tab === "customers" ? previousSnapshot : null;
    return <CustomersPanel snapshot={snapshot} previousSnapshot={previousCustomers} />;
  }

  if (snapshot.tab === "tickets") {
    const previousTickets = previousSnapshot?.tab === "tickets" ? previousSnapshot : null;
    return <TicketsPanel snapshot={snapshot} previousSnapshot={previousTickets} />;
  }

  const previousMarketing = previousSnapshot?.tab === "marketing" ? previousSnapshot : null;
  return <MarketingPanel snapshot={snapshot} previousSnapshot={previousMarketing} />;
}
