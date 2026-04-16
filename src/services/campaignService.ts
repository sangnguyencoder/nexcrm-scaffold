import { supabase } from "@/lib/supabase";
import type { Campaign, CustomerType } from "@/types";
import { useAuthStore } from "@/store/authStore";

import type { CampaignFilters } from "@/services/shared";

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

function requireOrgContext() {
  const state = useAuthStore.getState();
  const orgId = state.orgId;
  const userId = state.profile?.id ?? state.user?.id ?? null;
  if (!orgId) {
    throw new Error("Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại.");
  }
  return { orgId, userId };
}

function toCampaign(row: Record<string, unknown>): Campaign {
  const targetSegment =
    row.target_segment && typeof row.target_segment === "object"
      ? (row.target_segment as Record<string, unknown>)
      : {};
  const customerTypes = Array.isArray(targetSegment.customer_types)
    ? targetSegment.customer_types.filter(
        (item): item is CustomerType =>
          item === "new" ||
          item === "potential" ||
          item === "loyal" ||
          item === "vip" ||
          item === "inactive",
      )
    : [];

  const sentCount = Number(row.sent_count ?? 0);
  const openedCount = Number(row.opened_count ?? 0);
  const clickCount = Number(row.click_count ?? 0);

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : "",
    channel:
      row.channel === "email" || row.channel === "sms" || row.channel === "both"
        ? row.channel
        : "email",
    customer_types: customerTypes,
    subject: row.subject ? String(row.subject) : "",
    content: row.content ? String(row.content) : "",
    recipient_count: Number(row.recipient_count ?? 0),
    status:
      row.status === "draft" ||
      row.status === "scheduled" ||
      row.status === "sending" ||
      row.status === "sent" ||
      row.status === "sent_with_errors" ||
      row.status === "cancelled"
        ? row.status
        : "draft",
    sent_count: sentCount,
    opened_count: openedCount,
    click_count: clickCount,
    failed_count: Number(row.failed_count ?? 0),
    scheduled_at: row.scheduled_at ? String(row.scheduled_at) : null,
    sent_at: row.sent_at ? String(row.sent_at) : null,
    created_at: String(row.created_at ?? ""),
    click_rate: sentCount > 0 ? (clickCount / sentCount) * 100 : 0,
    open_rate: sentCount > 0 ? (openedCount / sentCount) * 100 : 0,
  };
}

function toTargetSegment(customerTypes?: Campaign["customer_types"]) {
  if (!customerTypes?.length) {
    return {};
  }
  return {
    customer_types: customerTypes,
  };
}

export const campaignService = {
  async getList(filters: CampaignFilters = {}) {
    const { orgId } = requireOrgContext();
    let query = supabase
      .from("campaigns")
      .select("*")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(toCampaign);
  },

  async getById(id: string) {
    const { orgId } = requireOrgContext();
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("org_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      throw error;
    }
    return toCampaign((data ?? {}) as Record<string, unknown>);
  },

  async create(payload: CampaignCreateInput) {
    const { orgId, userId } = requireOrgContext();
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        org_id: orgId,
        name: payload.name,
        description: payload.description || null,
        channel: payload.channel,
        subject: payload.subject || null,
        content: payload.content,
        target_segment: toTargetSegment(payload.customer_types),
        recipient_count: payload.recipient_count ?? 0,
        status: payload.status ?? "draft",
        scheduled_at: payload.scheduled_at ?? null,
        created_by: userId,
        updated_by: userId,
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toCampaign((data ?? {}) as Record<string, unknown>);
  },

  async update(id: string, payload: CampaignUpdateInput) {
    const { orgId, userId } = requireOrgContext();
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: userId,
    };
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.description !== undefined) patch.description = payload.description || null;
    if (payload.channel !== undefined) patch.channel = payload.channel;
    if (payload.subject !== undefined) patch.subject = payload.subject || null;
    if (payload.content !== undefined) patch.content = payload.content;
    if (payload.customer_types !== undefined) patch.target_segment = toTargetSegment(payload.customer_types);
    if (payload.recipient_count !== undefined) patch.recipient_count = payload.recipient_count;
    if (payload.status !== undefined) patch.status = payload.status;
    if (payload.scheduled_at !== undefined) patch.scheduled_at = payload.scheduled_at;

    const { data, error } = await supabase
      .from("campaigns")
      .update(patch)
      .eq("org_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .select("*")
      .single();

    if (error) {
      throw error;
    }
    return toCampaign((data ?? {}) as Record<string, unknown>);
  },

  async duplicate(id: string) {
    const base = await campaignService.getById(id);
    return campaignService.create({
      name: `${base.name} (Copy)`,
      description: base.description,
      channel: base.channel,
      customer_types: base.customer_types,
      subject: base.subject,
      content: base.content,
      recipient_count: base.recipient_count,
      status: "draft",
      scheduled_at: null,
    });
  },

  async delete(id: string) {
    const { orgId, userId } = requireOrgContext();
    const { error } = await supabase
      .from("campaigns")
      .update({
        deleted_at: new Date().toISOString(),
        status: "cancelled",
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
