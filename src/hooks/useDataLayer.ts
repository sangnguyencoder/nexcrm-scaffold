import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { toast } from "sonner";

import {
  automationService,
  campaignService,
  customerService,
  dealService,
  exportService,
  notificationService,
  reportService,
  settingsService,
  storageService,
  taskService,
  ticketService,
  transactionService,
  type ServiceResponse,
} from "@/services/data-layer";

const LIST_STALE_TIME = 30_000;
const DETAIL_STALE_TIME = 60_000;

type MutationResult<TData, TVariables> = {
  result: ServiceResponse<TData>;
  variables: TVariables;
};

function showResultToast<TData>(result: ServiceResponse<TData>, successMessage: string, fallbackError: string) {
  if (result.error) {
    toast.error(result.error.message || fallbackError);
    return false;
  }
  toast.success(successMessage);
  return true;
}

function invalidateMany(queryClient: ReturnType<typeof useQueryClient>, keys: QueryKey[]) {
  return Promise.all(keys.map((key) => queryClient.invalidateQueries({ queryKey: key })));
}

export const dataLayerQueryKeys = {
  customers: (params?: unknown) => ["dl", "customers", params ?? {}] as const,
  customer: (id?: string) => ["dl", "customer", id ?? ""] as const,
  transactions: (params?: unknown) => ["dl", "transactions", params ?? {}] as const,
  transaction: (id?: string) => ["dl", "transaction", id ?? ""] as const,
  tickets: (params?: unknown) => ["dl", "tickets", params ?? {}] as const,
  ticket: (id?: string) => ["dl", "ticket", id ?? ""] as const,
  campaigns: (params?: unknown) => ["dl", "campaigns", params ?? {}] as const,
  campaign: (id?: string) => ["dl", "campaign", id ?? ""] as const,
  automations: (params?: unknown) => ["dl", "automations", params ?? {}] as const,
  automation: (id?: string) => ["dl", "automation", id ?? ""] as const,
  deals: (params?: unknown) => ["dl", "deals", params ?? {}] as const,
  deal: (id?: string) => ["dl", "deal", id ?? ""] as const,
  tasks: (params?: unknown) => ["dl", "tasks", params ?? {}] as const,
  task: (id?: string) => ["dl", "task", id ?? ""] as const,
  notifications: (params?: unknown) => ["dl", "notifications", params ?? {}] as const,
  notificationCount: (userId?: string) => ["dl", "notifications", "count", userId ?? "self"] as const,
  settings: () => ["dl", "settings"] as const,
  dashboard: (params?: unknown) => ["dl", "reports", "dashboard", params ?? {}] as const,
  revenueChart: (params?: unknown) => ["dl", "reports", "revenue", params ?? {}] as const,
  customerSegments: () => ["dl", "reports", "segments"] as const,
  pipelineSummary: () => ["dl", "reports", "pipeline"] as const,
};

export function useCustomerList(params?: Parameters<typeof customerService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.customers(params),
    queryFn: () => customerService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useCustomer(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.customer(id),
    queryFn: () => customerService.getById(id ?? ""),
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customerService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo khách hàng.", "Không thể tạo khách hàng.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.customers()]);
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof customerService.update>[1] }) =>
      customerService.update(id, payload),
    onMutate: async ({ id, payload }) => {
      const detailKey = dataLayerQueryKeys.customer(id);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);
      queryClient.setQueryData(detailKey, (old: ServiceResponse<Record<string, unknown>> | undefined) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...payload,
          },
        };
      });
      return { previous, detailKey };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.detailKey, context.previous);
      }
      toast.error("Không thể cập nhật khách hàng.");
    },
    onSuccess: async (result, variables) => {
      if (!showResultToast(result, "Đã cập nhật khách hàng.", "Không thể cập nhật khách hàng.")) return;
      await invalidateMany(queryClient, [
        dataLayerQueryKeys.customers(),
        dataLayerQueryKeys.customer(variables.id),
      ]);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: customerService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã xóa mềm khách hàng.", "Không thể xóa khách hàng.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.customers()]);
    },
  });
}

export function useTransactionList(params?: Parameters<typeof transactionService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.transactions(params),
    queryFn: () => transactionService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useTransaction(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.transaction(id),
    queryFn: () => transactionService.getById(id ?? ""),
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transactionService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo giao dịch.", "Không thể tạo giao dịch.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.transactions()]);
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof transactionService.update>[1] }) =>
      transactionService.update(id, payload),
    onSuccess: async (result, variables) => {
      if (!showResultToast(result, "Đã cập nhật giao dịch.", "Không thể cập nhật giao dịch.")) return;
      await invalidateMany(queryClient, [
        dataLayerQueryKeys.transactions(),
        dataLayerQueryKeys.transaction(variables.id),
      ]);
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: transactionService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã xóa mềm giao dịch.", "Không thể xóa giao dịch.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.transactions()]);
    },
  });
}

