import { supabase } from "@/lib/supabase";
import type { Campaign } from "@/types";

import {
  type CampaignFilters,
  type CampaignRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  runBestEffort,
  toCampaign,
  withLatency,
} from "@/services/shared";

export type CampaignCreateInput = {
  name: string;
  description?: string;
  channel: Campaign["channel"];
  customer_types?: Campaign["customer_types"];
  subject?: string;
  content: string;
  recipient_count?: number;
  status?: Campaign["status"];
  scheduled_at?: string | null;
};

export type CampaignUpdateInput = Partial<CampaignCreateInput>;

async function fetchCampaignRow(id: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export const campaignService = {
  getList(filters: CampaignFilters = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = supabase.from("campaigns").select("*").order("created_at", {
          ascending: false,
        });

        if (filters.status && filters.status !== "all") {
          query = query.eq("status", filters.status);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return ((data ?? []) as CampaignRow[]).map(toCampaign);
      })(),
    );
  },

  create(payload: CampaignCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        const status = payload.status ?? "draft";
        const recipientCount = payload.recipient_count ?? 0;
        const sentCount =
          status === "sent" ? recipientCount : status === "sending" ? Math.round(recipientCount * 0.6) : 0;
        const openedCount =
          status === "sent" ? Math.round(sentCount * 0.42) : status === "sending" ? Math.round(sentCount * 0.25) : 0;
        const clickCount =
          status === "sent" ? Math.round(sentCount * 0.11) : status === "sending" ? Math.round(sentCount * 0.05) : 0;
        const failedCount = status === "sent" ? Math.max(recipientCount - sentCount, 0) : 0;
        const { data, error } = await supabase
          .from("campaigns")
          .insert({
            name: payload.name,
            description: payload.description || null,
            channel: payload.channel,
            subject: payload.subject || null,
            content: payload.content,
            target_segment: {
              customer_types: payload.customer_types ?? [],
            },
            recipient_count: recipientCount,
            status,
            sent_count: sentCount,
            opened_count: openedCount,
            click_count: clickCount,
            failed_count: failedCount,
            scheduled_at: payload.scheduled_at || null,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("campaign.create.audit", () =>
          createAuditLog({
            action: "create",
            entityType: "campaign",
            entityId: data.id,
            newData: {
              message: `Tạo chiến dịch ${payload.name}`,
              status,
            },
            userId: currentUserId,
          }),
        );

        return toCampaign(data);
      })(),
    );
  },

  update(id: string, payload: CampaignUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchCampaignRow(id);
        const currentUserId = await getCurrentProfileId();
        const nextStatus = payload.status ?? previous.status ?? "draft";
        const nextRecipientCount = payload.recipient_count ?? previous.recipient_count ?? 0;
        const nextSentCount =
          nextStatus === "sent"
            ? Math.max(previous.sent_count ?? 0, nextRecipientCount)
            : nextStatus === "sending"
              ? Math.max(previous.sent_count ?? 0, Math.round(nextRecipientCount * 0.6))
              : previous.sent_count ?? 0;
        const nextOpenedCount =
          nextStatus === "sent"
            ? Math.max(previous.opened_count ?? 0, Math.round(nextSentCount * 0.42))
            : nextStatus === "sending"
              ? Math.max(previous.opened_count ?? 0, Math.round(nextSentCount * 0.25))
              : previous.opened_count ?? 0;
        const nextClickCount =
          nextStatus === "sent"
            ? Math.max((previous as CampaignRow).click_count ?? 0, Math.round(nextSentCount * 0.11))
            : nextStatus === "sending"
              ? Math.max((previous as CampaignRow).click_count ?? 0, Math.round(nextSentCount * 0.05))
              : (previous as CampaignRow).click_count ?? 0;
        const nextFailedCount =
          nextStatus === "sent"
            ? Math.max((previous as CampaignRow).failed_count ?? 0, Math.max(nextRecipientCount - nextSentCount, 0))
            : (previous as CampaignRow).failed_count ?? 0;
        const { data, error } = await supabase
          .from("campaigns")
          .update({
            name: payload.name ?? previous.name,
            description: payload.description ?? previous.description,
            channel: payload.channel ?? previous.channel,
            subject: payload.subject ?? previous.subject,
            content: payload.content ?? previous.content,
            target_segment: {
              customer_types:
                payload.customer_types ??
                  ((previous.target_segment as { customer_types?: Campaign["customer_types"] })
                  ?.customer_types ??
                  []),
            },
            recipient_count: nextRecipientCount,
            status: nextStatus,
            sent_count: nextSentCount,
            opened_count: nextOpenedCount,
            click_count: nextClickCount,
            failed_count: nextFailedCount,
            scheduled_at:
              payload.scheduled_at === undefined
                ? previous.scheduled_at
                : payload.scheduled_at,
            sent_at:
              nextStatus === "sent"
                ? previous.sent_at ?? new Date().toISOString()
                : previous.sent_at,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("campaign.update.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "campaign",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Cập nhật chiến dịch ${data.name}`,
            },
            userId: currentUserId,
          }),
        );

        return toCampaign(data);
      })(),
    );
  },

  updateStatus(id: string, status: Campaign["status"]) {
    return campaignService.update(id, {
      status,
      scheduled_at: status === "scheduled" ? new Date().toISOString() : null,
    });
  },

  duplicate(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const campaign = await fetchCampaignRow(id);
        return campaignService.create({
          name: `${campaign.name} (Copy)`,
          description: campaign.description ?? "",
          channel: campaign.channel,
          customer_types:
            ((campaign.target_segment as { customer_types?: Campaign["customer_types"] })
              ?.customer_types ??
              []),
          subject: campaign.subject ?? "",
          content: campaign.content,
          recipient_count: campaign.recipient_count ?? 0,
          status: "draft",
          scheduled_at: null,
        });
      })(),
    );
  },

  delete(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchCampaignRow(id);
        const currentUserId = await getCurrentProfileId();
        const { error } = await supabase.from("campaigns").delete().eq("id", id);

        if (error) {
          throw error;
        }

        void runBestEffort("campaign.delete.audit", () =>
          createAuditLog({
            action: "delete",
            entityType: "campaign",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Xóa chiến dịch ${previous.name}`,
            },
            userId: currentUserId,
          }),
        );
      })(),
    );
  },
};
