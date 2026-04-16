import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import type { AutomationRule } from "@/types";
import { communicationService } from "@/services/communicationService";

type AutomationCreateInput = {
  name: string;
  description?: string;
  trigger_type: "birthday" | "inactive_days" | "after_purchase" | "new_customer";
  trigger_days?: number | null;
  channel: "email" | "sms";
  summary?: string;
  content: string;
  schedule_enabled?: boolean;
  schedule_interval_minutes?: number | null;
  schedule_start_at?: string | null;
};

type AutomationUpdateInput = Partial<AutomationCreateInput>;

function requireOrgContext() {
  const state = useAuthStore.getState();
  const orgId = state.orgId;
  const userId = state.profile?.id ?? state.user?.id ?? null;
  if (!orgId) {
    throw new Error("Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại.");
  }
  return { orgId, userId };
}

function normalizeInterval(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 60;
  }
  return Math.max(5, Math.round(value));
}

function buildTriggerConfig(payload: {
  trigger_type: AutomationCreateInput["trigger_type"];
  trigger_days?: number | null;
  schedule_enabled?: boolean;
  schedule_interval_minutes?: number | null;
  schedule_start_at?: string | null;
}) {
  const nextRunAt = payload.schedule_enabled
    ? payload.schedule_start_at || new Date(Date.now() + normalizeInterval(payload.schedule_interval_minutes) * 60_000).toISOString()
    : null;

  return {
    ...(payload.trigger_type === "inactive_days" || payload.trigger_type === "after_purchase"
      ? { days: payload.trigger_days ?? 30 }
      : {}),
    schedule_enabled: payload.schedule_enabled === true,
    schedule_interval_minutes: normalizeInterval(payload.schedule_interval_minutes),
    schedule_next_run_at: nextRunAt,
    schedule_last_status: "idle",
    schedule_last_error: null,
    schedule_retry_count: 0,
  };
}

function mapRule(row: Record<string, unknown>): AutomationRule {
  const triggerConfig =
    row.trigger_config && typeof row.trigger_config === "object"
      ? (row.trigger_config as Record<string, unknown>)
      : {};

  const isEmail = row.action_type === "send_email";
  const triggerType =
    row.trigger_type === "birthday" ||
    row.trigger_type === "inactive_days" ||
    row.trigger_type === "after_purchase" ||
    row.trigger_type === "new_customer"
      ? row.trigger_type
      : "new_customer";

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : "",
    trigger: triggerType,
    trigger_type: triggerType,
    trigger_days:
      typeof triggerConfig.days === "number"
        ? triggerConfig.days
        : typeof triggerConfig.days === "string"
          ? Number(triggerConfig.days)
          : null,
    action: isEmail ? "send_email" : "send_sms",
    action_summary: row.template_subject ? String(row.template_subject) : "",
    action_type: isEmail ? "send_email" : "send_sms",
    channel: isEmail ? "email" : "sms",
    content: row.template_content ? String(row.template_content) : "",
    variables: ["{name}", "{customer_code}", "{date}"],
    is_active: Boolean(row.is_active),
    sent_count: 0,
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    last_run_at: row.last_run_at ? String(row.last_run_at) : null,
    schedule_enabled: triggerConfig.schedule_enabled === true,
    schedule_interval_minutes:
      typeof triggerConfig.schedule_interval_minutes === "number"
        ? triggerConfig.schedule_interval_minutes
        : null,
    schedule_next_run_at:
      typeof triggerConfig.schedule_next_run_at === "string"
        ? triggerConfig.schedule_next_run_at
        : row.next_run_at
          ? String(row.next_run_at)
          : null,
    schedule_last_status:
      triggerConfig.schedule_last_status === "failed" || triggerConfig.schedule_last_status === "success"
        ? triggerConfig.schedule_last_status
        : "idle",
    schedule_last_error:
      typeof triggerConfig.schedule_last_error === "string"
        ? triggerConfig.schedule_last_error
        : null,
    schedule_retry_count:
      typeof triggerConfig.schedule_retry_count === "number"
        ? triggerConfig.schedule_retry_count
        : 0,
  };
}

