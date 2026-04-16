import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { AppSettings, PosSyncStatus } from "@/types";

import {
  type ServiceRequestOptions,
  cloneDefaultSettings,
  createAuditLog,
  ensureSupabaseConfigured,
  getCachedSettings,
  runBestEffort,
  setCachedSettings,
  withLatency,
} from "@/services/shared";

type OrganizationRow = {
  id: string;
  name: string | null;
  plan: string | null;
};

type AppSettingsDbRow = {
  org_id: string;
  email_provider: string | null;
  email_from_name: string | null;
  email_from_address: string | null;
  sms_provider: string | null;
  pos_api_endpoint: string | null;
  pos_last_sync_at: string | null;
  pos_sync_enabled: boolean | null;
};

function isMissingTableError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

function requireOrgContext() {
  const state = useAuthStore.getState();
  const orgId = state.orgId;
  const userId = state.profile?.id ?? state.user?.id ?? null;

  if (!orgId) {
    throw new Error("Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại.");
  }

  return { orgId, userId };
}

function normalizeEmailProvider(value: string | null | undefined): AppSettings["integrations"]["email_provider"]["provider"] {
  return value === "resend" ? "resend" : null;
}

function normalizeSmsProvider(value: string | null | undefined): AppSettings["integrations"]["sms_provider"]["provider"] {
  return value === "twilio" ? "twilio" : null;
}

function derivePosStatus(
  row: AppSettingsDbRow | null,
  fallback: PosSyncStatus,
): PosSyncStatus {
  if (!row) {
    return fallback;
  }
  if (row.pos_sync_enabled) {
    return "active";
  }
  if (row.pos_last_sync_at) {
    return "success";
  }
  return "error";
}

function toAppSettings(
  organization: OrganizationRow | null,
  settings: AppSettingsDbRow | null,
  cached: AppSettings,
): AppSettings {
  const defaults = cloneDefaultSettings();
  const base = cached ?? defaults;
  const emailProvider = normalizeEmailProvider(settings?.email_provider);
  const smsProvider = normalizeSmsProvider(settings?.sms_provider);

  return {
    company_name: organization?.name?.trim() || base.company_name || defaults.company_name,
    logo_url: base.logo_url ?? defaults.logo_url,
    plan: "Free",
    notification_settings: base.notification_settings ?? defaults.notification_settings,
    integrations: {
      ...defaults.integrations,
      ...base.integrations,
      pos_webhook_url:
        settings?.pos_api_endpoint?.trim() ||
        base.integrations.pos_webhook_url ||
        defaults.integrations.pos_webhook_url,
      last_sync:
        settings?.pos_last_sync_at?.trim() ||
        base.integrations.last_sync ||
        defaults.integrations.last_sync,
      pos_status: derivePosStatus(settings, base.integrations.pos_status ?? "active"),
      email_provider: {
        ...defaults.integrations.email_provider,
        ...base.integrations.email_provider,
        provider: emailProvider,
        enabled: Boolean(emailProvider),
        from_name:
          settings?.email_from_name?.trim() ||
          base.integrations.email_provider.from_name ||
          defaults.integrations.email_provider.from_name,
        from_email:
          settings?.email_from_address?.trim() ||
          base.integrations.email_provider.from_email ||
          defaults.integrations.email_provider.from_email,
      },
      sms_provider: {
        ...defaults.integrations.sms_provider,
        ...base.integrations.sms_provider,
        provider: smsProvider,
        enabled: Boolean(smsProvider),
      },
    },
  };
}

async function readRemoteSettings(options: ServiceRequestOptions = {}) {
  ensureSupabaseConfigured();
  const { orgId } = requireOrgContext();

  const orgQuery = supabase
    .from("organizations")
    .select("id, name, plan")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const settingsQuery = supabase
    .from("app_settings")
    .select(
      "org_id, email_provider, email_from_name, email_from_address, sms_provider, pos_api_endpoint, pos_last_sync_at, pos_sync_enabled",
    )
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  void options;
  const [orgResult, settingsResult] = await Promise.all([orgQuery, settingsQuery]);

  if (orgResult.error && !isMissingTableError(orgResult.error)) {
    throw orgResult.error;
  }
  if (settingsResult.error && !isMissingTableError(settingsResult.error)) {
    throw settingsResult.error;
  }

  return {
    organization: (orgResult.data ?? null) as OrganizationRow | null,
    settings: (settingsResult.data ?? null) as AppSettingsDbRow | null,
  };
}

