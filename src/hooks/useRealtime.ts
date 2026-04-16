import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/services/supabase";
import { dataLayerQueryKeys } from "@/hooks/useDataLayer";

export function useRealtimeTickets() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("tickets-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "support_tickets",
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: dataLayerQueryKeys.tickets() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

export function useRealtimeNotifications(userId?: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void Promise.all([
            queryClient.invalidateQueries({ queryKey: dataLayerQueryKeys.notifications({ userId }) }),
            queryClient.invalidateQueries({ queryKey: dataLayerQueryKeys.notificationCount(userId) }),
          ]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);
}

export function useRealtimeDeals() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("deals-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "deals",
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: dataLayerQueryKeys.deals() });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

