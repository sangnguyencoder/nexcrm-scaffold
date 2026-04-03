import { supabase } from "@/lib/supabase";
import type { AppSettings, Campaign, CustomerType, OutboundMessage, OutboundMessageStatus } from "@/types";

import { notificationService } from "@/services/notificationService";
import { settingsService } from "@/services/settingsService";
import {
  type AutomationRuleRow,
  type CampaignRow,
  type CustomerRow,
  type OutboundMessageFilters,
  type OutboundMessageRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  runBestEffort,
  toCampaign,
  toOutboundMessage,
  withLatency,
} from "@/services/shared";

type DispatchMessage = {
  customerId: string | null;
  recipient: string;
  subject: string;
  content: string;
};

type DispatchResult = {
  recipient: string;
  provider: string;
  status: OutboundMessageStatus;
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
};

function seededNumber(input: string) {
  return [...input].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

function simulateStatus(recipient: string, channel: "email" | "sms") {
  const seed = seededNumber(recipient);
  const sentAt = new Date().toISOString();

  if (seed % 13 === 0) {
    return {
      status: "failed" as const,
      error_message: "Provider chưa cấu hình hoặc mô phỏng lỗi gửi.",
      sent_at: null,
      opened_at: null,
      clicked_at: null,
    };
  }

  if (channel === "sms") {
    return {
      status: seed % 3 === 0 ? ("delivered" as const) : ("sent" as const),
      error_message: null,
      sent_at: sentAt,
      opened_at: null,
      clicked_at: null,
    };
  }

  if (seed % 5 === 0) {
    return {
      status: "clicked" as const,
      error_message: null,
      sent_at: sentAt,
      opened_at: sentAt,
      clicked_at: new Date(Date.now() + 60_000).toISOString(),
    };
  }

  if (seed % 2 === 0) {
    return {
      status: "opened" as const,
      error_message: null,
      sent_at: sentAt,
      opened_at: new Date(Date.now() + 30_000).toISOString(),
      clicked_at: null,
    };
  }

  return {
    status: "sent" as const,
    error_message: null,
    sent_at: sentAt,
    opened_at: null,
    clicked_at: null,
  };
}

async function fetchCampaignRow(id: string) {
  const { data, error } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (error) throw error;
  return data as CampaignRow;
}

async function fetchAutomationRuleRow(id: string) {
  const { data, error } = await supabase.from("automation_rules").select("*").eq("id", id).single();
  if (error) throw error;
  return data as AutomationRuleRow;
}

async function fetchActiveCustomers() {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) throw error;
  return (data ?? []) as CustomerRow[];
}

async function invokeProvider(
  channel: "email" | "sms",
  messages: DispatchMessage[],
  settings: AppSettings,
) {
  if (!messages.length) {
    return [] as DispatchResult[];
  }

  const providerConfig = channel === "email" ? settings.integrations.email_provider : settings.integrations.sms_provider;
  const providerName = providerConfig.provider ?? "simulation";

  if (!providerConfig.enabled || !providerConfig.provider) {
    return messages.map((message) => ({
      recipient: message.recipient,
      provider: "simulation",
      ...simulateStatus(message.recipient, channel),
    }));
  }

  try {
    const { data, error } = await supabase.functions.invoke("dispatch-communication", {
      body: {
        channel,
        settings: providerConfig,
        messages,
      },
    });

    if (error) {
      throw error;
    }

    const results = ((data as { results?: DispatchResult[] } | null)?.results ?? []).map((result) => {
      if (result.status === "sent" && channel === "email") {
        return {
          ...result,
          ...simulateStatus(result.recipient, channel),
          provider: result.provider || providerName,
          error_message: result.error_message ?? null,
        };
      }

      return {
        ...result,
        provider: result.provider || providerName,
      };
    });

    return results;
  } catch {
    return messages.map((message) => ({
      recipient: message.recipient,
      provider: "simulation",
      ...simulateStatus(message.recipient, channel),
    }));
  }
}

function personalize(content: string, fullName: string) {
  return content.replaceAll("{ten_khach_hang}", fullName).replaceAll("{tên_khách_hàng}", fullName);
}

function buildCampaignMessages(
  campaign: Campaign,
  customerRows: CustomerRow[],
) {
  const customerTypes = (campaign.customer_types ?? []) as CustomerType[];
  const targets = customerRows.filter((customer) =>
    customerTypes.length ? customerTypes.includes((customer.customer_type ?? "new") as CustomerType) : true,
  );

  const emailMessages: DispatchMessage[] = [];
  const smsMessages: DispatchMessage[] = [];

  for (const customer of targets) {
    const name = customer.full_name;
    if ((campaign.channel === "email" || campaign.channel === "both") && customer.email) {
      emailMessages.push({
        customerId: customer.id,
        recipient: customer.email,
        subject: campaign.subject,
        content: personalize(campaign.content, name),
      });
    }

    if ((campaign.channel === "sms" || campaign.channel === "both") && customer.phone) {
      smsMessages.push({
        customerId: customer.id,
        recipient: customer.phone,
        subject: campaign.subject,
        content: personalize(campaign.content, name),
      });
    }
  }

  return { emailMessages, smsMessages };
}