export function useTicketList(params?: Parameters<typeof ticketService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.tickets(params),
    queryFn: () => ticketService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useTicket(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.ticket(id),
    queryFn: () => ticketService.getById(id ?? ""),
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ticketService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo ticket.", "Không thể tạo ticket.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.tickets()]);
    },
  });
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof ticketService.update>[1] }) =>
      ticketService.update(id, payload),
    onSuccess: async (result, variables) => {
      if (!showResultToast(result, "Đã cập nhật ticket.", "Không thể cập nhật ticket.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.tickets(), dataLayerQueryKeys.ticket(variables.id)]);
    },
  });
}

export function useDeleteTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ticketService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã đóng ticket.", "Không thể đóng ticket.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.tickets()]);
    },
  });
}

export function useCampaignList(params?: Parameters<typeof campaignService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.campaigns(params),
    queryFn: () => campaignService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useCampaign(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.campaign(id),
    queryFn: () => campaignService.getById(id ?? ""),
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: campaignService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo chiến dịch.", "Không thể tạo chiến dịch.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.campaigns()]);
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof campaignService.update>[1] }) =>
      campaignService.update(id, payload),
    onSuccess: async (result, variables) => {
      if (!showResultToast(result, "Đã cập nhật chiến dịch.", "Không thể cập nhật chiến dịch.")) return;
      await invalidateMany(queryClient, [
        dataLayerQueryKeys.campaigns(),
        dataLayerQueryKeys.campaign(variables.id),
      ]);
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: campaignService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã hủy chiến dịch.", "Không thể hủy chiến dịch.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.campaigns()]);
    },
  });
}

export function useAutomationList(params?: Parameters<typeof automationService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.automations(params),
    queryFn: () => automationService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useAutomation(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.automation(id),
    queryFn: async () => {
      const list = await automationService.getList({ limit: 200 });
      if (list.error || !list.data) {
        return list;
      }
      const found = list.data.find((item) => item.id === id);
      if (!found) {
        return {
          data: null,
          error: { message: "Không tìm thấy quy tắc automation." },
        } as ServiceResponse<(typeof list.data)[number]>;
      }
      return { data: found, error: null } as ServiceResponse<(typeof list.data)[number]>;
    },
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: automationService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo rule automation.", "Không thể tạo rule automation.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.automations()]);
    },
  });
}

export function useUpdateAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof automationService.update>[1] }) =>
      automationService.update(id, payload),
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã cập nhật rule automation.", "Không thể cập nhật rule automation.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.automations()]);
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: automationService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã xóa rule automation.", "Không thể xóa rule automation.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.automations()]);
    },
  });
}

export function useDealList(params?: Parameters<typeof dealService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.deals(params),
    queryFn: () => dealService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useDeal(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.deal(id),
    queryFn: () => dealService.getById(id ?? ""),
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dealService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo cơ hội.", "Không thể tạo cơ hội.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.deals()]);
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof dealService.update>[1] }) =>
      dealService.update(id, payload),
    onMutate: async ({ id, payload }) => {
      const detailKey = dataLayerQueryKeys.deal(id);
      await queryClient.cancelQueries({ queryKey: detailKey });
      const previous = queryClient.getQueryData(detailKey);
      queryClient.setQueryData(detailKey, (old: ServiceResponse<Record<string, unknown>> | undefined) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: {
            ...old.data,
            ...payload,
          },
        };
      });
      return { previous, detailKey };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(context.detailKey, context.previous);
      }
      toast.error("Không thể cập nhật cơ hội.");
    },
    onSuccess: async (result, variables) => {
      if (!showResultToast(result, "Đã cập nhật cơ hội.", "Không thể cập nhật cơ hội.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.deals(), dataLayerQueryKeys.deal(variables.id)]);
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: dealService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã xóa cơ hội.", "Không thể xóa cơ hội.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.deals()]);
    },
  });
}

export function useTaskList(params?: Parameters<typeof taskService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.tasks(params),
    queryFn: () => taskService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useTask(id?: string) {
  return useQuery({
    queryKey: dataLayerQueryKeys.task(id),
    queryFn: async () => {
      const list = await taskService.getList({ limit: 200 });
      if (list.error || !list.data) {
        return list;
      }
      const found = list.data.find((item) => item.id === id);
      if (!found) {
        return {
          data: null,
          error: { message: "Không tìm thấy nhiệm vụ." },
        } as ServiceResponse<(typeof list.data)[number]>;
      }
      return { data: found, error: null } as ServiceResponse<(typeof list.data)[number]>;
    },
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taskService.create,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã tạo nhiệm vụ.", "Không thể tạo nhiệm vụ.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.tasks()]);
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof taskService.update>[1] }) =>
      taskService.update(id, payload),
    onSuccess: async (result, variables) => {
      if (!showResultToast(result, "Đã cập nhật nhiệm vụ.", "Không thể cập nhật nhiệm vụ.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.tasks(), dataLayerQueryKeys.task(variables.id)]);
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: taskService.softDelete,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã xóa nhiệm vụ.", "Không thể xóa nhiệm vụ.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.tasks()]);
    },
  });
}

export function useNotificationList(params?: Parameters<typeof notificationService.getList>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.notifications(params),
    queryFn: () => notificationService.getList(params),
    staleTime: LIST_STALE_TIME,
  });
}

