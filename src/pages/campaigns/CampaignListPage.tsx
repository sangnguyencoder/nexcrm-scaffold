import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Eye, Megaphone, Pencil, Percent, Plus, Send, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useCampaignsQuery } from "@/hooks/useNexcrmQueries";
import { formatDate, timeAgo } from "@/lib/utils";
import { campaignService } from "@/services/campaignService";
import { communicationService } from "@/services/communicationService";
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

export function CampaignListPage() {
  const queryClient = useQueryClient();
  const { data: campaigns = [], isLoading } = useCampaignsQuery();
  const [statusFilter, setStatusFilter] = useState<Campaign["status"] | "all">("all");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(initialWizardState);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null);

  const filteredCampaigns = useMemo(
    () => campaigns.filter((campaign) => (statusFilter === "all" ? true : campaign.status === statusFilter)),
    [campaigns, statusFilter],
  );
  const estimatedRecipients = wizard.customer_types.reduce(
    (sum, type) => sum + (typeCounts[type] ?? 0),
    0,
  );

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
  });

  const duplicateCampaign = useMutation({
    mutationFn: campaignService.duplicate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Đã nhân bản chiến dịch");
    },
  });

  const deleteCampaign = useMutation({
    mutationFn: campaignService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Đã xóa chiến dịch");
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
            <Card key={campaign.id}>
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{campaign.name}</CardTitle>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {campaign.channel === "both"
                        ? "Cả hai"
                        : campaign.channel === "email"
                          ? "Email"
                          : "SMS"}
                    </div>
                  </div>
                  <StatusBadge
                    label={campaign.status}
                    className="bg-muted text-muted-foreground ring-border"
                    dotClassName="bg-primary"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Target: {campaign.recipient_count} khách hàng
                </div>
                <div className="text-sm text-muted-foreground">
                  {campaign.sent_at
                    ? `Đã gửi ${timeAgo(campaign.sent_at)}`
                    : campaign.scheduled_at
                      ? `Lên lịch ${formatDate(campaign.scheduled_at)}`
                      : `Tạo ${timeAgo(campaign.created_at)}`}
                </div>
                {campaign.status === "sent" || campaign.status === "sending" ? (
                  <div className="grid grid-cols-2 gap-2 rounded-2xl bg-muted/40 p-3 text-sm md:grid-cols-4">
                    <StatPill icon={Send} label={String(campaign.sent_count)} />
                    <StatPill icon={Eye} label={String(campaign.opened_count)} />
                    <StatPill
                      icon={Percent}
                      label={`${campaign.open_rate ?? 0}%`}
                    />
                    <StatPill icon={AlertTriangle} label={String(campaign.failed_count ?? 0)} />
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-end gap-2">
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
        className="max-w-4xl"
      >
        <div className="space-y-6">
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((value) => (
              <div
                key={value}
                className={`h-2 flex-1 rounded-full ${
                  value <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {step === 1 ? (
            <div className="space-y-4">
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
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="text-sm font-medium">Đối tượng</div>
              <div className="grid gap-3">
                {[
                  { label: "VIP", value: "vip" as const },
                  { label: "Thân thiết", value: "loyal" as const },
                  { label: "Tiềm năng", value: "potential" as const },
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
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              {wizard.channel !== "sms" ? (
                <Field label="Subject">
                  <Input value={wizard.subject} onChange={(event) => setWizard({ ...wizard, subject: event.target.value })} />
                </Field>
              ) : null}
              <Field label="Nội dung">
                <Textarea value={wizard.content} onChange={(event) => setWizard({ ...wizard, content: event.target.value })} />
              </Field>
              {wizard.channel === "sms" ? (
                <div className="text-xs text-muted-foreground">
                  {wizard.content.length}/160 ký tự
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  Hỗ trợ biến {"{ten_khach_hang}"}
                </div>
              )}
              <Button variant="secondary" onClick={() => toast.success("Đã gửi thử nội dung chiến dịch")}>
                Gửi Thử
              </Button>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <div className="font-medium">{wizard.name || "Chưa đặt tên"}</div>
                <div className="mt-2 text-muted-foreground">{wizard.description || "Không có mô tả"}</div>
                <div className="mt-2">Kênh: {wizard.channel}</div>
                <div className="mt-1">Đối tượng: {wizard.customer_types.join(", ")}</div>
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
            </div>
          ) : null}

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
