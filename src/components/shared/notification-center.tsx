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
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useAppMutation } from "@/hooks/useAppMutation";
import { useNotificationsQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { cn, timeAgo } from "@/lib/utils";
import { notificationService } from "@/services/notificationService";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import type { AppNotification } from "@/types";

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

function getNotificationTone(item: AppNotification) {
  if (item.type === "success") {
    return "bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-200";
  }

  if (item.type === "warning" || item.type === "error") {
    return "bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-200";
  }

  return "bg-primary/10 text-primary ring-primary/20";
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notificationOpen, setNotificationOpen } = useUiStore();
  const user = useAuthStore((state) => state.user);
  const { data = [] } = useNotificationsQuery(user?.id);
  const unreadCount = data.filter((item) => !item.is_read).length;

  const markRead = useAppMutation({
    action: "notification.mark-read",
    errorMessage: "Không thể đánh dấu thông báo đã đọc.",
    mutationFn: notificationService.markRead,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications(user?.id) });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKeys.notifications(user?.id));
      queryClient.setQueryData<AppNotification[]>(
        queryKeys.notifications(user?.id),
        (current = []) =>
          current.map((item) => (item.id === id ? { ...item, is_read: true } : item)),
      );
      return { previous };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) }),
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications(user?.id), context.previous);
      }
    },
  });

  const markAll = useAppMutation({
    action: "notification.mark-all-read",
    errorMessage: "Không thể đánh dấu tất cả thông báo đã đọc.",
    mutationFn: () => notificationService.markAllRead(user?.id ?? ""),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications(user?.id) });
      const previous = queryClient.getQueryData<AppNotification[]>(queryKeys.notifications(user?.id));
      queryClient.setQueryData<AppNotification[]>(
        queryKeys.notifications(user?.id),
        (current = []) => current.map((item) => ({ ...item, is_read: true })),
      );
      return { previous };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(user?.id) });
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.notifications(user?.id), context.previous);
      }
    },
  });

  return (
    <Sheet
      open={notificationOpen}
      onOpenChange={setNotificationOpen}
      title="Thông báo"
      description={
        unreadCount
          ? `${unreadCount} thông báo chưa đọc cần xử lý.`
          : "Trung tâm thông báo đã sạch."
      }
      className="w-[min(100vw,440px)]"
      bodyClassName="space-y-4"
    >
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">Inbox vận hành</div>
          <div className="text-xs text-muted-foreground">
            Theo dõi sự kiện mới và mở nhanh thực thể liên quan.
          </div>
        </div>
        <StatusBadge
          label={`${unreadCount} chưa đọc`}
          className={unreadCount ? "bg-primary/10 text-primary ring-primary/20" : "bg-muted text-muted-foreground ring-border"}
          dotClassName={unreadCount ? "bg-primary" : "bg-border"}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => markAll.mutate()} disabled={!unreadCount}>
          Đánh dấu tất cả đã đọc
        </Button>
      </div>

      {data.length ? (
        <div className="space-y-2">
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
                  "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                  item.is_read
                    ? "border-border/70 bg-card hover:bg-muted/35"
                    : "border-primary/15 bg-primary/5 hover:bg-primary/10",
                )}
              >
                <div className="relative mt-0.5">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-border/70 bg-muted/35 text-muted-foreground">
                    <Icon className="size-4" />
                  </div>
                  {!item.is_read ? (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.message}</div>
                    </div>
                    <div className="shrink-0 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      {timeAgo(item.created_at)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <StatusBadge
                      label={item.entity_type}
                      className={getNotificationTone(item)}
                      dotClassName="bg-current"
                    />
                    <span className="text-xs font-medium text-muted-foreground">Mở liên kết</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={BellOff}
          title="Không có thông báo mới"
          description="Thông báo CRM mới nhất sẽ xuất hiện tại đây để đội vận hành xử lý nhanh."
          className="min-h-[320px] border-dashed bg-transparent shadow-none"
        />
      )}
    </Sheet>
  );
}