export function useNotification(id?: string, params?: Parameters<typeof notificationService.getList>[0]) {
  return useQuery({
    queryKey: ["dl", "notification-detail", id ?? "", params ?? {}],
    queryFn: async () => {
      const response = await notificationService.getList({ ...params, limit: 200 });
      if (response.error || !response.data) return response;
      const found = response.data.find((item) => item.id === id);
      if (!found) {
        return {
          data: null,
          error: { message: "Không tìm thấy thông báo." },
        } as ServiceResponse<(typeof response.data)[number]>;
      }
      return { data: found, error: null } as ServiceResponse<(typeof response.data)[number]>;
    },
    staleTime: DETAIL_STALE_TIME,
    enabled: Boolean(id),
  });
}

export function useCreateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { userId?: string }) => {
      void payload;
      return {
        data: null,
        error: { message: "Chức năng tạo thông báo trực tiếp chưa được mở trong data layer." },
      } as ServiceResponse<null>;
    },
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã xử lý thông báo.", "Không thể xử lý thông báo.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.notifications()]);
    },
  });
}

export function useUpdateNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => notificationService.markRead(id),
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã đánh dấu đã đọc.", "Không thể đánh dấu đã đọc.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.notifications(), dataLayerQueryKeys.notificationCount()]);
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId }: { userId?: string }) => notificationService.markAllRead(userId),
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã đánh dấu toàn bộ đã đọc.", "Không thể đánh dấu toàn bộ đã đọc.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.notifications(), dataLayerQueryKeys.notificationCount()]);
    },
  });
}

export function useSettingsList() {
  return useQuery({
    queryKey: dataLayerQueryKeys.settings(),
    queryFn: () => settingsService.get(),
    staleTime: LIST_STALE_TIME,
  });
}

export function useSettings(id?: string) {
  void id;
  return useQuery({
    queryKey: dataLayerQueryKeys.settings(),
    queryFn: () => settingsService.get(),
    staleTime: DETAIL_STALE_TIME,
  });
}

export function useCreateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.update,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã lưu cài đặt.", "Không thể lưu cài đặt.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.settings()]);
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsService.update,
    onSuccess: async (result) => {
      if (!showResultToast(result, "Đã cập nhật cài đặt.", "Không thể cập nhật cài đặt.")) return;
      await invalidateMany(queryClient, [dataLayerQueryKeys.settings()]);
    },
  });
}

export function useDeleteSettings() {
  return useMutation({
    mutationFn: async () =>
      ({
        data: null,
        error: { message: "Chức năng xóa cài đặt chưa được hỗ trợ." },
      }) as ServiceResponse<null>,
    onSuccess: (result) => {
      showResultToast(result, "Đã xử lý cài đặt.", "Không thể xử lý cài đặt.");
    },
  });
}

export function useDashboardStats(input: Parameters<typeof reportService.getDashboardStats>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.dashboard(input),
    queryFn: () => reportService.getDashboardStats(input),
    staleTime: LIST_STALE_TIME,
  });
}

export function useRevenueChart(input: Parameters<typeof reportService.getRevenueChart>[0]) {
  return useQuery({
    queryKey: dataLayerQueryKeys.revenueChart(input),
    queryFn: () => reportService.getRevenueChart(input),
    staleTime: LIST_STALE_TIME,
  });
}

export function useCustomerSegments() {
  return useQuery({
    queryKey: dataLayerQueryKeys.customerSegments(),
    queryFn: () => reportService.getCustomerSegments(),
    staleTime: LIST_STALE_TIME,
  });
}

export function usePipelineSummary() {
  return useQuery({
    queryKey: dataLayerQueryKeys.pipelineSummary(),
    queryFn: () => reportService.getPipelineSummary(),
    staleTime: LIST_STALE_TIME,
  });
}

export function useExportCustomersCSV() {
  return useMutation({
    mutationFn: exportService.exportCustomersCSV,
    onSuccess: (result) => {
      showResultToast(result, "Đã chuẩn bị file CSV khách hàng.", "Không thể xuất CSV khách hàng.");
    },
  });
}

export function useExportTransactionsCSV() {
  return useMutation({
    mutationFn: exportService.exportTransactionsCSV,
    onSuccess: (result) => {
      showResultToast(result, "Đã chuẩn bị file CSV giao dịch.", "Không thể xuất CSV giao dịch.");
    },
  });
}

export function useExportReportExcel() {
  return useMutation({
    mutationFn: exportService.exportReportExcel,
    onSuccess: (result) => {
      showResultToast(result, "Đã chuẩn bị file Excel báo cáo.", "Không thể xuất Excel báo cáo.");
    },
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: storageService.upload,
    onSuccess: (result) => {
      showResultToast(result, "Đã upload file.", "Không thể upload file.");
    },
  });
}

export function useDeleteFile() {
  return useMutation({
    mutationFn: storageService.delete,
    onSuccess: (result) => {
      showResultToast(result, "Đã xóa file.", "Không thể xóa file.");
    },
  });
}
