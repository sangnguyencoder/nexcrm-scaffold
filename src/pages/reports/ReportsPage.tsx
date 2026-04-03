import { Download, FileText } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PageErrorState } from "@/components/shared/page-error-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportSnapshot } from "@/hooks/useNexcrmQueries";
import { formatCurrency } from "@/lib/utils";
import { exportService } from "@/services/exportService";
import { getAppErrorMessage } from "@/services/shared";
import type {
  CustomersReportSnapshot,
  MarketingReportSnapshot,
  ReportGroupBy,
  ReportTab,
  RevenueReportSnapshot,
  TicketsReportSnapshot,
} from "@/services/reportService";

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultFromDate() {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function getDefaultToDate() {
  return toInputDate(new Date());
}

function isReportTab(value: string | null): value is ReportTab {
  return value === "revenue" || value === "customers" || value === "tickets" || value === "marketing";
}

function isGroupBy(value: string | null): value is ReportGroupBy {
  return value === "day" || value === "week" || value === "month";
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-5">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="font-display text-3xl font-bold tracking-tight">{value}</div>
        {helper ? <div className="text-xs text-muted-foreground">{helper}</div> : null}
      </CardContent>
    </Card>
  );
}

function RevenueView({ snapshot }: { snapshot: RevenueReportSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Tong doanh thu" value={formatCurrency(snapshot.revenueTotal)} />
        <MetricCard label="Trung binh moi don" value={formatCurrency(snapshot.revenueAvg)} />
        <MetricCard label="Don hang lon nhat" value={formatCurrency(snapshot.maxOrder)} />
        <MetricCard label="Gia tri pipeline" value={formatCurrency(snapshot.pipelineValue)} />
        <MetricCard label="Ti le thang" value={`${snapshot.winRate}%`} />
      </div>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Dong doanh thu theo ky</CardTitle>
        </CardHeader>
        <CardContent className="h-[360px] min-w-0 p-6">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={snapshot.revenueSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatCurrency(value) : (value ?? "-")
                }
              />
              <Bar dataKey="revenue" fill="#2563eb" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ky</TableHead>
            <TableHead>Doanh thu</TableHead>
            <TableHead>Don hang</TableHead>
            <TableHead>TB / don</TableHead>
            <TableHead>Tang truong</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshot.revenueSeries.map((row) => (
            <TableRow key={row.period}>
              <TableCell>{row.period}</TableCell>
              <TableCell>{formatCurrency(row.revenue)}</TableCell>
              <TableCell>{row.orders}</TableCell>
              <TableCell>{formatCurrency(row.avg)}</TableCell>
              <TableCell>{row.growth}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function CustomersView({ snapshot }: { snapshot: CustomersReportSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.5fr,1fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Khach hang moi theo ky</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px] min-w-0 p-6">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={snapshot.newCustomerSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="period" />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Nguon khach hang</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px] min-w-0 p-6">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <PieChart>
                <Pie data={snapshot.sourceBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={108}>
                  {snapshot.sourceBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phan loai</TableHead>
            <TableHead>So luong</TableHead>
            <TableHead>Ty trong</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshot.customerTypeRows.map((row) => (
            <TableRow key={row.type}>
              <TableCell>{row.type}</TableCell>
              <TableCell>{row.total}</TableCell>
              <TableCell>{row.percent}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function TicketsView({ snapshot }: { snapshot: TicketsReportSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="TB xu ly ticket" value={`${snapshot.avgResolutionHours.toFixed(1)} gio`} />
        <MetricCard label="Task hoan thanh" value={String(snapshot.completedTasks)} />
        <MetricCard label="Task qua han" value={String(snapshot.overdueTasks)} />
        <MetricCard label="Ti le hoan thanh" value={`${snapshot.taskCompletionRate}%`} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr,1.4fr]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Phan bo ticket theo danh muc</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px] min-w-0 p-6">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart data={snapshot.ticketCategorySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="category" />
                <Tooltip />
                <Bar dataKey="total" fill="#f59e0b" radius={[12, 12, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Hieu suat nhan su</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nhân sự</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead>Avg response</TableHead>
                  <TableHead>Task done</TableHead>
                  <TableHead>Task overdue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.staffPerformance.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.assigned}</TableCell>
                    <TableCell>{row.resolved}</TableCell>
                    <TableCell>{row.avgResponse}</TableCell>
                    <TableCell>{row.tasksDone}</TableCell>
                    <TableCell>{row.tasksOverdue}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MarketingView({ snapshot }: { snapshot: MarketingReportSnapshot }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Outbound sent" value={String(snapshot.outboundTotals.sent)} />
        <MetricCard label="Opened" value={String(snapshot.outboundTotals.opened)} />
        <MetricCard label="Clicked" value={String(snapshot.outboundTotals.clicked)} />
        <MetricCard label="Failed" value={String(snapshot.outboundTotals.failed)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Hieu qua chien dich</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ten chien dich</TableHead>
                <TableHead>Kenh</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Open rate</TableHead>
                <TableHead>Click rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshot.campaignPerformance.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>{campaign.name}</TableCell>
                  <TableCell>{campaign.channel}</TableCell>
                  <TableCell>{campaign.sent}</TableCell>
                  <TableCell>{campaign.failed}</TableCell>
                  <TableCell>{campaign.openRate}%</TableCell>
                  <TableCell>{campaign.clickRate}%</TableCell>
                  <TableCell>{campaign.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "pdf" | null>(null);
  const tabParam = searchParams.get("tab");
  const groupByParam = searchParams.get("groupBy");
  const activeTab: ReportTab = isReportTab(tabParam) ? tabParam : "revenue";
  const from = searchParams.get("from") || getDefaultFromDate();
  const to = searchParams.get("to") || getDefaultToDate();
  const groupBy: ReportGroupBy = isGroupBy(groupByParam) ? groupByParam : "day";

  const updateParams = (updates: Partial<Record<"tab" | "from" | "to" | "groupBy", string>>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const reportQuery = useReportSnapshot({
    tab: activeTab,
    from,
    to,
    groupBy,
  });

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!reportQuery.data) {
      return;
    }

    setExportingFormat(format);
    try {
      await exportService.exportReport({
        tab: activeTab,
        from,
        to,
        groupBy,
        format,
        snapshot: reportQuery.data,
      });
      toast.success(format === "xlsx" ? "Da xuat Excel thanh cong." : "Da xuat PDF thanh cong.");
    } catch (error) {
      toast.error(getAppErrorMessage(error, "Khong the xuat bao cao. Vui long thu lai."));
    } finally {
      setExportingFormat(null);
    }
  };

  if (reportQuery.isLoading) {
    return <PageLoader panels={3} />;
  }

  if (reportQuery.error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Bao Cao & Phan Tich"
          subtitle="Bao cao dong theo thoi gian, co retry ro rang khi truy van loi."
        />
        <PageErrorState
          title="Khong the tai bao cao"
          description={getAppErrorMessage(
            reportQuery.error,
            "Du lieu bao cao chua dong bo duoc. Vui long kiem tra bo loc ngay va thu lai.",
          )}
          onRetry={() => void reportQuery.refetch()}
        />
      </div>
    );
  }

  const snapshot = reportQuery.data;
  if (!snapshot) {
    return <PageLoader panels={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bao Cao & Phan Tich"
        subtitle="Bao cao dong theo khoang thoi gian, toi uu theo tung tab va san sang xuat file."
        actions={
          <>
            <Input
              type="date"
              value={from}
              onChange={(event) => updateParams({ from: event.target.value })}
              className="w-[170px]"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => updateParams({ to: event.target.value })}
              className="w-[170px]"
            />
            <Select
              value={groupBy}
              onChange={(event) => updateParams({ groupBy: event.target.value })}
              className="w-[150px]"
            >
              <option value="day">Theo ngay</option>
              <option value="week">Theo tuan</option>
              <option value="month">Theo thang</option>
            </Select>
            <Button
              variant="secondary"
              onClick={() => void handleExport("xlsx")}
              disabled={Boolean(exportingFormat)}
            >
              <Download className="size-4" />
              {exportingFormat === "xlsx" ? "Dang xuat..." : "Xuat Excel"}
            </Button>
            <Button
              onClick={() => void handleExport("pdf")}
              disabled={Boolean(exportingFormat)}
            >
              <FileText className="size-4" />
              {exportingFormat === "pdf" ? "Dang xuat..." : "Xuat PDF"}
            </Button>
          </>
        }
      />

      <Tabs value={activeTab} onValueChange={(value) => updateParams({ tab: value })}>
        <TabsList>
          <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
          <TabsTrigger value="customers">Khach hang</TabsTrigger>
          <TabsTrigger value="tickets">Ticket</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          {snapshot.tab === "revenue" ? <RevenueView snapshot={snapshot} /> : null}
        </TabsContent>
        <TabsContent value="customers" className="space-y-6">
          {snapshot.tab === "customers" ? <CustomersView snapshot={snapshot} /> : null}
        </TabsContent>
        <TabsContent value="tickets" className="space-y-6">
          {snapshot.tab === "tickets" ? <TicketsView snapshot={snapshot} /> : null}
        </TabsContent>
        <TabsContent value="marketing" className="space-y-6">
          {snapshot.tab === "marketing" ? <MarketingView snapshot={snapshot} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
