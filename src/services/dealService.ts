import { supabase } from "@/lib/supabase";
import type { Deal } from "@/types";

import { notificationService } from "@/services/notificationService";
import {
  type DealFilters,
  type DealRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  toDeal,
  withLatency,
} from "@/services/shared";

export type DealCreateInput = {
  title: string;
  customer_id: string;
  owner_id?: string;
  stage?: Deal["stage"];
  value?: number;
  probability?: number;
  expected_close_at?: string | null;
  description?: string;
};

export type DealUpdateInput = Partial<DealCreateInput>;

async function fetchDealRow(id: string) {
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as DealRow;
}

export const dealService = {
  getList(filters: DealFilters = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = supabase.from("deals").select("*").order("created_at", { ascending: false });

        if (filters.stage && filters.stage !== "all") {
          query = query.eq("stage", filters.stage);
        }

        if (filters.customerId) {
          query = query.eq("customer_id", filters.customerId);
        }

        if (filters.ownerId && filters.ownerId !== "all") {
          query = query.eq("owner_id", filters.ownerId);
        }

        if (filters.search) {
          query = query.ilike("title", `%${filters.search.trim()}%`);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return ((data ?? []) as DealRow[]).map(toDeal);
      })(),
    );
  },

  getById(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        return toDeal(await fetchDealRow(id));
      })(),
    );
  },

  create(payload: DealCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("deals")
          .insert({
            title: payload.title,
            customer_id: payload.customer_id,
            owner_id: payload.owner_id ?? currentUserId,
            stage: payload.stage ?? "lead",
            value: payload.value ?? 0,
            probability: payload.probability ?? 20,
            expected_close_at: payload.expected_close_at ?? null,
            description: payload.description ?? null,
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "create",
          entityType: "deal",
          entityId: data.id,
          newData: {
            message: `Tạo cơ hội ${payload.title}`,
            stage: payload.stage ?? "lead",
            value: payload.value ?? 0,
          },
          userId: currentUserId,
        });

        if (data.owner_id) {
          await notificationService.createUnique({
            user_id: data.owner_id,
            title: `Cơ hội mới: ${data.title}`,
            message: `Bạn vừa được giao cơ hội mới ở giai đoạn ${data.stage}.`,
            type: "info",
            entity_type: "deal",
            entity_id: data.id,
          });
        }

        return toDeal(data as DealRow);
      })(),
    );
  },

  update(id: string, payload: DealUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchDealRow(id);
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("deals")
          .update({
            title: payload.title ?? previous.title,
            customer_id: payload.customer_id ?? previous.customer_id,
            owner_id: payload.owner_id ?? previous.owner_id,
            stage: payload.stage ?? previous.stage,
            value: payload.value ?? previous.value,
            probability: payload.probability ?? previous.probability,
            expected_close_at:
              payload.expected_close_at === undefined
                ? previous.expected_close_at
                : payload.expected_close_at,
            description: payload.description ?? previous.description,
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
          entityType: "deal",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: {
            message: `Cập nhật cơ hội ${data.title}`,
            stage: data.stage,
            value: data.value,
          },
          userId: currentUserId,
        });

        if (data.owner_id && previous.stage !== data.stage) {
          await notificationService.createUnique({
            user_id: data.owner_id,
            title: `Pipeline cập nhật: ${data.title}`,
            message: `Cơ hội đã chuyển sang giai đoạn ${data.stage}.`,
            type: data.stage === "won" ? "success" : data.stage === "lost" ? "warning" : "info",
            entity_type: "deal",
            entity_id: id,
          });
        }

        return toDeal(data as DealRow);
      })(),
    );
  },

  updateStage(id: string, stage: Deal["stage"]) {
    const probabilityMap: Record<Deal["stage"], number> = {
      lead: 20,
      qualified: 35,
      proposal: 55,
      negotiation: 75,
      won: 100,
      lost: 0,
    };

    return dealService.update(id, { stage, probability: probabilityMap[stage] });
  },

  delete(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchDealRow(id);
        const currentUserId = await getCurrentProfileId();
        const { error } = await supabase.from("deals").delete().eq("id", id);

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "delete",
          entityType: "deal",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: { message: `Xóa cơ hội ${previous.title}` },
          userId: currentUserId,
        });
      })(),
    );
  },
};