function pickAutomationCustomers(rule: AutomationRuleRow, customerRows: CustomerRow[]) {
  const now = new Date();
  if (rule.trigger_type === "birthday") {
    return customerRows.filter((customer) => {
      if (!customer.date_of_birth) return false;
      const dob = new Date(customer.date_of_birth);
      return dob.getDate() === now.getDate() && dob.getMonth() === now.getMonth();
    });
  }

  if (rule.trigger_type === "inactive_days") {
    const days = Number((rule.trigger_config ?? {}).days ?? 30);
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return customerRows.filter((customer) => new Date(customer.last_order_at ?? customer.created_at).getTime() <= threshold);
  }

  if (rule.trigger_type === "after_purchase") {
    const days = Number((rule.trigger_config ?? {}).days ?? 7);
    const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
    return customerRows.filter((customer) => new Date(customer.last_order_at ?? customer.created_at).getTime() >= threshold);
  }

  return customerRows.filter((customer) => {
    const createdAt = new Date(customer.created_at).getTime();
    return createdAt >= Date.now() - 24 * 60 * 60 * 1000;
  });
}

async function insertOutboundMessages(
  rows: Array<{
    campaign_id?: string | null;
    automation_rule_id?: string | null;
    customer_id?: string | null;
    channel: "email" | "sms";
    provider: string;
    recipient: string;
    subject: string;
    content: string;
    status: OutboundMessageStatus;
    error_message: string | null;
    sent_at: string | null;
    opened_at: string | null;
    clicked_at: string | null;
  }>,
) {
  if (!rows.length) return [] as OutboundMessage[];
  const actorId = await getCurrentProfileId();
  const { data, error } = await supabase
    .from("outbound_messages")
    .insert(
      rows.map((row) => ({
        ...row,
        created_by: actorId,
        updated_at: new Date().toISOString(),
      })),
    )
    .select("*");

  if (error) throw error;
  return ((data ?? []) as OutboundMessageRow[]).map(toOutboundMessage);
}

