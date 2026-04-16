import { supabase } from "@/lib/supabase";
import type { Campaign, OutboundMessage } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { campaignService } from "@/services/campaignService";

import type { OutboundMessageFilters } from "@/services/shared";

function requireOrgContext() {
  const state = useAuthStore.getState();
  const orgId = state.orgId;
  if (!orgId) {
    throw new Error("Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại.");
  }
  return { orgId };
}

function mapOutboundMessage(row: Record<string, unknown>): OutboundMessage {
  const email = row.recipient_email ? String(row.recipient_email) : null;
  const phone = row.recipient_phone ? String(row.recipient_phone) : null;
  return {
    id: String(row.id ?? ""),
    campaign_id: row.campaign_id ? String(row.campaign_id) : null,
    automation_rule_id: row.automation_rule_id ? String(row.automation_rule_id) : null,
    customer_id: row.customer_id ? String(row.customer_id) : null,
    channel: row.channel === "sms" ? "sms" : "email",
    provider: row.provider ? String(row.provider) : "",
    recipient: email ?? phone ?? "",
    subject: row.subject ? String(row.subject) : "",
    content: String(row.content ?? ""),
    status:
      row.status === "sent" ||
      row.status === "delivered" ||
      row.status === "opened" ||
      row.status === "clicked" ||
      row.status === "failed"
        ? row.status
        : "queued",
    error_message: row.error_message ? String(row.error_message) : null,
    opened_at: row.opened_at ? String(row.opened_at) : null,
    clicked_at: row.clicked_at ? String(row.clicked_at) : null,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    created_at: String(row.created_at ?? ""),
  };
}

export const communicationService = {
  async getOutboundMessages(filters: OutboundMessageFilters = {}) {
    const { orgId } = requireOrgContext();
    let query = supabase
      .from("outbound_messages")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
    if (filters.automationRuleId) query = query.eq("automation_rule_id", filters.automationRuleId);
    if (filters.customerId) query = query.eq("customer_id", filters.customerId);

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapOutboundMessage);
  },

  async dispatchCampaign(campaignId: string) {
    const { orgId } = requireOrgContext();
    const invoke = await supabase.functions.invoke("send-campaign", {
      body: {
        orgId,
        campaignId,
      },
    });

    if (invoke.error) {
      throw invoke.error;
    }

    const campaign = await campaignService.getById(campaignId);
    const messages = await communicationService.getOutboundMessages({ campaignId });
    return {
      campaign,
      messages,
      summary: invoke.data ?? null,
    };
  },

  async runAutomationRule(
    ruleId: string,
    options: {
      source?: "manual" | "scheduler";
    } = {},
  ) {
    const { orgId } = requireOrgContext();
    const source = options.source ?? "manual";
    const invoke = await supabase.functions.invoke("run-automation", {
      body: {
        orgId,
        ruleId,
        manual: source === "manual",
      },
    });

    if (invoke.error) {
      throw invoke.error;
    }

    const payload = (invoke.data ?? {}) as {
      processed?: number;
      sent_count?: number;
      failed_count?: number;
    };

    return {
      processed: Number(payload.processed ?? 0),
      successful: Number(payload.sent_count ?? 0),
      failed: Number(payload.failed_count ?? 0),
    };
  },

  async runSchedulerTick() {
    const { orgId } = requireOrgContext();
    const nowIso = new Date().toISOString();

    const { data: dueCampaignRows, error: dueCampaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("org_id", orgId)
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", nowIso)
      .is("deleted_at", null)
      .order("scheduled_at", { ascending: true })
      .limit(20);

    if (dueCampaignError) {
      throw dueCampaignError;
    }

    const campaignErrors: Array<{ id: string; name: string; error: string }> = [];
    let processedCampaigns = 0;

    for (const item of (dueCampaignRows ?? []) as Array<{ id: string }>) {
      try {
        await communicationService.dispatchCampaign(item.id);
        processedCampaigns += 1;
      } catch (error) {
        campaignErrors.push({
          id: item.id,
          name: item.id,
          error: error instanceof Error ? error.message : "Không thể chạy campaign theo lịch.",
        });
      }
    }

    const automationInvoke = await supabase.functions.invoke("run-automation", {
      body: {
        orgId,
        manual: false,
      },
    });

    let processedAutomationRules = 0;
    let failedAutomationRules = 0;
    const automationErrors: Array<{ id: string; name: string; error: string }> = [];

    if (automationInvoke.error) {
      failedAutomationRules = 1;
      automationErrors.push({
        id: "run-automation",
        name: "run-automation",
        error:
          automationInvoke.error.message ||
          "Không thể chạy automation scheduler tick.",
      });
    } else {
      const payload = (automationInvoke.data ?? {}) as {
        processed_rules?: number;
        failed_count?: number;
        errors?: Array<{ rule_id?: string; reason?: string }>;
      };
      processedAutomationRules = Number(payload.processed_rules ?? 0);
      failedAutomationRules = Number(payload.failed_count ?? 0);
      for (const errorItem of payload.errors ?? []) {
        if (!errorItem?.reason) continue;
        automationErrors.push({
          id: errorItem.rule_id ?? "unknown",
          name: errorItem.rule_id ?? "unknown",
          error: String(errorItem.reason),
        });
      }
    }

    return {
      dueCampaigns: (dueCampaignRows ?? []).length,
      processedCampaigns,
      failedCampaigns: campaignErrors.length,
      dueAutomationRules: processedAutomationRules + failedAutomationRules,
      processedAutomationRules,
      failedAutomationRules,
      campaignErrors,
      automationErrors,
    };
  },
};
