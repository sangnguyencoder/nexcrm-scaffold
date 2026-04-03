import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/types";

import {
  type NotificationRow,
  ensureSupabaseConfigured,
  toNotification,
  withLatency,
} from "@/services/shared";

export const notificationService = {
  getUnread(userId: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { data, error } = await supabase
          .from("notifications")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        return ((data ?? []) as NotificationRow[]).map(toNotification);
      })(),
    );
  },

  markRead(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { error } = await supabase
          .from("notifications")
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
          })
          .eq("id", id);

        if (error) {
          throw error;
        }
      })(),
      150,
    );
  },

  markAllRead(userId: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { error } = await supabase
          .from("notifications")
          .update({
            is_read: true,
            read_at: new Date().toISOString(),
          })
          .eq("user_id", userId)
          .eq("is_read", false);

        if (error) {
          throw error;
        }
      })(),
      150,
    );
  },

  create(payload: {
    user_id: string;
    title: string;
    message: string;
    type?: AppNotification["type"];
    entity_type?: AppNotification["entity_type"];
    entity_id?: string | null;
  }) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { data, error } = await supabase
          .from("notifications")
          .insert({
            user_id: payload.user_id,
            title: payload.title,
            message: payload.message,
            type: payload.type ?? "info",
            entity_type: payload.entity_type ?? "system",
            entity_id: payload.entity_id ?? null,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        return toNotification(data as NotificationRow);
      })(),
      100,
    );
  },

  async createUnique(payload: {
    user_id: string;
    title: string;
    message: string;
    type?: AppNotification["type"];
    entity_type?: AppNotification["entity_type"];
    entity_id?: string | null;
  }) {
    ensureSupabaseConfigured();
    const { data, error } = await supabase
      .from("notifications")
      .select("id")
      .eq("user_id", payload.user_id)
      .eq("title", payload.title)
      .eq("entity_type", payload.entity_type ?? "system")
      .eq("is_read", false)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return null;
    }

    return notificationService.create(payload);
  },
};
