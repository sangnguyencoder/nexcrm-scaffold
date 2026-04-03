import type { DashboardStats } from "@/types";

import { customerService } from "@/services/customerService";
import { ticketService } from "@/services/ticketService";
import { transactionService } from "@/services/transactionService";
import {
  buildCustomerDistribution,
  buildRevenueSeries,
  withLatency,
} from "@/services/shared";

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export const dashboardService = {
  getStats(range: "today" | "7days" | "30days" = "7days") {
    return withLatency(
      (async (): Promise<DashboardStats> => {
        const [customers, tickets, transactions] = await Promise.all([
          customerService.getList(),
          ticketService.getList(),
          transactionService.getList(),
        ]);
        const now = new Date();
        const monthStart = startOfMonth().getTime();
        const rangeDays = range === "today" ? 1 : range === "30days" ? 30 : 7;
        const rangeStart = new Date(now.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
        rangeStart.setHours(0, 0, 0, 0);

        const monthTransactions = transactions.filter(
          (item) =>
            new Date(item.created_at).getTime() >= monthStart &&
            item.status === "completed",
        );
        const resolvedThisMonth = tickets.filter((ticket) => {
          if (!ticket.resolved_at) return false;
          return new Date(ticket.resolved_at).getTime() >= monthStart;
        });
        const rangeTransactions = transactions.filter(
          (item) =>
            new Date(item.created_at).getTime() >= rangeStart.getTime() &&
            item.status === "completed",
        );

        return {
          total_customers: customers.length,
          new_customers_month: customers.filter(
            (item) => new Date(item.created_at).getTime() >= monthStart,
          ).length,
          total_revenue_month: monthTransactions.reduce(
            (sum, item) => sum + item.total_amount,
            0,
          ),
          total_orders_month: monthTransactions.length,
          open_tickets: tickets.filter((item) =>
            ["open", "in_progress", "pending"].includes(item.status),
          ).length,
          resolved_tickets_month: resolvedThisMonth.length,
          revenue_chart: buildRevenueSeries(rangeTransactions),
          customer_type_distribution: buildCustomerDistribution(customers),
        };
      })(),
    );
  },
};
