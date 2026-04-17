import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  Copy,
  Eye,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { CompactPagination } from "@/components/shared/compact-pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionHeaderCompact } from "@/components/shared/section-header-compact";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Can } from "@/components/shared/Can";
import { useAppMutation } from "@/hooks/useAppMutation";
import { useCampaignsQuery, useOutboundMessagesQuery } from "@/hooks/useNexcrmQueries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  cn,
  formatDate,
  formatNumberCompact,
  formatPercentValue,
  formatTicketStatus,
  getStatusBadgeColor,
  timeAgo,
} from "@/lib/utils";
import { campaignService } from "@/services/campaignService";
import { communicationService } from "@/services/communicationService";
import type { Campaign, CustomerType } from "@/types";

const statusTabs: Array<{ label: string; value: Campaign["status"] | "all" }> = [
  { label: "Tất cả", value: "all" },
  { label: "Bản nháp", value: "draft" },
  { label: "Lên lịch", value: "scheduled" },
  { label: "Đang gửi", value: "sending" },
  { label: "Đã gửi", value: "sent" },
  { label: "Đã hủy", value: "cancelled" },
];

const typeCounts: Record<CustomerType, number> = {
  vip: 48,
  loyal: 156,
  potential: 287,
  new: 312,
  inactive: 44,
};

const variableTokens = ["{ten_khach_hang}", "{ma_khach_hang}", "{tong_chi_tieu}", "{lan_mua_cuoi}"];

type WizardState = {
  name: string;
  description: string;
  channel: Campaign["channel"];
  customer_types: CustomerType[];
  subject: string;
  content: string;
  scheduleMode: "now" | "later";
  scheduledAt: string;
};

type ComposerTab = "audience" | "content" | "schedule";

const composerTabOrder: ComposerTab[] = ["audience", "content", "schedule"];

const initialWizardState: WizardState = {
  name: "",
  description: "",
  channel: "email",
  customer_types: ["vip"],
  subject: "",
  content: "",
  scheduleMode: "now",
  scheduledAt: "",
};

function toDateTimeLocalInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatCampaignStatus(status: Campaign["status"]) {
  const map: Record<Campaign["status"], string> = {
    draft: "Bản nháp",
    scheduled: "Lên lịch",
    sending: "Đang gửi",
    sent: "Đã gửi",
    sent_with_errors: "Gửi có lỗi",
    cancelled: "Đã hủy",
  };

  return map[status];
}

