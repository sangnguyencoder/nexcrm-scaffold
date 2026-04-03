import { supabase } from "@/lib/supabase";

import { communicationService } from "@/services/communicationService";
import {
  type AutomationRuleRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  runBestEffort,
  toAutomationRule,
  withLatency,
} from "@/services/shared";

type AutomationCreateInput = {
  name: string;
  description?: string;
  trigger_type: "birthday" | "inactive_days" | "after_purchase" | "new_customer";
  trigger_days?: number | null;
  channel: "email" | "sms";
  summary?: string;
  content: string;
};

function buildTriggerConfig(payload: AutomationCreateInput) {
  if (payload.trigger_type === "inactive_days" || payload.trigger_type === "after_purchase") {
    return {
      trigger_type: payload.trigger_type,
      trigger_config: { days: payload.trigger_days ?? 30 },
    };
  }

  return { trigger_type: payload.trigger_type, trigger_config: {} };
}

async function fetchRuleRow(id: string) {
  const { data, error } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export const automationService = {
  getAll() {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { data, error } = await supabase
          .from("automation_rules")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        return ((data ?? []) as AutomationRuleRow[]).map(toAutomationRule);
      })(),
    );
  },

  create(payload: AutomationCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        const triggerInfo = buildTriggerConfig(payload);
        const { data, error } = await supabase
          .from("automation_rules")
          .insert({
            name: payload.name,
            description: payload.description || null,
            is_active: true,
            trigger_type: triggerInfo.trigger_type,
            trigger_config: triggerInfo.trigger_config,
            action_type: payload.channel === "sms" ? "send_sms" : "send_email",
            action_config: {
              content: payload.content,
              summary:
                payload.summary?.trim() ||
                (payload.channel === "sms" ? "tự động qua SMS" : "tự động qua Email"),
              sent_count: 0,
            },
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("automation.create.audit", () =>
          createAuditLog({
            action: "create",
            entityType: "automation_rule",
            entityId: data.id,
            newData: {
              message: `Tạo quy tắc tự động ${payload.name}`,
            },
            userId: currentUserId,
          }),
        );

        return toAutomationRule(data);
      })(),
    );
  },

  toggleActive(id: string, isActive?: boolean) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchRuleRow(id);
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("automation_rules")
          .update({
            is_active: typeof isActive === "boolean" ? isActive : !(previous.is_active ?? true),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("automation.toggle.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "automation_rule",
            entityId: id,
            newData: {
              message: `Cập nhật trạng thái quy tắc ${previous.name}`,
              is_active: data.is_active,
            },
            userId: currentUserId,
          }),
        );

        return toAutomationRule(data);
      })(),
    );
  },

  runNow(id: string) {
    return communicationService.runAutomationRule(id);
  },
};