async function persistSettings(next: AppSettings) {
  const { orgId, userId } = requireOrgContext();
  const now = new Date().toISOString();

  const orgName = next.company_name.trim();
  if (orgName) {
    const { error: orgError } = await supabase
      .from("organizations")
      .update({
        name: orgName,
        updated_at: now,
      })
      .eq("id", orgId)
      .is("deleted_at", null);

    if (orgError && !isMissingTableError(orgError)) {
      throw orgError;
    }
  }

  const mappedEmailProvider =
    next.integrations.email_provider.enabled && next.integrations.email_provider.provider
      ? next.integrations.email_provider.provider
      : null;
  const mappedSmsProvider =
    next.integrations.sms_provider.enabled && next.integrations.sms_provider.provider
      ? next.integrations.sms_provider.provider
      : null;

  const upsertPayload = {
    org_id: orgId,
    email_provider: mappedEmailProvider,
    email_from_name: next.integrations.email_provider.from_name || null,
    email_from_address: next.integrations.email_provider.from_email || null,
    sms_provider: mappedSmsProvider,
    pos_api_endpoint: next.integrations.pos_webhook_url || null,
    pos_last_sync_at: next.integrations.last_sync || null,
    pos_sync_enabled:
      next.integrations.pos_status === "active" || next.integrations.pos_status === "processing",
    updated_by: userId,
    updated_at: now,
  };

  const { error: settingsError } = await supabase
    .from("app_settings")
    .upsert(upsertPayload, { onConflict: "org_id" });

  if (settingsError && !isMissingTableError(settingsError)) {
    throw settingsError;
  }
}

async function resolveSettings(options: ServiceRequestOptions = {}) {
  const cached = getCachedSettings();
  try {
    const remote = await readRemoteSettings(options);
    const normalized = toAppSettings(remote.organization, remote.settings, cached);
    setCachedSettings(normalized);
    return normalized;
  } catch (error) {
    if (!isMissingTableError(error)) {
      throw error;
    }
    return cached;
  }
}

export const settingsService = {
  get(options: ServiceRequestOptions = {}) {
    return withLatency(resolveSettings(options), 200);
  },

  update(payload: Partial<AppSettings>) {
    return withLatency(
      (async () => {
        const current = await resolveSettings();
        const merged: AppSettings = {
          ...current,
          ...payload,
          integrations: {
            ...current.integrations,
            ...payload.integrations,
            email_provider: {
              ...current.integrations.email_provider,
              ...(payload.integrations?.email_provider ?? {}),
            },
            sms_provider: {
              ...current.integrations.sms_provider,
              ...(payload.integrations?.sms_provider ?? {}),
            },
          },
          notification_settings: payload.notification_settings ?? current.notification_settings,
        };

        await persistSettings(merged);
        setCachedSettings(merged);

        void runBestEffort("settings.update.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "app_settings",
            newData: {
              message: "Cập nhật cài đặt hệ thống",
              company_name: merged.company_name,
            },
          }),
        );

        return merged;
      })(),
      200,
    );
  },

  toggleNotification(key: string, enabled: boolean) {
    return withLatency(
      (async () => {
        const current = await resolveSettings();
        const next: AppSettings = {
          ...current,
          notification_settings: current.notification_settings.map((item) =>
            item.key === key ? { ...item, enabled } : item,
          ),
        };

        setCachedSettings(next);

        void runBestEffort("settings.toggleNotification.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "app_settings",
            newData: {
              message: "Cập nhật cài đặt thông báo",
              notification_key: key,
              enabled,
            },
          }),
        );

        return next;
      })(),
      150,
    );
  },
};
