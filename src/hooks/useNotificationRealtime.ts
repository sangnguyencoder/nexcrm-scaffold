import { useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/hooks/useNexcrmQueries";
import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/types";

export function useNotificationRealtime(userId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Record<string, unknown>;
          const notification: AppNotification = {
            id: String(incoming.id ?? ""),
            title: String(incoming.title ?? "Thông báo mới"),
            message: String(incoming.message ?? ""),
            type:
              (incoming.type as AppNotification["type"] | undefined) ?? "info",
            entity_type:
              (incoming.entity_type as AppNotification["entity_type"] | undefined) ??
              "system",
            entity_id: String(incoming.entity_id ?? ""),
            is_read: Boolean(incoming.is_read),
            created_at: String(incoming.created_at ?? new Date().toISOString()),
          };

          queryClient.setQueryData<AppNotification[]>(
            queryKeys.notifications(userId),
            (current = []) => [notification, ...current.filter((item) => item.id !== notification.id)],
          );
          const toastFn =
            notification.type === "success"
              ? toast.success
              : notification.type === "warning"
                ? toast.warning
                : notification.type === "error"
                  ? toast.error
                  : toast.info;
          toastFn(notification.title, {
            description: notification.message,
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Record<string, unknown>;
          queryClient.setQueryData<AppNotification[]>(
            queryKeys.notifications(userId),
            (current = []) =>
              current.map((item) =>
                item.id === String(incoming.id)
                  ? {
                      ...item,
                      is_read: Boolean(incoming.is_read),
                    }
                  : item,
              ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}
