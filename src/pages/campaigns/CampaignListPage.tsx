import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  Eye,
  Image as ImageIcon,
  Megaphone,
  Pencil,
  Percent,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useCampaignsQuery, useOutboundMessagesQuery } from "@/hooks/useNexcrmQueries";
import { cn, formatDate, timeAgo } from "@/lib/utils";
import { campaignService } from "@/services/campaignService";
import { communicationService } from "@/services/communicationService";
import { getAppErrorMessage } from "@/services/shared";
import type { Campaign, CustomerType } from "@/types";

const statusTabs: Array<{ label: string; value: Campaign["status"] | "all" }> = [
  { label: "Tất Cả", value: "all" },
  { label: "Bản Nháp", value: "draft" },
  { label: "Đã Lên Lịch", value: "scheduled" },
  { label: "Đang Gửi", value: "sending" },
  { label: "Đã Gửi", value: "sent" },
  { label: "Đã Hủy", value: "cancelled" },
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

function getCampaignBannerTone(channel: Campaign["channel"]) {
  if (channel === "both") return "from-primary/25 via-emerald-500/10 to-sky-500/10";
  if (channel === "sms") return "from-emerald-500/25 via-primary/10 to-transparent";
  return "from-sky-500/25 via-primary/10 to-transparent";
}

export function CampaignListPage() {
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useCampaignsQuery();
  const [statusFilter, setStatusFilter] = useState<Campaign["status"] | "all">("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const { data: detailMessages = [] } = useOutboundMessagesQuery(
    detailCampaign ? { campaignId: detailCampaign.id } : undefined,
    Boolean(detailCampaign),
  );

  const filteredCampaigns = useMemo(
    () => campaigns.filter((campaign) => (statusFilter === "all" ? true : campaign.status === statusFilter)),
    [campaigns, statusFilter],
  );
  const estimatedRecipients = wizard.customer_types.reduce(
    (sum, type) => sum + (typeCounts[type] ?? 0),
    0,
  );

  const previewContent = wizard.content
    .replaceAll("{ten_khach_hang}", "Nguyễn Minh Anh")
    .replaceAll("{ma_khach_hang}", "KH-2026-0182")
    .replaceAll("{tong_chi_tieu}", "18.500.000 ₫")
    .replaceAll("{lan_mua_cuoi}", "3 ngày trước");

  const upsertCampaign = useMutation({
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
        await communicationService.dispatchCampaign(campaign.id);
      }

      return campaign;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["outbound-messages"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
      toast.success(editingCampaign ? "Đã cập nhật chiến dịch" : "Đã tạo chiến dịch mới");
      setWizardOpen(false);
      setEditingCampaign(null);
      setWizard(initialWizardState);
      setStep(1);
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể lưu chiến dịch."));
    },
  });

  const sendCampaign = useMutation({
    mutationFn: (campaignId: string) => communicationService.dispatchCampaign(campaignId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["outbound-messages"] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["audit"] }),
      ]);
      toast.success("Đã khởi động chiến dịch");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể gửi chiến dịch."));
    },
  });

  const duplicateCampaign = useMutation({
    mutationFn: campaignService.duplicate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Đã nhân bản chiến dịch");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể nhân bản chiến dịch."));
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: campaignService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Đã xóa chiến dịch");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể xóa chiến dịch."));
    },
  });

  const openWizard = (campaign?: Campaign | null) => {
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
    setStep(1);
    setWizardOpen(true);
  };

  const appendVariable = (token: string) => {
    setWizard((current) => ({ ...current, content: `${current.content} ${token}`.trim() }));
  };

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chiến Dịch Marketing"
        subtitle="Theo dõi hiệu quả gửi email, SMS và chăm sóc lại khách hàng."
        actions={
          <Button onClick={() => openWizard()}>
            <Plus className="size-4" />
            Tạo Chiến Dịch
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              statusFilter === tab.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filteredCampaigns.length ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="overflow-hidden">
              <div className={cn("border-b border-border bg-gradient-to-br p-5", getCampaignBannerTone(campaign.channel))}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <ImageIcon className="size-4 text-primary" />
                      Banner Preview
                    </div>
                    <div className="font-display text-xl font-semibold">{campaign.name}</div>
                    <div className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {campaign.description || campaign.subject || "Chưa có mô tả chiến dịch"}
                    </div>
                  </div>
                  <StatusBadge
                    label={campaign.status}
                    className="bg-card/80 text-foreground ring-border"
                    dotClassName="bg-primary"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-card/80 px-3 py-1 text-muted-foreground">
                    {campaign.channel === "both" ? "Email + SMS" : campaign.channel.toUpperCase()}
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1 text-muted-foreground">
                    {campaign.recipient_count} khách hàng
                  </span>
                  <span className="rounded-full bg-card/80 px-3 py-1 text-muted-foreground">
                    {campaign.customer_types?.length
                      ? campaign.customer_types.join(", ")
                      : "Tất cả phân khúc"}
                  </span>
                </div>
              </div>

              <CardContent className="space-y-4 p-5">
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div>Target: {campaign.recipient_count} khách hàng</div>
                  <div>
                    {campaign.sent_at
                      ? `Đã gửi ${timeAgo(campaign.sent_at)}`
                      : campaign.scheduled_at
                        ? `Lên lịch ${formatDate(campaign.scheduled_at)}`
                        : `Tạo ${timeAgo(campaign.created_at)}`}
                  </div>
                </div>

                {(campaign.status === "sent" || campaign.status === "sending" || campaign.sent_count > 0) ? (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 text-sm md:grid-cols-4">
                    <StatPill icon={Send} label={String(campaign.sent_count)} />
                    <StatPill icon={Eye} label={String(campaign.opened_count)} />
                    <StatPill icon={Percent} label={`${campaign.open_rate ?? 0}%`} />
                    <StatPill icon={AlertTriangle} label={String(campaign.failed_count ?? 0)} />
                  </div>
                ) : null}

                <div className="rounded-2xl border border-border p-4 text-sm">
                  <div className="font-medium">Nội dung xem trước</div>
                  <div className="mt-2 line-clamp-4 text-muted-foreground">
                    {(campaign.content || "").replaceAll("{ten_khach_hang}", "Nguyễn Minh Anh")}
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setDetailCampaign(campaign)}>
                    <Eye className="size-4" />
                  </Button>
                  {campaign.status === "draft" || campaign.status === "scheduled" ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => sendCampaign.mutate(campaign.id)}
                      disabled={sendCampaign.isPending}
                    >
                      <Send className="size-4" />
                      Gửi ngay
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" onClick={() => openWizard(campaign)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => duplicateCampaign.mutate(campaign.id)}>
                    <Copy className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(campaign)}>
                    <Trash2 className="size-4 text-rose-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="Không có chiến dịch phù hợp"
          description="Thử đổi tab trạng thái hoặc tạo chiến dịch mới."
        />
      )}

      <Modal
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        title={editingCampaign ? "Chỉnh sửa chiến dịch" : "Tạo Chiến Dịch"}
        description={`Bước ${step}/4 trong wizard cấu hình chiến dịch`}
        className="max-w-5xl"
      >
        <div className="space-y-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((value) => (
              <div
                key={value}
                className={`h-2 flex-1 rounded-full ${value <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              {step === 1 ? (
                <>
                  <Field label="Tên chiến dịch">
                    <Input value={wizard.name} onChange={(event) => setWizard({ ...wizard, name: event.target.value })} />
                  </Field>
                  <Field label="Mô tả">
                    <Textarea value={wizard.description} onChange={(event) => setWizard({ ...wizard, description: event.target.value })} />
                  </Field>
                  <Field label="Kênh">
                    <div className="grid gap-3 md:grid-cols-3">
                      {[
                        { label: "Email", value: "email" },
                        { label: "SMS", value: "sms" },
                        { label: "Cả Hai", value: "both" },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setWizard({ ...wizard, channel: option.value as Campaign["channel"] })}
                          className={`rounded-2xl border px-4 py-4 text-left transition ${
                            wizard.channel === option.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-muted/40"
                          }`}
                        >
                          <div className="font-medium">{option.label}</div>
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <div className="text-sm font-medium">Đối tượng</div>
                  <div className="grid gap-3">
                    {[
                      { label: "VIP", value: "vip" as const },
                      { label: "Thân thiết", value: "loyal" as const },
                      { label: "Tiềm năng", value: "potential" as const },
                      { label: "Mới", value: "new" as const },
                    ].map((option) => (
                      <label key={option.value} className="flex items-center justify-between rounded-2xl border border-border p-4">
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
                          <span>{option.label}</span>
                        </div>
                        <span className="text-sm text-muted-foreground">{typeCounts[option.value]}</span>
                      </label>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                    Dự kiến: {estimatedRecipients} khách hàng
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  {wizard.channel !== "sms" ? (
                    <Field label="Subject">
                      <Input value={wizard.subject} onChange={(event) => setWizard({ ...wizard, subject: event.target.value })} />
                    </Field>
                  ) : null}
                  <Field label="Nội dung">
                    <Textarea value={wizard.content} onChange={(event) => setWizard({ ...wizard, content: event.target.value })} rows={8} />
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    {variableTokens.map((token) => (
                      <Button key={token} type="button" variant="secondary" size="sm" onClick={() => appendVariable(token)}>
                        {token}
                      </Button>
                    ))}
                  </div>
                  {wizard.channel === "sms" ? (
                    <div className="text-xs text-muted-foreground">{wizard.content.length}/160 ký tự</div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Hỗ trợ biến {variableTokens.join(", ")}</div>
                  )}
                  <Button variant="secondary" onClick={() => toast.success("Đã gửi thử nội dung chiến dịch")}>
                    Gửi Thử
                  </Button>
                </>
              ) : null}

              {step === 4 ? (
                <>
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                    <div className="font-medium">{wizard.name || "Chưa đặt tên"}</div>
                    <div className="mt-2 text-muted-foreground">{wizard.description || "Không có mô tả"}</div>
                    <div className="mt-2">Kênh: {wizard.channel}</div>
                    <div className="mt-1">Đối tượng: {wizard.customer_types.join(", ") || "Chưa chọn"}</div>
                    <div className="mt-1">Dự kiến: {estimatedRecipients} khách hàng</div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant={wizard.scheduleMode === "now" ? "default" : "secondary"}
                      onClick={() => setWizard({ ...wizard, scheduleMode: "now" })}
                    >
                      Gửi Ngay
                    </Button>
                    <Button
                      variant={wizard.scheduleMode === "later" ? "default" : "secondary"}
                      onClick={() => setWizard({ ...wizard, scheduleMode: "later" })}
                    >
                      Đặt Lịch
                    </Button>
                  </div>
                  {wizard.scheduleMode === "later" ? (
                    <Input
                      type="datetime-local"
                      value={wizard.scheduledAt}
                      onChange={(event) => setWizard({ ...wizard, scheduledAt: event.target.value })}
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className={cn("border-b border-border bg-gradient-to-br p-5", getCampaignBannerTone(wizard.channel))}>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    <ImageIcon className="size-4 text-primary" />
                    Banner Preview
                  </div>
                  <div className="mt-3 font-display text-2xl font-semibold">
                    {wizard.name || "Tên chiến dịch sẽ hiển thị ở đây"}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {wizard.description || wizard.subject || "Mô tả chiến dịch sẽ hiển thị ở đây"}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-card/80 px-3 py-1 text-muted-foreground">
                      {wizard.channel === "both" ? "Email + SMS" : wizard.channel.toUpperCase()}
                    </span>
                    <span className="rounded-full bg-card/80 px-3 py-1 text-muted-foreground">
                      {estimatedRecipients} khách hàng
                    </span>
                  </div>
                </div>
                <CardContent className="space-y-4 p-5">
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                    {previewContent || "Nội dung xem trước sẽ xuất hiện ở đây."}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {variableTokens.map((token) => (
                      <span key={token} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {token}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="secondary" onClick={() => (step > 1 ? setStep(step - 1) : setWizardOpen(false))}>
              {step > 1 ? "Quay lại" : "Hủy"}
            </Button>
            {step < 4 ? (
              <Button type="button" onClick={() => setStep(step + 1)} disabled={!wizard.name && step === 1}>
                Tiếp tục
              </Button>
            ) : (
              <Button onClick={() => upsertCampaign.mutate()} disabled={upsertCampaign.isPending}>
                {upsertCampaign.isPending ? "Đang lưu..." : "Khởi Động Chiến Dịch"}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(detailCampaign)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setDetailCampaign(null);
        }}
        title={detailCampaign?.name ?? "Chi tiết chiến dịch"}
        description="Hiệu suất, banner và nhật ký gửi gần đây của chiến dịch."
        className="max-w-4xl"
      >
        {detailCampaign ? (
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className={cn("border-b border-border bg-gradient-to-br p-5", getCampaignBannerTone(detailCampaign.channel))}>
                <div className="font-display text-2xl font-semibold">{detailCampaign.name}</div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {detailCampaign.description || detailCampaign.subject || "Chưa có mô tả chiến dịch"}
                </div>
              </div>
              <CardContent className="grid gap-4 p-5 md:grid-cols-4">
                <StatPill icon={Send} label={String(detailCampaign.sent_count)} />
                <StatPill icon={Eye} label={String(detailCampaign.opened_count)} />
                <StatPill icon={Percent} label={`${detailCampaign.open_rate ?? 0}%`} />
                <StatPill icon={AlertTriangle} label={String(detailCampaign.failed_count ?? 0)} />
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Nội dung chiến dịch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <div className="font-medium">Subject</div>
                    <div className="text-muted-foreground">{detailCampaign.subject || "--"}</div>
                  </div>
                  <div>
                    <div className="font-medium">Content</div>
                    <div className="whitespace-pre-wrap text-muted-foreground">{detailCampaign.content}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Nhật ký gửi gần đây</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {detailMessages.slice(0, 6).map((message) => (
                    <div key={message.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border p-3 text-sm">
                      <div>
                        <div className="font-medium">{message.recipient}</div>
                        <div className="text-muted-foreground">
                          {message.channel.toUpperCase()} · {message.provider}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{message.status}</div>
                        <div className="text-xs text-muted-foreground">{timeAgo(message.created_at)}</div>
                      </div>
                    </div>
                  ))}
                  {!detailMessages.length ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      Chưa có log gửi cho chiến dịch này.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`Xóa chiến dịch ${deleteTarget?.name ?? ""}?`}
        description="Chiến dịch sẽ bị xóa khỏi dữ liệu demo."
        confirmLabel="Xóa chiến dịch"
        onConfirm={() => {
          if (deleteTarget) {
            deleteCampaign.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}

function StatPill({ icon: Icon, label }: { icon: typeof Send; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
      <Icon className="size-4 text-primary" />
      <span>{label}</span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}
