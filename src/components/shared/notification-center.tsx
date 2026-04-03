import {
  AlertTriangle,
  BellOff,
  CheckCircle2,
  CircleDot,
  Megaphone,
  MessageSquare,
  Target,
  User,
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useNotificationsQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { supabase } from "@/lib/supabase";
import { cn, timeAgo } from "@/lib/utils";
import { notificationService } from "@/services/notificationService";
import type { AppNotification } from "@/types";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function getLink(entityType: string, entityId: string) {
  if (entityType === "ticket") return `/tickets/${entityId}`;
  if (entityType === "customer") return `/customers/${entityId}`;
  if (entityType === "campaign") return "/campaigns";
  if (entityType === "transaction") return "/transactions";
  if (entityType === "task") return "/pipeline";
  if (entityType === "deal") return "/pipeline";
  if (entityType === "automation") return "/automation";
  return "/dashboard";
}

function getIcon(type: string, entityType: string) {
  if (entityType === "ticket") return MessageSquare;
  if (entityType === "customer") return User;
  if (entityType === "campaign") return Megaphone;
  if (entityType === "task") return CircleDot;
  if (entityType === "deal") return Target;
  if (type === "success") return CheckCircle2;
  return AlertTriangle;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notificationOpen, setNotificationOpen } = useUiStore();
  const user = useAuthStore((state) => state.user);
  const { data = [] } = useNotificationsQuery(user?.id);
  const unreadCount = data.filter((item) => !item.is_read).length;

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
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
            queryKeys.notifications(user.id),
            (current = []) => [notification, ...current.filter((item) => item.id !== notification.id)],
          );
          toast.info(notification.title);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const incoming = payload.new as Record<string, unknown>;
          queryClient.setQueryData<AppNotification[]>(
            queryKeys.notifications(user.id),
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
  }, [queryClient, user?.id]);

  const markRead = useMutation({
    mutationFn: notificationService.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) }),
  });

  const markAll = useMutation({
    mutationFn: () => notificationService.markAllRead(user?.id ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) });
      toast.success("Đã đánh dấu tất cả thông báo là đã đọc");
    },
  });

  return (
    <Sheet
      open={notificationOpen}
      onOpenChange={setNotificationOpen}
      title="Thông Báo"
      description={`${unreadCount} thông báo chưa đọc`}
      className="w-[min(100vw,400px)]"
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button variant="ghost" onClick={() => markAll.mutate()} disabled={!unreadCount}>
            Đánh dấu tất cả đã đọc
          </Button>
        </div>
        {data.length ? (
          <div className="space-y-3">
            {data.map((item) => {
              const Icon = getIcon(item.type, item.entity_type);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    markRead.mutate(item.id);
                    navigate(getLink(item.entity_type, item.entity_id));
                    setNotificationOpen(false);
                  }}
                  className={cn(
                    "w-full rounded-2xl border border-border p-4 text-left transition hover:bg-muted/40",
                    !item.is_read && "border-l-4 border-l-primary bg-primary/5",
                  )}
                >
                  <div className="flex gap-3">
                    <div className="mt-1 rounded-xl bg-muted p-2 text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-semibold">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {timeAgo(item.created_at)}
                        </div>
                      </div>
                      <div className="line-clamp-2 text-sm text-muted-foreground">
                        {item.message}
                      </div>
                      <div className="text-sm font-medium text-primary underline underline-offset-4">
                        Mở liên kết liên quan
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border text-center">
            <BellOff className="size-12 text-muted-foreground" />
            <div>
              <div className="font-display text-xl font-semibold">Không có thông báo mới</div>
              <div className="text-sm text-muted-foreground">
                Trung tâm thông báo sẽ hiển thị hoạt động CRM mới nhất.
              </div>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
