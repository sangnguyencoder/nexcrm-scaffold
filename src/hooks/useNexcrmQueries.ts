import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAppMutation } from "@/hooks/useAppMutation";
import { auditService } from "@/services/auditService";
import { automationService } from "@/services/automationService";
import { campaignService } from "@/services/campaignService";
import { communicationService } from "@/services/communicationService";
import { customerService } from "@/services/customerService";
import { dashboardService } from "@/services/dashboardService";
import { dealService } from "@/services/dealService";
import { notificationService } from "@/services/notificationService";
import { posSyncService } from "@/services/posSyncService";
import { profileService } from "@/services/profileService";
import { reportService, type ReportRequest } from "@/services/reportService";
import { settingsService } from "@/services/settingsService";
import type {
  CampaignFilters,
  CustomerNoteFilters,
  CustomerFilters,
  DealFilters,
  OutboundMessageFilters,
  TicketCommentFilters,
  TicketFilters,
  TaskFilters,
  TransactionFilters,
} from "@/services/shared";
import { taskService } from "@/services/taskService";
import { ticketService } from "@/services/ticketService";
import { transactionService } from "@/services/transactionService";

export const queryKeys = {
  dashboard: (range: "today" | "7days" | "30days") => ["dashboard", range] as const,
  customers: (filters?: CustomerFilters) => ["customers", filters ?? {}] as const,
  customer: (id: string) => ["customer", id] as const,
  transactions: (filters?: TransactionFilters) => ["transactions", filters ?? {}] as const,
  tickets: (filters?: TicketFilters) => ["tickets", filters ?? {}] as const,
  ticket: (id: string) => ["ticket", id] as const,
  campaigns: (filters?: CampaignFilters) => ["campaigns", filters ?? {}] as const,
  outboundMessages: (filters?: OutboundMessageFilters) => ["outbound-messages", filters ?? {}] as const,
  deals: (filters?: DealFilters) => ["deals", filters ?? {}] as const,
  deal: (id: string) => ["deal", id] as const,
  tasks: (filters?: TaskFilters) => ["tasks", filters ?? {}] as const,
  task: (id: string) => ["task", id] as const,
  notifications: (userId?: string) => ["notifications", userId ?? "anonymous"] as const,
  profiles: ["profiles"] as const,
  automation: ["automation-rules"] as const,
  settings: ["settings"] as const,
  audit: ["audit"] as const,
  posSyncLogs: ["pos-sync-logs"] as const,
  notes: (filters?: CustomerNoteFilters) => ["customer-notes", filters ?? {}] as const,
  comments: (filters?: TicketCommentFilters) => ["ticket-comments", filters ?? {}] as const,
  reports: (request: ReportRequest) => ["reports", request] as const,
};

export function useDashboardStats(
  range: "today" | "7days" | "30days" = "7days",
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.dashboard(range),
    queryFn: ({ signal }) => dashboardService.getStats(range, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 120_000,
  });
}

export function useCustomersQuery(filters?: CustomerFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.customers(filters),
    queryFn: ({ signal }) => customerService.getList(filters, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 90_000,
  });
}

export function useCustomerDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? ""),
    queryFn: ({ signal }) => customerService.getById(id ?? "", { signal }),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useTransactionsQuery(filters?: TransactionFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: ({ signal }) => transactionService.getList(filters, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 90_000,
  });
}

export function useTicketsQuery(filters?: TicketFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tickets(filters),
    queryFn: ({ signal }) => ticketService.getList(filters, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 90_000,
  });
}

export function useTicketDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.ticket(id ?? ""),
    queryFn: ({ signal }) => ticketService.getById(id ?? "", { signal }),
    enabled: Boolean(id),
  });
}

export function useCampaignsQuery(filters?: CampaignFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.campaigns(filters),
    queryFn: () => campaignService.getList(filters),
    enabled,
    staleTime: 90_000,
  });
}

export function useOutboundMessagesQuery(filters?: OutboundMessageFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.outboundMessages(filters),
    queryFn: () => communicationService.getOutboundMessages(filters),
    enabled,
    staleTime: 90_000,
  });
}

export function useDealsQuery(filters?: DealFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.deals(filters),
    queryFn: ({ signal }) => dealService.getList(filters, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 90_000,
  });
}

export function useTasksQuery(filters?: TaskFilters, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: ({ signal }) => taskService.getList(filters, { signal }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 90_000,
  });
}

export function useNotificationsQuery(userId?: string) {
  return useQuery({
    queryKey: queryKeys.notifications(userId),
    queryFn: () => notificationService.getUnread(userId ?? ""),
    enabled: Boolean(userId),
  });
}

export function useUsersQuery() {
  return useQuery({
    queryKey: queryKeys.profiles,
    queryFn: ({ signal }) => profileService.getAll({ signal }),
    staleTime: 15 * 60_000,
  });
}

export function useAutomationQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.automation,
    queryFn: automationService.getAll,
    enabled,
  });
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: ({ signal }) => settingsService.get({ signal }),
    staleTime: 5 * 60_000,
  });
}

export function useAuditQuery() {
  return useQuery({
    queryKey: queryKeys.audit,
    queryFn: auditService.getAll,
    staleTime: 120_000,
  });
}

export function usePosSyncLogsQuery(limit = 100, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.posSyncLogs, limit],
    queryFn: () => posSyncService.getLogs(limit),
    enabled,
    staleTime: 120_000,
  });
}

export function useReportSnapshot(request: ReportRequest, enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports(request),
    queryFn: ({ signal }) => reportService.getSnapshot(request, { signal }),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useNotesQuery(customerId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.notes(customerId ? { customerId } : undefined),
    queryFn: ({ signal }) => customerService.getNotes(customerId, { signal }),
    enabled,
  });
}

export function useCommentsQuery(ticketId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.comments(ticketId ? { ticketId } : undefined),
    queryFn: ({ signal }) => ticketService.getComments(ticketId, { signal }),
    enabled,
  });
}

export function useInvalidateQueries() {
  const queryClient = useQueryClient();

  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["customers"] }),
      queryClient.invalidateQueries({ queryKey: ["customer"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["tickets"] }),
      queryClient.invalidateQueries({ queryKey: ["ticket"] }),
      queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      queryClient.invalidateQueries({ queryKey: ["outbound-messages"] }),
      queryClient.invalidateQueries({ queryKey: ["deals"] }),
      queryClient.invalidateQueries({ queryKey: ["deal"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      queryClient.invalidateQueries({ queryKey: ["task"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles }),
      queryClient.invalidateQueries({ queryKey: queryKeys.automation }),
      queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      queryClient.invalidateQueries({ queryKey: queryKeys.posSyncLogs }),
      queryClient.invalidateQueries({ queryKey: ["customer-notes"] }),
      queryClient.invalidateQueries({ queryKey: ["ticket-comments"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
    ]);
}

export function useMarkAllNotificationsRead(userId?: string) {
  const queryClient = useQueryClient();

  return useAppMutation({
    action: "notification.mark-all-read",
    errorMessage: "Không thể đánh dấu tất cả thông báo đã đọc.",
    mutationFn: () => notificationService.markAllRead(userId ?? ""),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications(userId),
        refetchType: "active",
      }),
  });
}
