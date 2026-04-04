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

type AutomationUpdateInput = Partial<AutomationCreateInput>;

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

  update(id: string, payload: AutomationUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchRuleRow(id);
        const currentUserId = await getCurrentProfileId();
        const triggerType = payload.trigger_type ?? previous.trigger_type;
        const triggerInfo = buildTriggerConfig({
          name: payload.name ?? previous.name,
          description: payload.description ?? previous.description ?? "",
          trigger_type: triggerType,
          trigger_days:
            payload.trigger_days ??
            ((previous.trigger_config as { days?: number } | null)?.days ?? 30),
          channel: payload.channel ?? (previous.action_type === "send_sms" ? "sms" : "email"),
          summary:
            payload.summary ??
            ((previous.action_config as { summary?: string } | null)?.summary ?? ""),
          content:
            payload.content ??
            ((previous.action_config as { content?: string } | null)?.content ?? ""),
        });
        const nextChannel = payload.channel ?? (previous.action_type === "send_sms" ? "sms" : "email");
        const nextSummary =
          payload.summary ??
          ((previous.action_config as { summary?: string } | null)?.summary ?? "");
        const nextContent =
          payload.content ??
          ((previous.action_config as { content?: string } | null)?.content ?? "");

        const { data, error } = await supabase
          .from("automation_rules")
          .update({
            name: payload.name ?? previous.name,
            description: payload.description ?? previous.description,
            trigger_type: triggerInfo.trigger_type,
            trigger_config: triggerInfo.trigger_config,
            action_type: nextChannel === "sms" ? "send_sms" : "send_email",
            action_config: {
              ...(previous.action_config as Record<string, unknown> | null),
              summary: nextSummary,
              content: nextContent,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("automation.update.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "automation_rule",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Cập nhật quy tắc tự động ${data.name}`,
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

  duplicate(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchRuleRow(id);
        const actionConfig = (previous.action_config as { summary?: string; content?: string } | null) ?? {};

        return automationService.create({
          name: `${previous.name} (Copy)`,
          description: previous.description ?? "",
          trigger_type: previous.trigger_type,
          trigger_days:
            ((previous.trigger_config as { days?: number } | null)?.days ?? 30),
          channel: previous.action_type === "send_sms" ? "sms" : "email",
          summary: actionConfig.summary ?? "",
          content: actionConfig.content ?? "",
        });
      })(),
    );
  },

  delete(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchRuleRow(id);
        const currentUserId = await getCurrentProfileId();
        const { error } = await supabase.from("automation_rules").delete().eq("id", id);

        if (error) {
          throw error;
        }

        void runBestEffort("automation.delete.audit", () =>
          createAuditLog({
            action: "delete",
            entityType: "automation_rule",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Xóa quy tắc tự động ${previous.name}`,
            },
            userId: currentUserId,
          }),
        );
      })(),
    );
  },

  runNow(id: string) {
    return communicationService.runAutomationRule(id);
  },
};
