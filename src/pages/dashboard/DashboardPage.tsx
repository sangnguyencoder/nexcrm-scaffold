import {
  AlertCircle,
  DollarSign,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { KpiCard } from "@/components/shared/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomerAvatar } from "@/components/shared/customer-avatar";
import { useDashboardStats } from "@/hooks/useNexcrmQueries";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { getAppErrorMessage } from "@/services/shared";

export function DashboardPage() {
  const navigate = useNavigate();
  const [range, setRange] = useState<"today" | "7days" | "30days">("7days");
  const statsQuery = useDashboardStats(range);
  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return <PageLoader panels={3} />;
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

  if (!stats) {
    return <PageLoader panels={3} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Toàn cảnh doanh thu, khách hàng và ticket cần ưu tiên xử lý."
        actions={
          <div className="flex rounded-2xl bg-muted p-1">
            {[
              { key: "today", label: "Hôm nay" },
              { key: "7days", label: "7 ngày" },
              { key: "30days", label: "30 ngày" },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setRange(item.key as typeof range)}
                className={`rounded-xl px-4 py-2 text-sm transition ${
                  range === item.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Tổng Khách Hàng"
          value={String(stats.total_customers)}
          description={`+${stats.new_customers_month} mới tháng này`}
          trend="+23 mới"
          icon={Users}
          accentClassName="bg-blue-500/15 text-blue-600"
        />
        <KpiCard
          title="Doanh Thu Tháng"
          value={formatCurrency(stats.total_revenue_month)}
          description="+12% so với tháng trước"
          trend="+12%"
          icon={DollarSign}
          accentClassName="bg-emerald-500/15 text-emerald-600"
        />
        <KpiCard
          title="Đơn Hàng Tháng"
          value={String(stats.total_orders_month)}
          description="Theo dõi realtime theo bộ lọc demo"
          trend="67 đơn"
          icon={ShoppingCart}
          accentClassName="bg-blue-500/15 text-blue-600"
        />
        <KpiCard
          title="Ticket Đang Mở"
          value={String(stats.open_tickets)}
          description="3 khẩn cấp cần ưu tiên"
          trend="12 mở"
          icon={AlertCircle}
          accentClassName="bg-orange-500/15 text-orange-600"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.7fr,1fr]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Doanh thu 7 ngày</CardTitle>
          </CardHeader>
          <CardContent className="h-[340px] min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={stats.revenue_chart}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value, name) =>
                    name === "revenue" && typeof value === "number"
                      ? formatCurrency(value)
                      : (value ?? "-")
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Phân Loại Khách Hàng</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <div className="h-[220px] min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie
                    data={stats.customer_type_distribution}
                    dataKey="count"
                    nameKey="type"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={4}
                  >
                    {stats.customer_type_distribution.map((entry) => (
                      <Cell key={entry.type} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {stats.customer_type_distribution.map((entry) => (
                <div key={entry.type} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span>{entry.type}</span>
                  </div>
                  <span className="font-medium">{entry.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 khách hàng</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.top_customers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => navigate(`/customers/${customer.id}`)}
                className="flex w-full items-center justify-between rounded-2xl bg-muted/40 p-3 text-left transition hover:bg-primary/5"
              >
                <div className="flex items-center gap-3">
                  <CustomerAvatar name={customer.full_name} type={customer.customer_type} />
                  <div>
                    <div className="font-medium">{customer.full_name}</div>
                    <div className="text-sm text-muted-foreground">{customer.customer_code}</div>
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge
                    label={customer.customer_type.toUpperCase()}
                    className="bg-muted text-muted-foreground ring-border"
                    dotClassName="bg-primary"
                  />
                  <div className="mt-2 font-semibold">{formatCurrency(customer.total_spent)}</div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ticket khẩn cấp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.urgent_tickets.map((ticket) => (
              <button
                key={ticket.id}
                type="button"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className="w-full rounded-2xl border border-border p-4 text-left transition hover:border-primary hover:bg-primary/5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{ticket.title}</div>
                  <Badge className="bg-rose-500/15 text-rose-500 ring-rose-500/20">
                    {ticket.priority}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {ticket.customer_name || "--"}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{timeAgo(ticket.created_at)}</div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
