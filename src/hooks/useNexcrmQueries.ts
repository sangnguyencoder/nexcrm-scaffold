import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { auditService } from "@/services/auditService";
import { automationService } from "@/services/automationService";
import { campaignService } from "@/services/campaignService";
import { communicationService } from "@/services/communicationService";
import { customerService } from "@/services/customerService";
import { dashboardService } from "@/services/dashboardService";
import { dealService } from "@/services/dealService";
import { notificationService } from "@/services/notificationService";
import { profileService } from "@/services/profileService";
import { settingsService } from "@/services/settingsService";
import type {
  CampaignFilters,
  CustomerFilters,
  DealFilters,
  OutboundMessageFilters,
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
  notes: ["customer-notes"] as const,
  comments: ["ticket-comments"] as const,
};

export function useDashboardStats(range: "today" | "7days" | "30days" = "7days") {
  return useQuery({
    queryKey: queryKeys.dashboard(range),
    queryFn: () => dashboardService.getStats(range),
  });
}

export function useCustomersQuery(filters?: CustomerFilters) {
  return useQuery({
    queryKey: queryKeys.customers(filters),
    queryFn: () => customerService.getList(filters),
  });
}

export function useCustomerDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.customer(id ?? ""),
    queryFn: () => customerService.getById(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useTransactionsQuery(filters?: TransactionFilters) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => transactionService.getList(filters),
  });
}

export function useTicketsQuery(filters?: TicketFilters) {
  return useQuery({
    queryKey: queryKeys.tickets(filters),
    queryFn: () => ticketService.getList(filters),
  });
}

export function useTicketDetailQuery(id?: string) {
  return useQuery({
    queryKey: queryKeys.ticket(id ?? ""),
    queryFn: () => ticketService.getById(id ?? ""),
    enabled: Boolean(id),
  });
}

export function useCampaignsQuery(filters?: CampaignFilters) {
  return useQuery({
    queryKey: queryKeys.campaigns(filters),
    queryFn: () => campaignService.getList(filters),
  });
}

export function useOutboundMessagesQuery(filters?: OutboundMessageFilters) {
  return useQuery({
    queryKey: queryKeys.outboundMessages(filters),
    queryFn: () => communicationService.getOutboundMessages(filters),
  });
}

export function useDealsQuery(filters?: DealFilters) {
  return useQuery({
    queryKey: queryKeys.deals(filters),
    queryFn: () => dealService.getList(filters),
  });
}

export function useTasksQuery(filters?: TaskFilters) {
  return useQuery({
    queryKey: queryKeys.tasks(filters),
    queryFn: () => taskService.getList(filters),
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
    queryFn: profileService.getAll,
  });
}

export function useAutomationQuery() {
  return useQuery({
    queryKey: queryKeys.automation,
    queryFn: automationService.getAll,
  });
}

export function useSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsService.get,
  });
}

export function useAuditQuery() {
  return useQuery({
    queryKey: queryKeys.audit,
    queryFn: auditService.getAll,
  });
}

export function useNotesQuery() {
  return useQuery({
    queryKey: queryKeys.notes,
    queryFn: customerService.getNotes,
  });
}

export function useCommentsQuery() {
  return useQuery({
    queryKey: queryKeys.comments,
    queryFn: ticketService.getComments,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.notes }),
      queryClient.invalidateQueries({ queryKey: queryKeys.comments }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.settings }),
    ]);
}

export function useMarkAllNotificationsRead(userId?: string) {
  const invalidate = useInvalidateQueries();

  return useMutation({
    mutationFn: () => notificationService.markAllRead(userId ?? ""),
    onSuccess: () => invalidate(),
  });
}