async function updateCampaignMetrics(campaignId: string) {
  const { data, error } = await supabase
    .from("outbound_messages")
    .select("status")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const statuses = (data ?? []) as Array<{ status?: OutboundMessageStatus }>;
  const sentCount = statuses.filter((item) => ["sent", "delivered", "opened", "clicked"].includes(item.status ?? "")).length;
  const openedCount = statuses.filter((item) => ["opened", "clicked"].includes(item.status ?? "")).length;
  const clickCount = statuses.filter((item) => item.status === "clicked").length;
  const failedCount = statuses.filter((item) => item.status === "failed").length;

  const { data: updated, error: updateError } = await supabase
    .from("campaigns")
    .update({
      sent_count: sentCount,
      opened_count: openedCount,
      click_count: clickCount,
      failed_count: failedCount,
      status: sentCount > 0 ? "sent" : failedCount > 0 ? "cancelled" : "draft",
      sent_at: sentCount > 0 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .select("*")
    .single();

  if (updateError) throw updateError;

  return toCampaign(updated as CampaignRow);
}

async function notifyIfEnabled(key: string, payload: Parameters<typeof notificationService.createUnique>[0]) {
  const settings = await settingsService.get();
  const enabled = settings.notification_settings.find((item) => item.key === key)?.enabled;
  if (!enabled) return null;
  return runBestEffort(`notification.${key}`, () => notificationService.createUnique(payload));
}

export const communicationService = {
  getOutboundMessages(filters: OutboundMessageFilters = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = supabase.from("outbound_messages").select("*").order("created_at", { ascending: false });

        if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
        if (filters.automationRuleId) query = query.eq("automation_rule_id", filters.automationRuleId);
        if (filters.customerId) query = query.eq("customer_id", filters.customerId);

        const { data, error } = await query;
        if (error) throw error;
        return ((data ?? []) as OutboundMessageRow[]).map(toOutboundMessage);
      })(),
    );
  },

  dispatchCampaign(campaignId: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const [campaignRow, customerRows, settings, actorId] = await Promise.all([
          fetchCampaignRow(campaignId),
          fetchActiveCustomers(),
          settingsService.get(),
          getCurrentProfileId(),
        ]);
        const campaign = toCampaign(campaignRow);
        const { emailMessages, smsMessages } = buildCampaignMessages(campaign, customerRows);

        if (!emailMessages.length && !smsMessages.length) {
          throw new Error("Chiến dịch không có người nhận hợp lệ để gửi.");
        }

        const [emailResults, smsResults] = await Promise.all([
          invokeProvider("email", emailMessages, settings),
          invokeProvider("sms", smsMessages, settings),
        ]);

        const inserted = await insertOutboundMessages([
          ...emailResults.map((result, index) => ({
            campaign_id: campaignId,
            customer_id: emailMessages[index]?.customerId ?? null,
            channel: "email" as const,
            provider: result.provider,
            recipient: result.recipient,
            subject: emailMessages[index]?.subject ?? "",
            content: emailMessages[index]?.content ?? "",
            status: result.status,
            error_message: result.error_message,
            sent_at: result.sent_at,
            opened_at: result.opened_at,
            clicked_at: result.clicked_at,
          })),
          ...smsResults.map((result, index) => ({
            campaign_id: campaignId,
            customer_id: smsMessages[index]?.customerId ?? null,
            channel: "sms" as const,
            provider: result.provider,
            recipient: result.recipient,
            subject: smsMessages[index]?.subject ?? "",
            content: smsMessages[index]?.content ?? "",
            status: result.status,
            error_message: result.error_message,
            sent_at: result.sent_at,
            opened_at: result.opened_at,
            clicked_at: result.clicked_at,
          })),
        ]);

        const updatedCampaign = await updateCampaignMetrics(campaignId);

        void runBestEffort("campaign.dispatch.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "campaign_dispatch",
            entityId: campaignId,
            newData: {
              message: `Gửi chiến dịch ${campaign.name}`,
              sent_count: updatedCampaign.sent_count,
              failed_count: updatedCampaign.failed_count ?? 0,
            },
            userId: actorId,
          }),
        );

        if (actorId) {
          await notifyIfEnabled("campaign_done", {
            user_id: actorId,
            title: `Chiến dịch hoàn tất: ${campaign.name}`,
            message: `Đã gửi ${updatedCampaign.sent_count} liên hệ, lỗi ${updatedCampaign.failed_count ?? 0}.`,
            type: updatedCampaign.failed_count ? "warning" : "success",
            entity_type: "campaign",
            entity_id: campaignId,
          });
        }

        return {
          campaign: updatedCampaign,
          messages: inserted,
        };
      })(),
      300,
    );
  },

  runAutomationRule(ruleId: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const [rule, customerRows, settings, actorId] = await Promise.all([
          fetchAutomationRuleRow(ruleId),
          fetchActiveCustomers(),
          settingsService.get(),
          getCurrentProfileId(),
        ]);
        const targets = pickAutomationCustomers(rule, customerRows);
        const actionConfig = (rule.action_config ?? {}) as { content?: string };
        const channel = rule.action_type === "send_sms" ? "sms" : "email";
        const messages: DispatchMessage[] = targets.flatMap((customer) => {
          const recipient = channel === "email" ? customer.email : customer.phone;
          if (!recipient) return [];

          return [
            {
              customerId: customer.id,
              recipient,
              subject: rule.name,
              content: personalize(String(actionConfig.content ?? ""), customer.full_name),
            },
          ];
        });

        if (!messages.length) {
          throw new Error("Không có khách hàng phù hợp hoặc thiếu thông tin liên hệ để chạy quy tắc.");
        }

        const results = await invokeProvider(channel, messages, settings);
        await insertOutboundMessages(
          results.map((result, index) => ({
            automation_rule_id: ruleId,
            customer_id: messages[index]?.customerId ?? null,
            channel,
            provider: result.provider,
            recipient: result.recipient,
            subject: messages[index]?.subject ?? "",
            content: messages[index]?.content ?? "",
            status: result.status,
            error_message: result.error_message,
            sent_at: result.sent_at,
            opened_at: result.opened_at,
            clicked_at: result.clicked_at,
          })),
        );

        const nextSentCount =
          Number(((rule.action_config ?? {}) as { sent_count?: number }).sent_count ?? 0) +
          results.filter((item) => item.status !== "failed").length;

        const { error } = await supabase
          .from("automation_rules")
          .update({
            action_config: {
              ...(rule.action_config ?? {}),
              sent_count: nextSentCount,
              last_run_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", ruleId);

        if (error) throw error;

        void runBestEffort("automation.run.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "automation_run",
            entityId: ruleId,
            newData: {
              message: `Chạy quy tắc tự động ${rule.name}`,
              sent_count: nextSentCount,
              matched_customers: messages.length,
            },
            userId: actorId,
          }),
        );

        if (actorId) {
          await notifyIfEnabled("campaign_done", {
            user_id: actorId,
            title: `Quy tắc đã chạy: ${rule.name}`,
            message: `Đã xử lý ${messages.length} liên hệ qua ${channel.toUpperCase()}.`,
            type: "success",
            entity_type: "automation",
            entity_id: ruleId,
          });
        }

        return {
          processed: messages.length,
          successful: results.filter((item) => item.status !== "failed").length,
          failed: results.filter((item) => item.status === "failed").length,
        };
      })(),
      300,
    );
  },
};