export const automationService = {
  async getAll() {
    const { orgId } = requireOrgContext();
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapRule);
  },

  async create(payload: AutomationCreateInput) {
    const { orgId, userId } = requireOrgContext();
    const triggerConfig = buildTriggerConfig(payload);
    const actionType = payload.channel === "sms" ? "send_sms" : "send_email";

    const { data, error } = await supabase
      .from("automation_rules")
      .insert({
        org_id: orgId,
        name: payload.name,
        description: payload.description || null,
        trigger_type: payload.trigger_type,
        trigger_config: triggerConfig,
        action_type: actionType,
        template_subject: payload.summary || payload.name,
        template_content: payload.content,
        is_active: true,
        next_run_at:
          payload.schedule_enabled === true
            ? triggerConfig.schedule_next_run_at
            : null,
        created_by: userId,
        updated_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapRule((data ?? {}) as Record<string, unknown>);
  },

  async update(id: string, payload: AutomationUpdateInput) {
    const { orgId, userId } = requireOrgContext();
    const current = await supabase
      .from("automation_rules")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (current.error) {
      throw current.error;
    }

    const currentRow = (current.data ?? {}) as Record<string, unknown>;
    const currentTriggerType =
      currentRow.trigger_type === "birthday" ||
      currentRow.trigger_type === "inactive_days" ||
      currentRow.trigger_type === "after_purchase" ||
      currentRow.trigger_type === "new_customer"
        ? currentRow.trigger_type
        : "new_customer";
    const mergedTriggerConfig = buildTriggerConfig({
      trigger_type: payload.trigger_type ?? currentTriggerType,
      trigger_days: payload.trigger_days ?? undefined,
      schedule_enabled: payload.schedule_enabled ?? false,
      schedule_interval_minutes: payload.schedule_interval_minutes ?? undefined,
      schedule_start_at: payload.schedule_start_at ?? undefined,
    });

    const { data, error } = await supabase
      .from("automation_rules")
      .update({
        name: payload.name ?? currentRow.name,
        description:
          payload.description !== undefined ? payload.description || null : currentRow.description,
        trigger_type: payload.trigger_type ?? currentRow.trigger_type,
        trigger_config: mergedTriggerConfig,
        action_type:
          payload.channel !== undefined
            ? payload.channel === "sms"
              ? "send_sms"
              : "send_email"
            : currentRow.action_type,
        template_subject:
          payload.summary !== undefined
            ? payload.summary || payload.name || String(currentRow.template_subject ?? currentRow.name ?? "")
            : currentRow.template_subject,
        template_content: payload.content ?? currentRow.template_content,
        next_run_at:
          payload.schedule_enabled === true
            ? mergedTriggerConfig.schedule_next_run_at
            : null,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("org_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapRule((data ?? {}) as Record<string, unknown>);
  },

  async toggleActive(id: string, isActive: boolean) {
    const { orgId, userId } = requireOrgContext();
    const { data, error } = await supabase
      .from("automation_rules")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("org_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return mapRule((data ?? {}) as Record<string, unknown>);
  },

  async runNow(id: string) {
    return communicationService.runAutomationRule(id, { source: "manual" });
  },

  async duplicate(id: string) {
    const base = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", id)
      .single();

    if (base.error) {
      throw base.error;
    }

    const row = mapRule((base.data ?? {}) as Record<string, unknown>);
    return automationService.create({
      name: `${row.name} (Copy)`,
      description: row.description,
      trigger_type: row.trigger_type,
      trigger_days: row.trigger_days,
      channel: row.channel,
      summary: row.action_summary,
      content: row.content,
      schedule_enabled: false,
      schedule_interval_minutes: row.schedule_interval_minutes ?? 60,
    });
  },

  async delete(id: string) {
    const { orgId, userId } = requireOrgContext();
    const { error } = await supabase
      .from("automation_rules")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      })
      .eq("org_id", orgId)
      .eq("id", id)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
  },
};
