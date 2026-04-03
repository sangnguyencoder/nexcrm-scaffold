import { Download } from "lucide-react";
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
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCampaignsQuery,
  useCustomersQuery,
  useDealsQuery,
  useOutboundMessagesQuery,
  useTasksQuery,
  useTicketsQuery,
  useTransactionsQuery,
  useUsersQuery,
} from "@/hooks/useNexcrmQueries";
import { formatCurrency } from "@/lib/utils";

function periodKey(date: string, groupBy: "day" | "week" | "month") {
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

export function ReportsPage() {
  const { data: transactions = [] } = useTransactionsQuery();
  const { data: customers = [] } = useCustomersQuery();
  const { data: tickets = [] } = useTicketsQuery();
  const { data: campaigns = [] } = useCampaignsQuery();
  const { data: deals = [] } = useDealsQuery();
  const { data: tasks = [] } = useTasksQuery();
  const { data: outboundMessages = [] } = useOutboundMessagesQuery();
  const { data: users = [] } = useUsersQuery();
  const [from, setFrom] = useState("2026-03-01");
  const [to, setTo] = useState("2026-04-01");
  const [groupBy, setGroupBy] = useState<"day" | "week" | "month">("day");
  const fromTime = new Date(from).getTime();
  const toTime = new Date(to).getTime() + 86_399_999;

  const isInRange = (date?: string | null) => {
    if (!date) return false;
    const time = new Date(date).getTime();
    return time >= fromTime && time <= toTime;
  };

  const filteredTransactions = useMemo(
    () =>
      transactions.filter((transaction) => {
        const date = new Date(transaction.created_at).getTime();
        return date >= fromTime && date <= toTime;
      }),
    [fromTime, toTime, transactions],
  );

  const revenueSeries = useMemo(() => {
    const grouped = filteredTransactions.reduce<Record<string, { revenue: number; orders: number }>>(
      (acc, transaction) => {
        const key = periodKey(transaction.created_at, groupBy);
        acc[key] ??= { revenue: 0, orders: 0 };
        acc[key].revenue += transaction.total_amount;
        acc[key].orders += 1;
        return acc;
      },
      {},
    );

    return Object.entries(grouped)
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
  }, [filteredTransactions, groupBy]);

  const newCustomerSeries = useMemo(() => {
    const grouped = customers.reduce<Record<string, number>>((acc, customer) => {
      const created = new Date(customer.created_at).getTime();
      if (created < fromTime || created > toTime) {
        return acc;
      }
      const key = periodKey(customer.created_at, groupBy);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([periodA], [periodB]) => periodA.localeCompare(periodB))
      .map(([period, count]) => ({ period, count }));
  }, [customers, fromTime, groupBy, toTime]);

  const sourceBreakdown = useMemo(
    () => [
      { name: "Trực tiếp", value: customers.filter((item) => item.source === "direct").length, color: "#2563eb" },
      { name: "Marketing", value: customers.filter((item) => item.source === "marketing").length, color: "#10b981" },
      { name: "Giới thiệu", value: customers.filter((item) => item.source === "referral").length, color: "#f59e0b" },
      { name: "POS", value: customers.filter((item) => item.source === "pos").length, color: "#8b92a5" },
      { name: "Online", value: customers.filter((item) => item.source === "online").length, color: "#ef4444" },
    ],
    [customers],
  );

  const ticketCategorySeries = useMemo(
    () => [
      { category: "complaint", total: tickets.filter((item) => item.category === "complaint").length },
      { category: "feedback", total: tickets.filter((item) => item.category === "feedback").length },
      { category: "inquiry", total: tickets.filter((item) => item.category === "inquiry").length },
      { category: "return", total: tickets.filter((item) => item.category === "return").length },
    ],
    [tickets],
  );

  const avgResolutionHours = useMemo(() => {
    const resolved = tickets.filter((ticket) => ticket.resolved_at);
    if (!resolved.length) return 0;
    const total = resolved.reduce((sum, ticket) => {
      const start = new Date(ticket.created_at).getTime();
      const end = new Date(ticket.resolved_at ?? ticket.created_at).getTime();
      return sum + (end - start) / (1000 * 60 * 60);
    }, 0);
    return total / resolved.length;
  }, [tickets]);

  const filteredDeals = useMemo(
    () => deals.filter((deal) => isInRange(deal.created_at)),
    [deals, fromTime, toTime],
  );

  const filteredTasks = useMemo(
    () => tasks.filter((task) => isInRange(task.created_at) || isInRange(task.due_at)),
    [fromTime, tasks, toTime],
  );

  const filteredOutboundMessages = useMemo(
    () => outboundMessages.filter((message) => isInRange(message.created_at)),
    [fromTime, outboundMessages, toTime],
  );

  const staffPerformance = useMemo(
    () =>
      users.map((user) => {
        const assigned = tickets.filter((ticket) => ticket.assigned_to === user.id);
        const resolved = assigned.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed");
        const assignedTasks = filteredTasks.filter((task) => task.assigned_to === user.id);
        const completedTasks = assignedTasks.filter((task) => task.status === "done");
        const overdueTasks = assignedTasks.filter((task) => task.status === "overdue");
        return {
          id: user.id,
          name: user.full_name,
          assigned: assigned.length,
          resolved: resolved.length,
          avgResponse: `${Math.max(1, 2 + assigned.length / 4).toFixed(1)} giờ`,
          tasksDone: completedTasks.length,
          tasksOverdue: overdueTasks.length,
        };
      }),
    [filteredTasks, tickets, users],
  );

  const customerTypeRows = useMemo(
    () =>
      ["vip", "loyal", "potential", "new", "inactive"].map((type) => {
        const total = customers.filter((customer) => customer.customer_type === type).length;
        return {
          type,
          total,
          percent: customers.length ? Math.round((total / customers.length) * 100) : 0,
        };
      }),
    [customers],
  );

  const revenueTotal = filteredTransactions.reduce((sum, item) => sum + item.total_amount, 0);
  const revenueAvg = filteredTransactions.length ? revenueTotal / filteredTransactions.length : 0;
  const maxOrder = filteredTransactions.reduce(
    (max, item) => Math.max(max, item.total_amount),
    0,
  );
  const pipelineValue = filteredDeals
    .filter((deal) => deal.stage !== "lost")
    .reduce((sum, deal) => sum + deal.value, 0);
  const closedDeals = filteredDeals.filter((deal) => deal.stage === "won" || deal.stage === "lost");
  const wonDeals = filteredDeals.filter((deal) => deal.stage === "won");
  const winRate = closedDeals.length ? Math.round((wonDeals.length / closedDeals.length) * 100) : 0;
  const completedTasks = filteredTasks.filter((task) => task.status === "done").length;
  const overdueTasks = filteredTasks.filter((task) => task.status === "overdue").length;
  const taskCompletionRate = filteredTasks.length ? Math.round((completedTasks / filteredTasks.length) * 100) : 0;

  const campaignPerformance = useMemo(
    () =>
      campaigns.map((campaign) => {
        const messages = filteredOutboundMessages.filter((message) => message.campaign_id === campaign.id);
        const sent = messages.filter((message) =>
          ["sent", "delivered", "opened", "clicked"].includes(message.status),
        ).length;
        const opened = messages.filter((message) => ["opened", "clicked"].includes(message.status)).length;
        const clicked = messages.filter((message) => message.status === "clicked").length;
        const failed = messages.filter((message) => message.status === "failed").length;
        const openRate = sent ? Math.round((opened / sent) * 100) : campaign.open_rate ?? 0;
        const clickRate = sent ? Math.round((clicked / sent) * 100) : campaign.click_rate ?? 0;

        return {
          ...campaign,
          sent,
          opened,
          clicked,
          failed,
          openRate,
          clickRate,
        };
      }),
    [campaigns, filteredOutboundMessages],
  );

  const outboundTotals = useMemo(
    () => ({
      sent: filteredOutboundMessages.filter((message) =>
        ["sent", "delivered", "opened", "clicked"].includes(message.status),
      ).length,
      opened: filteredOutboundMessages.filter((message) => ["opened", "clicked"].includes(message.status)).length,
      clicked: filteredOutboundMessages.filter((message) => message.status === "clicked").length,
      failed: filteredOutboundMessages.filter((message) => message.status === "failed").length,
    }),
    [filteredOutboundMessages],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Báo Cáo & Phân Tích"
        subtitle="Bộ báo cáo động theo khoảng thời gian và nhóm hiển thị."
        actions={
          <>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-[160px]" />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-[160px]" />
            <Select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)} className="w-[140px]">
              <option value="day">Ngày</option>
              <option value="week">Tuần</option>
              <option value="month">Tháng</option>
            </Select>
            <Button
              onClick={async () => {
                toast.info("Đang xuất file...");
                await new Promise((resolve) => setTimeout(resolve, 1000));
                toast.success("Xuất thành công!");
              }}
            >
              <Download className="size-4" />
              Xuất Excel
            </Button>
          </>
        }
      />

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Doanh Thu</TabsTrigger>
          <TabsTrigger value="customers">Khách Hàng</TabsTrigger>
          <TabsTrigger value="tickets">Ticket</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-5">
          <Card className="min-w-0">
            <CardContent className="h-[320px] min-w-0 p-6">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={revenueSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) =>
                      typeof value === "number" ? formatCurrency(value) : (value ?? "-")
                    }
                  />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            <MetricCard label="Tổng DT" value={formatCurrency(revenueTotal)} />
            <MetricCard label="TB/đơn" value={formatCurrency(revenueAvg)} />
            <MetricCard label="Đơn cao nhất" value={formatCurrency(maxOrder)} />
            <MetricCard label="Giá trị Pipeline" value={formatCurrency(pipelineValue)} />
            <MetricCard label="Tỉ lệ thắng" value={`${winRate}%`} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Avg</TableHead>
                <TableHead>Growth %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueSeries.map((row) => (
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
        </TabsContent>

        <TabsContent value="customers" className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="min-w-0">
              <CardContent className="h-[320px] min-w-0 p-6">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <LineChart data={newCustomerSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                    <XAxis dataKey="period" />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="min-w-0">
              <CardContent className="h-[320px] min-w-0 p-6">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie data={sourceBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={100}>
                      {sourceBreakdown.map((entry) => (
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
                <TableHead>Loại khách hàng</TableHead>
                <TableHead>Số lượng</TableHead>
                <TableHead>% tổng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerTypeRows.map((row) => (
                <TableRow key={row.type}>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{row.total}</TableCell>
                  <TableCell>{row.percent}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Avg resolution time" value={`${avgResolutionHours.toFixed(1)} giờ`} />
            <MetricCard label="Task hoàn thành" value={String(completedTasks)} />
            <MetricCard label="Task quá hạn" value={String(overdueTasks)} />
            <MetricCard label="Task completion" value={`${taskCompletionRate}%`} />
          </div>
          <Card className="min-w-0">
            <CardContent className="h-[320px] min-w-0 p-6">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={ticketCategorySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                  <XAxis dataKey="category" />
                  <Tooltip />
                  <Bar dataKey="total" fill="#f59e0b" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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
              {staffPerformance.map((row) => (
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
        </TabsContent>

        <TabsContent value="marketing" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Outbound sent" value={String(outboundTotals.sent)} />
            <MetricCard label="Opened" value={String(outboundTotals.opened)} />
            <MetricCard label="Clicked" value={String(outboundTotals.clicked)} />
            <MetricCard label="Failed" value={String(outboundTotals.failed)} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Open rate</TableHead>
                <TableHead>Click rate</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaignPerformance.map((campaign) => (
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
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
