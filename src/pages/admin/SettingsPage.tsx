import { useQueryClient } from "@tanstack/react-query";
import { Copy, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { BrandLogo } from "@/components/shared/brand-logo";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { PageHeader } from "@/components/shared/page-header";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionPanel } from "@/components/shared/section-panel";
import { SettingsRow } from "@/components/shared/settings-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppMutation } from "@/hooks/useAppMutation";
import { useSettingsQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { copyTextToClipboard, getDefaultLogoUrl, isValidAssetUrl } from "@/lib/utils";
import { seedService } from "@/services/seedService";
import { getAppErrorMessage } from "@/services/shared";
import { settingsService } from "@/services/settingsService";
import type { AppSettings } from "@/types";

type SettingsDraft = {
  companyName?: string;
  logoUrl?: string;
  emailProvider?: AppSettings["integrations"]["email_provider"];
  smsProvider?: AppSettings["integrations"]["sms_provider"];
};

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error, refetch, isFetching } = useSettingsQuery();
  const [draft, setDraft] = useState<SettingsDraft>({});
  const fallbackEmailProvider: AppSettings["integrations"]["email_provider"] = {
    provider: null,
    enabled: false,
    from_name: "",
    from_email: "",
    reply_to: "",
  };
  const fallbackSmsProvider: AppSettings["integrations"]["sms_provider"] = {
    provider: null,
    enabled: false,
    sender_id: "",
    from_number: "",
  };

  const companyName = draft.companyName ?? settings?.company_name ?? "";
  const logoUrl = draft.logoUrl ?? settings?.logo_url ?? "";
  const emailProvider = draft.emailProvider ?? settings?.integrations.email_provider ?? fallbackEmailProvider;
  const smsProvider = draft.smsProvider ?? settings?.integrations.sms_provider ?? fallbackSmsProvider;

  const normalizedLogoUrl = logoUrl.trim();
  const logoUrlValid = !normalizedLogoUrl || isValidAssetUrl(normalizedLogoUrl);
  const previewLogoUrl = normalizedLogoUrl || settings?.logo_url || getDefaultLogoUrl();

  const saveSettings = useAppMutation({
    action: "settings.save",
    errorMessage: "Không thể lưu cài đặt hệ thống.",
    successMessage: "Đã lưu thay đổi",
    mutationFn: () => {
      if (!settings) {
        throw new Error("Không tải được cấu hình hiện tại để lưu thay đổi.");
      }

      if (!companyName.trim()) {
        throw new Error("Vui lòng nhập tên công ty trước khi lưu.");
      }

      if (normalizedLogoUrl && !isValidAssetUrl(normalizedLogoUrl)) {
        throw new Error("Logo URL không hợp lệ. Dùng URL http(s) hoặc đường dẫn local bắt đầu bằng '/'.");
      }

      return settingsService.update({
        company_name: companyName.trim(),
        logo_url: normalizedLogoUrl || null,
        integrations: {
          ...settings.integrations,
          email_provider: emailProvider,
          sms_provider: smsProvider,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      setDraft({});
    },
  });

  const toggleNotification = useAppMutation({
    action: "settings.toggle-notification",
    errorMessage: "Không thể cập nhật cài đặt thông báo.",
    successMessage: "Đã cập nhật cài đặt thông báo",
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      settingsService.toggleNotification(key, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
    },
  });

  const seedDemoData = useAppMutation({
    action: "settings.seed-demo",
    errorMessage: "Không thể tạo dữ liệu demo.",
    successMessage: (count) => `Đã tạo ${count} bản ghi mẫu`,
    mutationFn: async () => {
      toast.info("Đang tạo dữ liệu demo...");
      return seedService.createDemoData();
    },
    onSuccess: async (count) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["transactions"] }),
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
        queryClient.invalidateQueries({ queryKey: ["deals"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });

  if (isLoading) {
    return <PageLoader panels={1} />;
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cài Đặt" /* subtitle="Cấu hình tổ chức, thông báo và tích hợp hệ thống." */ />
        <PageErrorState
          title="Không tải được cấu hình hệ thống"
          description={getAppErrorMessage(
            error,
            "Kiểm tra migration `app_settings`, kết nối Supabase, hoặc thử tải lại sau ít phút.",
          )}
          retryLabel={isFetching ? "Đang tải lại..." : "Tải lại"}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cài Đặt"
        // subtitle="Nhóm cấu hình theo nhiệm vụ vận hành để giảm cuộn và tăng khả năng scan."
        actions={<Badge className="bg-muted text-muted-foreground ring-border">{settings.plan}</Badge>}
      />

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Tổ Chức</TabsTrigger>
          <TabsTrigger value="notifications">Thông Báo</TabsTrigger>
          <TabsTrigger value="integrations">Tích Hợp</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_320px]">
            <FormSection title="Thông tin tổ chức" /* description="Các trường thương hiệu và nhận diện nên nằm gần nhau để cập nhật nhanh." */>
              {saveSettings.actionError ? (
                <ActionErrorAlert
                  error={saveSettings.actionError}
                  onDismiss={saveSettings.clearActionError}
                  onRetry={saveSettings.canRetry ? () => void saveSettings.retryLast() : undefined}
                />
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Tên công ty">
                  <Input
                    value={companyName}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, companyName: event.target.value }))
                    }
                  />
                </FormField>
                <FormField
                  label="Logo URL"
                  error={logoUrlValid ? undefined : "Logo URL phải là đường dẫn local bắt đầu bằng `/` hoặc URL `http(s)`."}
                  description="Có thể dùng URL Supabase Storage hoặc asset local như `/branding/demo-company-logo.svg`."
                >
                  <Input
                    value={logoUrl}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, logoUrl: event.target.value }))
                    }
                    placeholder={getDefaultLogoUrl()}
                  />
                </FormField>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => seedDemoData.mutate()}
                  disabled={seedDemoData.isPending}
                >
                  {seedDemoData.isPending ? "Đang tạo..." : "Dữ Liệu Demo"}
                </Button>
                <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
                  Lưu Thay Đổi
                </Button>
              </div>
            </FormSection>

            <SectionPanel
              title="Brand preview"
              // description="Giữ phần xem trước cố định để kiểm tra logo và workspace name ngay."
              eyebrow="Organization"
              meta={<Badge className="bg-muted text-muted-foreground ring-border">{settings.plan}</Badge>}
              contentClassName="space-y-4"
            >
              <div className="surface-subtle border-dashed p-5 text-center">
                {previewLogoUrl ? (
                  <BrandLogo
                    src={previewLogoUrl}
                    alt={companyName || settings.company_name}
                    fallbackLabel={companyName || settings.company_name}
                    className="mx-auto mb-4 h-16 w-16 border border-border bg-background p-3"
                  />
                ) : (
                  <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />
                )}
                <div className="font-medium">{companyName || settings.company_name}</div>
                <div className="mt-1 text-sm text-muted-foreground">Ưu tiên SVG hoặc PNG nền trong suốt</div>
              </div>
              <div className="surface-subtle p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace plan</div>
                <div className="mt-2 text-sm font-medium">{settings.plan}</div>
                <div className="text-xs text-muted-foreground">Gói hiện tại cho hệ thống CRM.</div>
              </div>
            </SectionPanel>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <SectionPanel
            title="Thông báo hệ thống"
            // description="Giữ từng rule trên một dòng để đội vận hành quét nhanh hơn."
            eyebrow="Notifications"
            contentClassName="space-y-2"
          >
            {settings.notification_settings.map((item) => (
              <SettingsRow
                key={item.key}
                title={item.label}
                description={item.description}
              >
                <Switch
                  checked={item.enabled}
                  onChange={(event) =>
                    toggleNotification.mutate({ key: item.key, enabled: event.target.checked })
                  }
                />
              </SettingsRow>
            ))}
          </SectionPanel>
        </TabsContent>

        <TabsContent value="integrations">
          <div className="grid gap-4 xl:grid-cols-3">
            <IntegrationCard
              title="POS Sync"
              content={
                <>
                  <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm">
                    {settings.integrations.pos_webhook_url}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Last sync: 2024-01-21 09:30</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Sao chép webhook URL"
                      onClick={async () => {
                        const copied = await copyTextToClipboard(settings.integrations.pos_webhook_url);
                        toast.success(copied ? "Đã copy webhook URL" : "Không thể copy webhook URL");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </>
              }
            />
            <IntegrationCard
              title="Email Provider"
              content={
                <div className="space-y-3">
                  <SettingsRow
                    title="Bật gửi Email"
                    description="Cho phép hệ thống đẩy email tự động qua provider đang chọn."
                  >
                    <Switch
                      checked={emailProvider?.enabled ?? false}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          emailProvider: {
                            ...(current.emailProvider ?? settings.integrations.email_provider),
                            enabled: event.target.checked,
                          },
                        }))
                      }
                    />
                  </SettingsRow>
                  <FormField label="Provider">
                    <Select
                      value={emailProvider?.provider ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          emailProvider: {
                            ...(current.emailProvider ?? settings.integrations.email_provider),
                            provider: (event.target.value || null) as typeof settings.integrations.email_provider.provider,
                          },
                        }))
                      }
                    >
                      <option value="">Chưa chọn</option>
                      <option value="resend">Resend</option>
                    </Select>
                  </FormField>
                  <FormField label="From name">
                    <Input
                      value={emailProvider?.from_name ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          emailProvider: {
                            ...(current.emailProvider ?? settings.integrations.email_provider),
                            from_name: event.target.value,
                          },
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="From email">
                    <Input
                      value={emailProvider?.from_email ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          emailProvider: {
                            ...(current.emailProvider ?? settings.integrations.email_provider),
                            from_email: event.target.value,
                          },
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="Reply-to">
                    <Input
                      value={emailProvider?.reply_to ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          emailProvider: {
                            ...(current.emailProvider ?? settings.integrations.email_provider),
                            reply_to: event.target.value,
                          },
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="VITE_SUPABASE_URL">
                    <Input readOnly value={supabaseUrl} />
                  </FormField>
                  <div className="text-xs text-muted-foreground">
                    Cấu hình secret thực tế trong Supabase Edge Functions: `RESEND_API_KEY`.
                  </div>
                </div>
              }
            />
            <IntegrationCard
              title="SMS Provider"
              content={
                <div className="space-y-3">
                  <SettingsRow
                    title="Bật gửi SMS"
                    description="Bật gửi SMS từ automation và campaign qua nhà cung cấp đã cấu hình."
                  >
                    <Switch
                      checked={smsProvider?.enabled ?? false}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          smsProvider: {
                            ...(current.smsProvider ?? settings.integrations.sms_provider),
                            enabled: event.target.checked,
                          },
                        }))
                      }
                    />
                  </SettingsRow>
                  <FormField label="Provider">
                    <Select
                      value={smsProvider?.provider ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          smsProvider: {
                            ...(current.smsProvider ?? settings.integrations.sms_provider),
                            provider: (event.target.value || null) as typeof settings.integrations.sms_provider.provider,
                          },
                        }))
                      }
                    >
                      <option value="">Chưa chọn</option>
                      <option value="twilio">Twilio</option>
                    </Select>
                  </FormField>
                  <FormField label="Sender ID">
                    <Input
                      value={smsProvider?.sender_id ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          smsProvider: {
                            ...(current.smsProvider ?? settings.integrations.sms_provider),
                            sender_id: event.target.value,
                          },
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="From number">
                    <Input
                      value={smsProvider?.from_number ?? ""}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          smsProvider: {
                            ...(current.smsProvider ?? settings.integrations.sms_provider),
                            from_number: event.target.value,
                          },
                        }))
                      }
                    />
                  </FormField>
                  <FormField label="VITE_SUPABASE_ANON_KEY">
                    <Input readOnly value={supabaseAnonKey} />
                  </FormField>
                  <div className="text-xs text-muted-foreground">
                    Cấu hình secret thực tế trong Supabase Edge Functions: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
                  </div>
                </div>
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            {saveSettings.actionError ? (
              <div className="mr-auto max-w-md">
                <ActionErrorAlert
                  error={saveSettings.actionError}
                  onDismiss={saveSettings.clearActionError}
                  onRetry={saveSettings.canRetry ? () => void saveSettings.retryLast() : undefined}
                />
              </div>
            ) : null}
            <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
              Lưu Cấu Hình Tích Hợp
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function IntegrationCard({
  title,
  content,
}: {
  title: string;
  content: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="compact-panel-header">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
