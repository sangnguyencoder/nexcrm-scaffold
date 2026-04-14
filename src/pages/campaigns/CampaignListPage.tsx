import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  Eye,
  Megaphone,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
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
import { cn, formatDate, formatNumberCompact, timeAgo } from "@/lib/utils";
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

function formatCampaignStatus(status: Campaign["status"]) {
  const map: Record<Campaign["status"], string> = {
    draft: "Bản nháp",
    scheduled: "Lên lịch",
    sending: "Đang gửi",
    sent: "Đã gửi",
    cancelled: "Đã hủy",
  };

  return map[status];
}

function getCampaignStatusColor(status: Campaign["status"]) {
  const map: Record<Campaign["status"], string> = {
    draft: "bg-slate-500/15 text-slate-600 ring-slate-500/25 dark:text-slate-300",
    scheduled: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
    sending: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
    sent: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    cancelled: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
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
    <label className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{label}</span>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function CampaignListPage() {
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useCampaignsQuery();
  const [statusFilter, setStatusFilter] = useState<Campaign["status"] | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTab, setComposerTab] = useState("audience");
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const { data: detailMessages = [] } = useOutboundMessagesQuery(
    detailCampaign ? { campaignId: detailCampaign.id } : undefined,
    Boolean(detailCampaign),
  );

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

  const upsertCampaign = useAppMutation({
    action: editingCampaign ? "campaign.update" : "campaign.create",
    errorMessage: "Không thể lưu chiến dịch.",
    mutationFn: async () => {
      const payload = {
        name: wizard.name,
        description: wizard.description,
        channel: wizard.channel,
        customer_types: wizard.customer_types,
        subject: wizard.subject,
        content: wizard.content,
        recipient_count: estimatedRecipients,
        status: wizard.scheduleMode === "now" ? "draft" : "scheduled",
        scheduled_at:
          wizard.scheduleMode === "later" && wizard.scheduledAt
            ? new Date(wizard.scheduledAt).toISOString()
            : null,
      } as const;
      const campaign = editingCampaign
        ? await campaignService.update(editingCampaign.id, payload)
        : await campaignService.create(payload);

      if (wizard.scheduleMode === "now") {
        const dispatchResult = await communicationService.dispatchCampaign(campaign.id);
        return dispatchResult.campaign;
      }

      return campaign;
    },
    onSuccess: (savedCampaign) => {
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
      void queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" });
      void queryClient.invalidateQueries({
        queryKey: ["outbound-messages"],
        refetchType: "active",
      });
      void queryClient.invalidateQueries({ queryKey: ["notifications"], refetchType: "active" });
      void queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" });
      toast.success(editingCampaign ? "Đã cập nhật chiến dịch" : "Đã tạo chiến dịch mới");
      setComposerOpen(false);
      setEditingCampaign(null);
      setWizard(initialWizardState);
      setComposerTab("audience");
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
      void queryClient.invalidateQueries({ queryKey: ["campaigns"], refetchType: "active" });
      void queryClient.invalidateQueries({
        queryKey: ["outbound-messages"],
        refetchType: "active",
      });
      void queryClient.invalidateQueries({ queryKey: ["notifications"], refetchType: "active" });
      void queryClient.invalidateQueries({ queryKey: ["audit"], refetchType: "active" });
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
            scheduledAt: campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : "",
          }
        : initialWizardState,
    );
    setComposerTab("audience");
    setComposerOpen(true);
  };

  const appendVariable = (token: string) => {
    setWizard((current) => ({ ...current, content: `${current.content} ${token}`.trim() }));
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
        <MetricStripItem label="Tệp nhận" value={formatNumberCompact(summary.recipientCount)} helper="Tổng người nhận của danh sách hiện tại." />
        <MetricStripItem label="Đã gửi" value={formatNumberCompact(summary.sent)} helper="Tổng message đã rời hàng đợi." />
        <MetricStripItem label="Đã mở" value={formatNumberCompact(summary.opened)} helper="Theo dữ liệu outbound hiện có." />
        <MetricStripItem label="Thất bại" value={formatNumberCompact(summary.failed)} helper="Dùng để ưu tiên kiểm tra provider." />
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
                "rounded-md px-3 py-1.5 text-sm font-medium transition",
                statusFilter === tab.value
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openComposer()}>
            <Plus className="size-4" />
            Tạo chiến dịch
          </Button>
        </div>
      </StickyFilterBar>

      <DataTableShell
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
                    <div className="text-sm font-medium">
                      Open {campaign.open_rate ?? 0}% / Click {campaign.click_rate ?? 0}%
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
                      {(campaign.status === "draft" || campaign.status === "scheduled") ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Gửi ${campaign.name}`}
                          onClick={() => sendCampaign.mutate(campaign.id)}
                          disabled={sendCampaign.isPending}
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
                        disabled={duplicateCampaign.isPending}
                      >
                        <Copy className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Xóa ${campaign.name}`}
                        onClick={() => setDeleteTarget(campaign)}
                        disabled={deleteCampaign.isPending}
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
          setComposerOpen(open);
          if (!open) {
            setEditingCampaign(null);
          }
        }}
        title={editingCampaign ? "Chỉnh sửa chiến dịch" : "Tạo chiến dịch"}
        // description="Biên tập audience, nội dung và lịch gửi trong cùng một side sheet."
        className="w-[min(100vw,560px)]"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setComposerOpen(false)}>
              Hủy
            </Button>
            <Button onClick={() => upsertCampaign.mutate()} disabled={upsertCampaign.isPending}>
              {upsertCampaign.isPending
                ? "Đang lưu..."
                : wizard.scheduleMode === "now"
                  ? "Lưu & gửi"
                  : "Lưu chiến dịch"}
            </Button>
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

          <Tabs value={composerTab} onValueChange={setComposerTab}>
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
                    disabled={sendCampaign.isPending}
                  >
                    <Send className="size-4" />
                    Chạy ngay
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={() => duplicateCampaign.mutate(detailCampaign.id)}
                  disabled={duplicateCampaign.isPending}
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
                  disabled={deleteCampaign.isPending}
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
                    Open {detailCampaign.open_rate ?? 0}% · Click {detailCampaign.click_rate ?? 0}%
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
                          <TableCell className="text-sm">{message.status}</TableCell>
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
