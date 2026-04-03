import { useQueryClient } from "@tanstack/react-query";
import { Copy, Upload } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/shared/brand-logo";
import { PageHeader } from "@/components/shared/page-header";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppMutation } from "@/hooks/useAppMutation";
import { useSettingsQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { getDefaultLogoUrl, isValidAssetUrl } from "@/lib/utils";
import { seedService } from "@/services/seedService";
import { getAppErrorMessage } from "@/services/shared";
import { settingsService } from "@/services/settingsService";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error, refetch, isFetching } = useSettingsQuery();
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [emailProvider, setEmailProvider] = useState(settings?.integrations.email_provider);
  const [smsProvider, setSmsProvider] = useState(settings?.integrations.sms_provider);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name);
      setLogoUrl(settings.logo_url ?? "");
      setEmailProvider(settings.integrations.email_provider);
      setSmsProvider(settings.integrations.sms_provider);
    }
  }, [settings]);

  const normalizedLogoUrl = logoUrl.trim();
  const logoUrlValid = !normalizedLogoUrl || isValidAssetUrl(normalizedLogoUrl);
  const previewLogoUrl = normalizedLogoUrl || settings?.logo_url || getDefaultLogoUrl();

  const saveSettings = useAppMutation({
    errorMessage: "Không thể lưu cài đặt hệ thống.",
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
          email_provider: emailProvider ?? settings.integrations.email_provider,
          sms_provider: smsProvider ?? settings.integrations.sms_provider,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      toast.success("Đã lưu thay đổi");
    },
  });

  const toggleNotification = useAppMutation({
    errorMessage: "Không thể cập nhật cài đặt thông báo.",
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      settingsService.toggleNotification(key, enabled),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.settings });
      toast.success("Đã cập nhật cài đặt thông báo");
    },
  });

  const seedDemoData = useAppMutation({
    errorMessage: "Không thể tạo dữ liệu demo.",
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
      toast.success(`Đã tạo ${count} bản ghi mẫu`);
    },
  });

  if (isLoading) {
    return <PageLoader panels={1} />;
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cài Đặt" subtitle="Cấu hình tổ chức, thông báo và tích hợp hệ thống." />
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
    <div className="space-y-6">
      <PageHeader title="Cài Đặt" subtitle="Cấu hình tổ chức, thông báo và tích hợp hệ thống." />

      <Tabs defaultValue="organization">
        <TabsList>
          <TabsTrigger value="organization">Tổ Chức</TabsTrigger>
          <TabsTrigger value="notifications">Thông Báo</TabsTrigger>
          <TabsTrigger value="integrations">Tích Hợp</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <Card>
            <CardContent className="space-y-5 p-6">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Tên công ty</span>
                <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Logo URL</span>
                <Input
                  value={logoUrl}
                  onChange={(event) => setLogoUrl(event.target.value)}
                  placeholder={getDefaultLogoUrl()}
                />
                <span className="text-xs text-muted-foreground">
                  Có thể dùng URL Supabase Storage hoặc asset local như `/branding/demo-company-logo.svg`
                </span>
                {!logoUrlValid ? (
                  <span className="text-xs text-rose-500">
                    Logo URL phải là đường dẫn local bắt đầu bằng `/` hoặc URL `http(s)`.
                  </span>
                ) : null}
              </label>
              <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                {previewLogoUrl ? (
                  <BrandLogo
                    src={previewLogoUrl}
                    alt={companyName || settings.company_name}
                    fallbackLabel={companyName || settings.company_name}
                    className="mx-auto mb-4 h-20 w-20 border border-border bg-background p-3"
                    imageClassName="object-contain"
                  />
                ) : <Upload className="mx-auto mb-3 size-8 text-muted-foreground" />}
                <div className="font-medium">Preview logo công ty</div>
                <div className="text-sm text-muted-foreground">
                  Ưu tiên file SVG hoặc PNG nền trong suốt
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-4">
                <div>
                  <div className="font-medium">Gói hiện tại</div>
                  <div className="text-sm text-muted-foreground">
                    Nâng cấp để mở khóa thêm tính năng
                  </div>
                </div>
                <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
                  Free
                </span>
              </div>
              <div className="flex justify-end">
                <div className="flex gap-3">
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardContent className="space-y-4 p-6">
              {settings.notification_settings.map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-border p-4">
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-sm text-muted-foreground">{item.description}</div>
                  </div>
                  <Switch
                    checked={item.enabled}
                    onChange={(event) =>
                      toggleNotification.mutate({ key: item.key, enabled: event.target.checked })
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>
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
                    <Button variant="ghost" size="icon" aria-label="Sao chép webhook URL" onClick={() => toast.success("Đã copy webhook URL")}>
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
                  <label className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
                    <span>Bật gửi Email</span>
                    <Switch
                      checked={emailProvider?.enabled ?? false}
                      onChange={(event) =>
                        setEmailProvider((current) => ({
                          ...(current ?? settings.integrations.email_provider),
                          enabled: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">Provider</span>
                    <select
                      value={emailProvider?.provider ?? ""}
                      onChange={(event) =>
                        setEmailProvider((current) => ({
                          ...(current ?? settings.integrations.email_provider),
                          provider: (event.target.value || null) as typeof settings.integrations.email_provider.provider,
                        }))
                      }
                      className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value="">Chưa chọn</option>
                      <option value="resend">Resend</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">From name</span>
                    <Input
                      value={emailProvider?.from_name ?? ""}
                      onChange={(event) =>
                        setEmailProvider((current) => ({
                          ...(current ?? settings.integrations.email_provider),
                          from_name: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">From email</span>
                    <Input
                      value={emailProvider?.from_email ?? ""}
                      onChange={(event) =>
                        setEmailProvider((current) => ({
                          ...(current ?? settings.integrations.email_provider),
                          from_email: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">Reply-to</span>
                    <Input
                      value={emailProvider?.reply_to ?? ""}
                      onChange={(event) =>
                        setEmailProvider((current) => ({
                          ...(current ?? settings.integrations.email_provider),
                          reply_to: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">VITE_SUPABASE_URL</span>
                    <Input readOnly value={supabaseUrl} />
                  </label>
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
                  <label className="flex items-center justify-between rounded-2xl border border-border p-3 text-sm">
                    <span>Bật gửi SMS</span>
                    <Switch
                      checked={smsProvider?.enabled ?? false}
                      onChange={(event) =>
                        setSmsProvider((current) => ({
                          ...(current ?? settings.integrations.sms_provider),
                          enabled: event.target.checked,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">Provider</span>
                    <select
                      value={smsProvider?.provider ?? ""}
                      onChange={(event) =>
                        setSmsProvider((current) => ({
                          ...(current ?? settings.integrations.sms_provider),
                          provider: (event.target.value || null) as typeof settings.integrations.sms_provider.provider,
                        }))
                      }
                      className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                    >
                      <option value="">Chưa chọn</option>
                      <option value="twilio">Twilio</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">Sender ID</span>
                    <Input
                      value={smsProvider?.sender_id ?? ""}
                      onChange={(event) =>
                        setSmsProvider((current) => ({
                          ...(current ?? settings.integrations.sms_provider),
                          sender_id: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">From number</span>
                    <Input
                      value={smsProvider?.from_number ?? ""}
                      onChange={(event) =>
                        setSmsProvider((current) => ({
                          ...(current ?? settings.integrations.sms_provider),
                          from_number: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    <span className="font-medium">VITE_SUPABASE_ANON_KEY</span>
                    <Input readOnly value={supabaseAnonKey} />
                  </label>
                  <div className="text-xs text-muted-foreground">
                    Cấu hình secret thực tế trong Supabase Edge Functions: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`.
                  </div>
                </div>
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
