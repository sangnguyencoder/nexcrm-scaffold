import { supabase } from "@/lib/supabase";
import type { AppSettings } from "@/types";

import {
  type AppSettingsRow,
  cloneDefaultSettings,
  createAuditLog,
  ensureSupabaseConfigured,
  getCachedSettings,
  getCurrentProfileId,
  setCachedSettings,
  toAppSettings,
  withLatency,
} from "@/services/shared";

const SETTINGS_ROW_ID = "default";

function isMissingTableError(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "42P01"
  );
}

async function upsertDefaultSettingsRow() {
  const defaults = cloneDefaultSettings();

  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      {
        id: SETTINGS_ROW_ID,
        company_name: defaults.company_name,
        logo_url: defaults.logo_url,
        plan: defaults.plan,
        notification_settings: defaults.notification_settings,
        integrations: defaults.integrations,
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as AppSettingsRow;
}

async function readSettings() {
  ensureSupabaseConfigured();

  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      console.warn(
        "Bảng app_settings chưa tồn tại. Hệ thống đang fallback về local settings cho tới khi chạy migration mới.",
      );
      return null;
    }
    throw error;
  }

  if (!data) {
    return upsertDefaultSettingsRow();
  }

  return data as AppSettingsRow;
}

async function persistSettings(next: AppSettings) {
  const currentUserId = await getCurrentProfileId();
  const { data, error } = await supabase
    .from("app_settings")
    .upsert(
      {
        id: SETTINGS_ROW_ID,
        company_name: next.company_name,
        logo_url: next.logo_url,
        plan: next.plan,
        notification_settings: next.notification_settings,
        integrations: next.integrations,
        created_by: currentUserId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as AppSettingsRow;
}

async function resolveSettings() {
  const row = await readSettings();
  const settings = row ? toAppSettings(row) : getCachedSettings();
  setCachedSettings(settings);
  return settings;
}

export const settingsService = {
  get() {
    return withLatency(resolveSettings(), 200);
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
          },
          notification_settings:
            payload.notification_settings ?? current.notification_settings,
        };

        try {
          const saved = toAppSettings(await persistSettings(merged));
          setCachedSettings(saved);
          await createAuditLog({
            action: "update",
            entityType: "app_settings",
            entityId: SETTINGS_ROW_ID,
            newData: {
              message: "Cập nhật cài đặt hệ thống",
              company_name: saved.company_name,
            },
          });
          return saved;
        } catch (error) {
          if (!isMissingTableError(error)) {
            throw error;
          }

          setCachedSettings(merged);
          return merged;
        }
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

        try {
          const saved = toAppSettings(await persistSettings(next));
          setCachedSettings(saved);
          await createAuditLog({
            action: "update",
            entityType: "app_settings",
            entityId: SETTINGS_ROW_ID,
            newData: {
              message: "Cập nhật cài đặt thông báo",
              notification_key: key,
              enabled,
            },
          });
          return saved;
        } catch (error) {
          if (!isMissingTableError(error)) {
            throw error;
          }

          setCachedSettings(next);
          return next;
        }
      })(),
      150,
    );
  },
};