function getCampaignStatusColor(status: Campaign["status"]) {
  const map: Record<Campaign["status"], string> = {
    draft: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
    scheduled: "bg-warning/10 text-warning border-warning/20",
    sending: "bg-warning/10 text-warning border-warning/20",
    sent: "bg-success/10 text-success border-success/20",
    sent_with_errors: "bg-warning/10 text-warning border-warning/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return map[status];
}

function formatChannel(channel: Campaign["channel"]) {
  if (channel === "both") return "Email + SMS";
  if (channel === "sms") return "SMS";
  return "Email";
}

function formatCustomerTypes(types?: CustomerType[]) {
  if (!types?.length) {
    return "Tất cả phân khúc";
  }

  return types.join(", ");
}

function estimateRecipients(types: CustomerType[]) {
  return types.reduce((sum, type) => sum + (typeCounts[type] ?? 0), 0);
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col text-sm">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function CampaignListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useCampaignsQuery();
  const [statusFilter, setStatusFilter] = useState<Campaign["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [composerOpenLocal, setComposerOpenLocal] = useState(false);
  const [composerTab, setComposerTab] = useState<ComposerTab>("audience");
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const requestedCreate = searchParams.get("create") === "1";
  const composerOpen = requestedCreate || composerOpenLocal;
  const { data: detailMessages = [] } = useOutboundMessagesQuery(
    detailCampaign ? { campaignId: detailCampaign.id } : undefined,
    Boolean(detailCampaign),
  );

  const clearCreateParam = () => {
    if (!requestedCreate) return;
    const next = new URLSearchParams(searchParams);
    next.delete("create");
    setSearchParams(next, { replace: true });
  };

  const estimatedRecipients = estimateRecipients(wizard.customer_types);

  const filteredCampaigns = useMemo(
    () =>
      campaigns.filter((campaign) => {
        if (statusFilter !== "all" && campaign.status !== statusFilter) {
          return false;
        }

        if (search) {
          const haystack = `${campaign.name} ${campaign.description ?? ""} ${campaign.subject ?? ""}`.toLowerCase();
          if (!haystack.includes(search.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    [campaigns, search, statusFilter],
  );

  const totalPages = Math.max(1, Math.ceil(filteredCampaigns.length / 10));
  const currentPage = Math.min(page, totalPages);
  const pagedCampaigns = filteredCampaigns.slice((currentPage - 1) * 10, currentPage * 10);

  const summary = useMemo(() => {
    const sent = filteredCampaigns.reduce((sum, item) => sum + item.sent_count, 0);
    const opened = filteredCampaigns.reduce((sum, item) => sum + item.opened_count, 0);
    const failed = filteredCampaigns.reduce((sum, item) => sum + (item.failed_count ?? 0), 0);
    const recipientCount = filteredCampaigns.reduce((sum, item) => sum + item.recipient_count, 0);
    return { sent, opened, failed, recipientCount };
  }, [filteredCampaigns]);

  const previewContent = wizard.content
    .replaceAll("{ten_khach_hang}", "Nguyễn Minh Anh")
    .replaceAll("{ma_khach_hang}", "KH-2026-0182")
    .replaceAll("{tong_chi_tieu}", "18.500.000 ₫")
    .replaceAll("{lan_mua_cuoi}", "3 ngày trước");
  const sectionValidation = useMemo<Record<ComposerTab, string[]>>(() => {
    const audienceErrors: string[] = [];
    const contentErrors: string[] = [];
    const scheduleErrors: string[] = [];

    if (wizard.name.trim().length < 3) {
      audienceErrors.push("Tên chiến dịch cần tối thiểu 3 ký tự.");
    }
    if (!wizard.customer_types.length) {
      audienceErrors.push("Cần chọn ít nhất một phân khúc khách hàng.");
    }
    if (wizard.channel !== "sms" && wizard.subject.trim().length < 3) {
      contentErrors.push("Campaign email cần subject rõ ràng (ít nhất 3 ký tự).");
    }
    if (wizard.content.trim().length < 10) {
      contentErrors.push("Nội dung chiến dịch cần tối thiểu 10 ký tự.");
    }
    if (wizard.scheduleMode === "later") {
      if (!wizard.scheduledAt) {
        scheduleErrors.push("Vui lòng chọn thời điểm đặt lịch.");
      }
    }

    return {
      audience: audienceErrors,
      content: contentErrors,
      schedule: scheduleErrors,
    };
  }, [wizard]);
  const currentStepIndex = composerTabOrder.indexOf(composerTab);
  const isFirstComposerStep = currentStepIndex <= 0;
  const isLastComposerStep = currentStepIndex === composerTabOrder.length - 1;
  const canSubmitCampaign = composerTabOrder.every((tabKey) => sectionValidation[tabKey].length === 0);

  useEffect(() => {
    if (!requestedCreate) return;
    setEditingCampaign(null);
    setWizard(initialWizardState);
    setComposerTab("audience");
  }, [requestedCreate]);

  const runScheduler = useAppMutation({
    action: "scheduler.tick",
    errorMessage: "Không thể chạy scheduler chiến dịch.",
    mutationFn: () => communicationService.runSchedulerTick(),
    onSuccess: (result) => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["automation-rules"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["outbound-messages"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["notifications"], refetchType: "active" }),
      ]);

      const processed = result.processedCampaigns + result.processedAutomationRules;
      if (processed > 0) {
        toast.success(`Scheduler đã xử lý ${processed} job đến hạn.`);
      } else {
        toast("Không có job đến hạn để chạy.");
      }
    },
  });

  const upsertCampaign = useAppMutation({
    action: editingCampaign ? "campaign.update" : "campaign.create",
    errorMessage: "Không thể lưu chiến dịch.",
    mutationFn: async (submitMode: "draft" | "send_now" | "schedule") => {
      const firstInvalidStep = composerTabOrder.find((tabKey) => sectionValidation[tabKey].length > 0);
      if (firstInvalidStep) {
        throw new Error(sectionValidation[firstInvalidStep][0] ?? "Thông tin chiến dịch chưa hợp lệ.");
      }
      if (
        submitMode === "schedule" &&
        (!wizard.scheduledAt || new Date(wizard.scheduledAt).getTime() <= Date.now() + 30_000)
      ) {
        throw new Error("Thời điểm đặt lịch phải lớn hơn thời điểm hiện tại.");
      }

      const shouldSchedule = submitMode === "schedule";
      const payload = {
        name: wizard.name,
        description: wizard.description,
        channel: wizard.channel,
        customer_types: wizard.customer_types,
        subject: wizard.subject,
        content: wizard.content,
        recipient_count: estimatedRecipients,
        status: shouldSchedule ? "scheduled" : "draft",
        scheduled_at:
          shouldSchedule && wizard.scheduledAt
            ? new Date(wizard.scheduledAt).toISOString()
            : null,
      } as const;
      const campaign = editingCampaign
        ? await campaignService.update(editingCampaign.id, payload)
        : await campaignService.create(payload);

      if (submitMode === "send_now") {
        const dispatchResult = await communicationService.dispatchCampaign(campaign.id);
        return {
          campaign: dispatchResult.campaign,
          submitMode,
        };
      }

      return {
        campaign,
        submitMode,
      };
    },
    onSuccess: ({ campaign: savedCampaign, submitMode }) => {
      queryClient.setQueriesData<Campaign[]>({ queryKey: ["campaigns"] }, (current = []) => {
        const existingIndex = current.findIndex((campaign) => campaign.id === savedCampaign.id);
        if (existingIndex === -1) {
          return [savedCampaign, ...current];
        }

        return current.map((campaign) =>
          campaign.id === savedCampaign.id ? savedCampaign : campaign,
        );
      });
      if (detailCampaign?.id === savedCampaign.id) {
        setDetailCampaign(savedCampaign);
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" }),
        queryClient.invalidateQueries({
          queryKey: ["outbound-messages"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({ queryKey: ["notifications"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      if (submitMode === "send_now") {
        toast.success("Đã lưu và gửi chiến dịch.");
      } else if (submitMode === "schedule") {
        toast.success("Đã lưu chiến dịch theo lịch.");
      } else {
        toast.success(editingCampaign ? "Đã lưu bản nháp chiến dịch." : "Đã tạo bản nháp chiến dịch.");
      }
      setComposerOpenLocal(false);
      setEditingCampaign(null);
      setWizard(initialWizardState);
      setComposerTab("audience");
      clearCreateParam();
    },
  });

  const sendCampaign = useAppMutation({
    action: "campaign.send",
    errorMessage: "Không thể gửi chiến dịch.",
    mutationFn: (campaignId: string) => communicationService.dispatchCampaign(campaignId),
    onSuccess: (result) => {
      queryClient.setQueriesData<Campaign[]>({ queryKey: ["campaigns"] }, (current = []) =>
        current.map((campaign) =>
          campaign.id === result.campaign.id ? result.campaign : campaign,
        ),
      );
      if (detailCampaign?.id === result.campaign.id) {
        setDetailCampaign(result.campaign);
      }
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" }),
        queryClient.invalidateQueries({
          queryKey: ["outbound-messages"],
          refetchType: "active",
        }),
        queryClient.invalidateQueries({ queryKey: ["notifications"], refetchType: "active" }),
        queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" }),
      ]);
      toast.success("Đã khởi động chiến dịch");
    },
  });

  const duplicateCampaign = useAppMutation({
    action: "campaign.duplicate",
    errorMessage: "Không thể nhân bản chiến dịch.",
    mutationFn: campaignService.duplicate,
    onSuccess: (newCampaign) => {
      queryClient.setQueriesData<Campaign[]>({ queryKey: ["campaigns"] }, (current = []) => [
        newCampaign,
        ...current.filter((campaign) => campaign.id !== newCampaign.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" });
      toast.success("Đã nhân bản chiến dịch");
    },
  });

  const deleteCampaign = useAppMutation({
    action: "campaign.delete",
    errorMessage: "Không thể xóa chiến dịch.",
    mutationFn: campaignService.delete,
    onSuccess: (_, deletedCampaignId) => {
      queryClient.setQueriesData<Campaign[]>({ queryKey: ["campaigns"] }, (current = []) =>
        current.filter((campaign) => campaign.id !== deletedCampaignId),
      );
      if (detailCampaign?.id === deletedCampaignId) {
        setDetailCampaign(null);
      }
      void queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" });
      toast.success("Đã xóa chiến dịch");
    },
  });

  const openComposer = (campaign?: Campaign | null) => {
    setEditingCampaign(campaign ?? null);
    setWizard(
      campaign
        ? {
            name: campaign.name,
            description: campaign.description ?? "",
            channel: campaign.channel,
            customer_types: campaign.customer_types ?? ["vip"],
            subject: campaign.subject,
            content: campaign.content,
            scheduleMode: campaign.scheduled_at ? "later" : "now",
            scheduledAt: toDateTimeLocalInput(campaign.scheduled_at),
          }
        : initialWizardState,
    );
    setComposerTab("audience");
    setComposerOpenLocal(true);
  };

  const sendingCampaignId = sendCampaign.isPending ? sendCampaign.variables : null;
  const duplicatingCampaignId = duplicateCampaign.isPending ? duplicateCampaign.variables : null;
  const deletingCampaignId = deleteCampaign.isPending ? deleteCampaign.variables : null;

  const appendVariable = (token: string) => {
    setWizard((current) => ({ ...current, content: `${current.content} ${token}`.trim() }));
  };

  const goComposerStep = (direction: 1 | -1) => {
    if (direction > 0 && sectionValidation[composerTab].length > 0) {
      toast.error(sectionValidation[composerTab][0]);
      return;
    }

    const nextStep = composerTabOrder[currentStepIndex + direction];
    if (nextStep) {
      setComposerTab(nextStep);
    }
  };

  const handleComposerTabChange = (nextTabValue: string) => {
    const nextTab = nextTabValue as ComposerTab;
    const nextIndex = composerTabOrder.indexOf(nextTab);

    if (nextIndex === -1) return;

    if (nextIndex > currentStepIndex) {
      for (let index = currentStepIndex; index < nextIndex; index += 1) {
        const step = composerTabOrder[index];
        if (sectionValidation[step].length > 0) {
          toast.error(sectionValidation[step][0]);
          return;
        }
      }
    }

    setComposerTab(nextTab);
  };

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chiến Dịch"
        // subtitle="Quản lý danh sách chiến dịch, hiệu suất và hành động gửi nhanh trên cùng một bảng."
        actions={<Badge className="bg-primary/10 text-primary ring-primary/20">{campaigns.length} chiến dịch</Badge>}
      />

      <MetricStrip>
        <MetricStripItem
          label="Tệp nhận"
          value={formatNumberCompact(summary.recipientCount)}
          helper="Tổng người nhận của danh sách hiện tại."
          icon={Megaphone}
          tone="primary"
        />
        <MetricStripItem
          label="Đã gửi"
          value={formatNumberCompact(summary.sent)}
          helper="Tổng message đã rời hàng đợi."
          icon={Send}
          tone="success"
        />
        <MetricStripItem
          label="Đã mở"
          value={formatNumberCompact(summary.opened)}
          helper="Theo dữ liệu outbound hiện có."
          icon={Eye}
          tone="info"
        />
        <MetricStripItem
          label="Thất bại"
          value={formatNumberCompact(summary.failed)}
          helper="Dùng để ưu tiên kiểm tra provider."
          icon={AlertTriangle}
          tone="danger"
        />
      </MetricStrip>

      <StickyFilterBar>
        <div className="relative min-w-[260px] flex-1">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên, mô tả hoặc subject"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center border-b-2 px-3 py-2 text-sm font-medium transition",
                statusFilter === tab.value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => runScheduler.mutate()}
            disabled={runScheduler.isPending}
          >
            <CalendarClock className="size-4" />
            {runScheduler.isPending ? "Đang chạy lịch..." : "Chạy lịch"}
          </Button>
          <Can roles={["super_admin", "admin", "director", "marketing"]}>
            <Button size="sm" onClick={() => openComposer()}>
              <Plus className="size-4" />
              Tạo chiến dịch
            </Button>
          </Can>
        </div>
      </StickyFilterBar>

      <DataTableShell
        stickyHeader
        footer={
          <CompactPagination
            page={currentPage}
            totalPages={totalPages}
            label={`${filteredCampaigns.length} chiến dịch`}
            onPrevious={() => setPage(Math.max(1, currentPage - 1))}
            onNext={() => setPage(Math.min(totalPages, currentPage + 1))}
          />
        }
      >
        {filteredCampaigns.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Chiến dịch</TableHead>
                <TableHead>Kênh</TableHead>
                <TableHead>Tệp nhận</TableHead>
                <TableHead>Lịch / gửi</TableHead>
                <TableHead>Hiệu quả</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedCampaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <StatusBadge
                      label={formatCampaignStatus(campaign.status)}
                      className={getCampaignStatusColor(campaign.status)}
                      dotClassName="bg-current"
                    />
                  </TableCell>
                  <TableCell>
                    <button type="button" onClick={() => setDetailCampaign(campaign)} className="min-w-0 text-left">
                      <div className="truncate text-sm font-medium text-foreground">{campaign.name}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {campaign.description || campaign.subject || "Chưa có mô tả"}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{formatChannel(campaign.channel)}</div>
                    <div className="text-xs text-muted-foreground">{formatCustomerTypes(campaign.customer_types)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold">{formatNumberCompact(campaign.recipient_count)}</div>
                    <div className="text-xs text-muted-foreground">khách hàng</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {campaign.sent_at
                        ? `Đã gửi ${timeAgo(campaign.sent_at)}`
                        : campaign.scheduled_at
                          ? `Lên lịch ${formatDate(campaign.scheduled_at)}`
                          : `Tạo ${timeAgo(campaign.created_at)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(campaign.created_at)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[220px] truncate text-sm font-medium">
                      Open {formatPercentValue(campaign.open_rate, { alreadyPercent: true })} / Click{" "}
                      {formatPercentValue(campaign.click_rate, { alreadyPercent: true })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {campaign.sent_count} gửi · {campaign.failed_count ?? 0} fail
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label={`Xem ${campaign.name}`} onClick={() => setDetailCampaign(campaign)}>
                        <Eye className="size-4" />
                      </Button>
                      {campaign.status === "scheduled" ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Gửi ${campaign.name}`}
                          onClick={() => sendCampaign.mutate(campaign.id)}
                          disabled={sendingCampaignId === campaign.id}
                        >
                          <Send className="size-4" />
                        </Button>
                      ) : null}
                      <Button variant="ghost" size="icon" aria-label={`Sửa ${campaign.name}`} onClick={() => openComposer(campaign)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Nhân bản ${campaign.name}`}
                        onClick={() => duplicateCampaign.mutate(campaign.id)}
                        disabled={duplicatingCampaignId === campaign.id}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa ${campaign.name}`}
                        onClick={() => setDeleteTarget(campaign)}
                        disabled={deletingCampaignId === campaign.id}
                      >
                        <Trash2 className="size-4 text-rose-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4 lg:p-5">
            <EmptyState
              icon={Megaphone}
              title="Không có chiến dịch phù hợp"
              description="Thử đổi tab trạng thái, tìm kiếm khác hoặc tạo chiến dịch mới."
              className="min-h-[260px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>
      
      <Sheet
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpenLocal(open);
          if (!open) {
            setEditingCampaign(null);
            clearCreateParam();
          }
        }}
        title={editingCampaign ? "Chỉnh sửa chiến dịch" : "Tạo chiến dịch"}
        // description="Biên tập audience, nội dung và lịch gửi trong cùng một side sheet."
        className="w-[min(100vw,560px)]"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setComposerOpenLocal(false);
                clearCreateParam();
              }}
            >
              Hủy
            </Button>
            <div className="flex items-center gap-2">
              {!isFirstComposerStep ? (
                <Button type="button" variant="secondary" onClick={() => goComposerStep(-1)}>
                  Quay lại
                </Button>
              ) : null}
              {!isLastComposerStep ? (
                <Button
                  type="button"
                  onClick={() => goComposerStep(1)}
                  disabled={sectionValidation[composerTab].length > 0}
                >
                  Tiếp tục
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => upsertCampaign.mutate("draft")}
                    disabled={upsertCampaign.isPending || !canSubmitCampaign}
                  >
                    Lưu nháp
                  </Button>
                  <Button
                    onClick={() =>
                      upsertCampaign.mutate(
                        wizard.scheduleMode === "later" ? "schedule" : "send_now",
                      )
                    }
                    disabled={upsertCampaign.isPending || !canSubmitCampaign}
                  >
                    {upsertCampaign.isPending
                      ? "Đang lưu..."
                      : wizard.scheduleMode === "later"
                        ? "Lưu lịch"
                        : "Gửi ngay"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {upsertCampaign.actionError ? (
            <ActionErrorAlert
              error={upsertCampaign.actionError}
              onDismiss={upsertCampaign.clearActionError}
              onRetry={upsertCampaign.canRetry ? () => void upsertCampaign.retryLast() : undefined}
            />
          ) : null}

          <Tabs value={composerTab} onValueChange={handleComposerTabChange}>
            <TabsList className="w-full justify-start">
              <TabsTrigger value="audience">Audience</TabsTrigger>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
            </TabsList>

            <TabsContent value="audience" className="space-y-4">
              <Field label="Tên chiến dịch">
                <Input value={wizard.name} onChange={(event) => setWizard({ ...wizard, name: event.target.value })} />
              </Field>
              <Field label="Mô tả ngắn" hint="Tối đa 1 dòng mô tả">
                <Textarea value={wizard.description} onChange={(event) => setWizard({ ...wizard, description: event.target.value })} rows={3} />
              </Field>
              <Field label="Kênh">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Email", value: "email" },
                    { label: "SMS", value: "sms" },
                    { label: "Cả hai", value: "both" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWizard({ ...wizard, channel: option.value as Campaign["channel"] })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm transition",
                        wizard.channel === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Đối tượng" hint={`${estimatedRecipients} khách hàng dự kiến`}>
                <div className="space-y-2">
                  {[
                    { label: "VIP", value: "vip" as const },
                    { label: "Thân thiết", value: "loyal" as const },
                    { label: "Tiềm năng", value: "potential" as const },
                    { label: "Mới", value: "new" as const },
                  ].map((option) => (
                    <label key={option.value} className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={wizard.customer_types.includes(option.value)}
                          onChange={(event) =>
                            setWizard({
                              ...wizard,
                              customer_types: event.target.checked
                                ? [...wizard.customer_types, option.value]
                                : wizard.customer_types.filter((item) => item !== option.value),
                            })
                          }
                        />
                        <span className="text-sm">{option.label}</span>
                      </div>
                      <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        {typeCounts[option.value]}
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              {sectionValidation.audience.length ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {sectionValidation.audience[0]}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="content" className="space-y-4">
              {wizard.channel !== "sms" ? (
                <Field label="Subject">
                  <Input value={wizard.subject} onChange={(event) => setWizard({ ...wizard, subject: event.target.value })} />
                </Field>
              ) : null}
              <Field label="Nội dung" hint={wizard.channel === "sms" ? `${wizard.content.length}/160 ký tự` : "Dùng token để cá nhân hóa"}>
                <Textarea value={wizard.content} onChange={(event) => setWizard({ ...wizard, content: event.target.value })} rows={8} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {variableTokens.map((token) => (
                  <Button key={token} type="button" variant="secondary" size="sm" onClick={() => appendVariable(token)}>
                    {token}
                  </Button>
                ))}
              </div>
              <Card>
                <CardHeader className="compact-panel-header">
                  <SectionHeaderCompact title="Preview" /* description="Bản xem nhanh của nội dung gửi." */ />
                </CardHeader>
                <CardContent className="space-y-3 p-4 text-sm">
                  {wizard.subject ? (
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Subject</div>
                      <div className="mt-1 font-medium">{wizard.subject}</div>
                    </div>
                  ) : null}
                  <div className="rounded-lg bg-muted/40 p-3 text-muted-foreground">
                    {previewContent || "Nội dung xem trước sẽ xuất hiện ở đây."}
                  </div>
                </CardContent>
              </Card>
              {sectionValidation.content.length ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {sectionValidation.content[0]}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              <Field label="Chế độ gửi">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setWizard({ ...wizard, scheduleMode: "now" })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition",
                      wizard.scheduleMode === "now"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    Gửi ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizard({ ...wizard, scheduleMode: "later" })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm transition",
                      wizard.scheduleMode === "later"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    Đặt lịch
                  </button>
                </div>
              </Field>
              {wizard.scheduleMode === "later" ? (
                <Field label="Thời điểm gửi">
                  <Input
                    type="datetime-local"
                    value={wizard.scheduledAt}
                    onChange={(event) => setWizard({ ...wizard, scheduledAt: event.target.value })}
                  />
                </Field>
              ) : null}
              <Card>
                <CardHeader className="compact-panel-header">
                  <SectionHeaderCompact title="Tóm tắt" /* description="Thông tin cuối cùng trước khi lưu hoặc gửi." */ />
                </CardHeader>
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Chiến dịch</span>
                    <span>{wizard.name || "--"}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Kênh</span>
                    <span>{formatChannel(wizard.channel)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Tệp nhận</span>
                    <span>{estimatedRecipients} khách hàng</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-muted-foreground">Lịch gửi</span>
                    <span>{wizard.scheduleMode === "later" ? wizard.scheduledAt || "--" : "Gửi ngay"}</span>
                  </div>
                </CardContent>
              </Card>
              {sectionValidation.schedule.length ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  {sectionValidation.schedule[0]}
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </Sheet>

      <Sheet
        open={Boolean(detailCampaign)}
        onOpenChange={(open) => {
          if (!open) {
            setDetailCampaign(null);
          }
        }}
        title={detailCampaign?.name ?? "Chi tiết chiến dịch"}
        // description={detailCampaign ? "Inspector cho nội dung, hiệu suất gửi và nhóm action chính của chiến dịch." : undefined}
        className="w-[min(100vw,720px)]"
        footer={
          detailCampaign ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setDetailCampaign(null)}>
                Đóng
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                {(detailCampaign.status === "draft" || detailCampaign.status === "scheduled") ? (
                  <Button
                    variant="outline"
                    onClick={() => sendCampaign.mutate(detailCampaign.id)}
                    disabled={sendingCampaignId === detailCampaign.id}
                  >
                    <Send className="size-4" />
                    Chạy ngay
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => duplicateCampaign.mutate(detailCampaign.id)}
                  disabled={duplicatingCampaignId === detailCampaign.id}
                >
                  <Copy className="size-4" />
                  Nhân bản
                </Button>
                <Button
                  onClick={() => {
                    const current = detailCampaign;
                    setDetailCampaign(null);
                    openComposer(current);
                  }}
                >
                  <Pencil className="size-4" />
                  Chỉnh sửa
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDeleteTarget(detailCampaign);
                    setDetailCampaign(null);
                  }}
                  disabled={deletingCampaignId === detailCampaign.id}
                >
                  <Trash2 className="size-4" />
                  Xóa
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {detailCampaign ? (
          <div className="space-y-4">
            <Card>
              <CardHeader className="compact-panel-header">
                <SectionHeaderCompact
                  title="Tổng quan vận hành"
                  // description="Thông tin đủ để quyết định gửi, chỉnh sửa hoặc dừng chiến dịch."
                />
              </CardHeader>
              <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Trạng thái</div>
                  <StatusBadge
                    label={formatCampaignStatus(detailCampaign.status)}
                    className={cn("mt-2", getCampaignStatusColor(detailCampaign.status))}
                    dotClassName="bg-current"
                  />
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Kênh</div>
                  <div className="mt-2 text-sm font-medium">{formatChannel(detailCampaign.channel)}</div>
                  <div className="text-xs text-muted-foreground">{formatCustomerTypes(detailCampaign.customer_types)}</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Tệp nhận</div>
                  <div className="mt-2 text-lg font-semibold">{detailCampaign.recipient_count}</div>
                  <div className="text-xs text-muted-foreground">khách hàng dự kiến</div>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Hiệu suất</div>
                  <div className="mt-2 text-sm font-medium">
                    Open {formatPercentValue(detailCampaign.open_rate, { alreadyPercent: true })} · Click{" "}
                    {formatPercentValue(detailCampaign.click_rate, { alreadyPercent: true })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {detailCampaign.sent_count} gửi · {detailCampaign.failed_count ?? 0} lỗi
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="compact-panel-header">
                <SectionHeaderCompact title="Nội dung gửi" /* description="Xem nhanh subject và body đã biên tập." */ />
              </CardHeader>
              <CardContent className="space-y-3 p-4 text-sm">
                {detailCampaign.subject ? (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Subject</div>
                    <div className="mt-1 font-medium text-foreground">{detailCampaign.subject}</div>
                  </div>
                ) : null}
                <div className="rounded-lg border border-border/70 bg-muted/35 p-3 text-muted-foreground">
                  {detailCampaign.content}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="compact-panel-header">
                <SectionHeaderCompact
                  title="Recent delivery"
                  description="5 lần gửi gần nhất để kiểm tra provider và trạng thái delivery."
                />
              </CardHeader>
              <CardContent className="p-0">
                {detailMessages.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Người nhận</TableHead>
                        <TableHead>Kênh</TableHead>
                        <TableHead>Trạng thái</TableHead>
                        <TableHead>Thời điểm</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailMessages.slice(0, 5).map((message) => (
                        <TableRow key={message.id}>
                          <TableCell className="max-w-[180px] truncate text-sm">{message.recipient}</TableCell>
                          <TableCell className="text-sm uppercase">{message.channel}</TableCell>
                          <TableCell>
                            <StatusBadge
                              label={formatTicketStatus(message.status)}
                              className={getStatusBadgeColor(message.status)}
                              dotClassName="bg-current"
                            />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {message.sent_at ? timeAgo(message.sent_at) : timeAgo(message.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-4">
                    <EmptyState
                      icon={AlertTriangle}
                      title="Chưa có bản ghi gửi"
                      description="Chiến dịch này chưa tạo outbound message hoặc chưa vào hàng đợi gửi."
                      className="min-h-[220px] border-dashed bg-transparent shadow-none"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title="Xóa chiến dịch"
        description="Hành động này sẽ xóa chiến dịch khỏi danh sách và không thể hoàn tác."
        confirmLabel="Xóa chiến dịch"
        onConfirm={() => {
          if (deleteTarget) {
            deleteCampaign.mutate(deleteTarget.id);
          }
        }}
      >
        {deleteTarget ? (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-sm">
            <div className="font-medium text-foreground">{deleteTarget.name}</div>
            <div className="mt-1 text-muted-foreground">
              {deleteTarget.recipient_count} khách hàng · {formatCampaignStatus(deleteTarget.status)}
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
