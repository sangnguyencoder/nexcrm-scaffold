import { supabase } from "@/lib/supabase";

import { communicationService } from "@/services/communicationService";
import {
  type AutomationRuleRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  toAutomationRule,
  withLatency,
} from "@/services/shared";

type AutomationCreateInput = {
  name: string;
  trigger: string;
  channel: "email" | "sms";
  content: string;
};

function inferTriggerType(trigger: string) {
  if (trigger.toLowerCase().includes("sinh nhật")) {
    return { trigger_type: "birthday", trigger_config: {} };
  }
  if (trigger.toLowerCase().includes("không mua")) {
    return { trigger_type: "inactive_days", trigger_config: { days: 30 } };
  }
  if (trigger.toLowerCase().includes("mua hàng")) {
    return { trigger_type: "after_purchase", trigger_config: { days: 7 } };
  }

  return { trigger_type: "new_customer", trigger_config: {} };
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
        const triggerInfo = inferTriggerType(payload.trigger);
        const { data, error } = await supabase
          .from("automation_rules")
          .insert({
            name: payload.name,
            description: payload.trigger,
            is_active: true,
            trigger_type: triggerInfo.trigger_type,
            trigger_config: triggerInfo.trigger_config,
            action_type: payload.channel === "sms" ? "send_sms" : "send_email",
            action_config: {
              content: payload.content,
              summary:
                payload.channel === "sms" ? "tự động qua SMS" : "tự động qua Email",
              sent_count: 0,
            },
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "create",
          entityType: "automation_rule",
          entityId: data.id,
          newData: {
            message: `Tạo quy tắc tự động ${payload.name}`,
          },
          userId: currentUserId,
        });

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

        await createAuditLog({
          action: "update",
          entityType: "automation_rule",
          entityId: id,
          newData: {
            message: `Cập nhật trạng thái quy tắc ${previous.name}`,
            is_active: data.is_active,
          },
          userId: currentUserId,
        });

        return toAutomationRule(data);
      })(),
    );
  },

  runNow(id: string) {
    return communicationService.runAutomationRule(id);
  },
};
