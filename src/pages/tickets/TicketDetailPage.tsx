import { useQueryClient } from "@tanstack/react-query";
import {
  EyeOff,
  ExternalLink,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageLoader } from "@/components/shared/page-loader";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAppMutation } from "@/hooks/useAppMutation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useCustomerDetailQuery,
  queryKeys,
  useCommentsQuery,
  useTicketDetailQuery,
  useUsersQuery,
} from "@/hooks/useNexcrmQueries";
import { formatDateTime, formatTicketStatus, getPriorityColor, timeAgo } from "@/lib/utils";
import { getAppErrorMessage } from "@/services/shared";
import { ticketService } from "@/services/ticketService";

export function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ticketQuery = useTicketDetailQuery(id);
  const usersQuery = useUsersQuery();
  const customerQuery = useCustomerDetailQuery(ticketQuery.data?.customer_id);
  const commentsQuery = useCommentsQuery(id, Boolean(id));
  const ticket = ticketQuery.data;
  const users = usersQuery.data ?? [];
  const customer = customerQuery.data;
  const comments = commentsQuery.data ?? [];
  const [showInternal, setShowInternal] = useState(true);
  const [reply, setReply] = useState("");
  const [internalReply, setInternalReply] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [assignedSearch, setAssignedSearch] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);

  const thread = useMemo(
    () =>
      comments
        .filter((comment) => comment.ticket_id === ticket?.id)
        .filter((comment) => (showInternal ? true : comment.type !== "internal"))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments, showInternal, ticket?.id],
  );

  const filteredUsers = users.filter((user) =>
    user.full_name.toLowerCase().includes(assignedSearch.toLowerCase()),
  );

  const updateTicket = useAppMutation({
    errorMessage: "Không thể cập nhật ticket.",
    mutationFn: (payload: Parameters<typeof ticketService.update>[1]) =>
      ticketService.update(id ?? "", payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.ticket(id ?? "") }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    },
  });

  const addComment = useAppMutation({
    errorMessage: "Không thể thêm phản hồi.",
    mutationFn: (payload: { content: string; isInternal: boolean }) =>
      ticketService.addComment(id ?? "", payload.content, payload.isInternal),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
      setReply("");
    },
  });

  if (ticketQuery.isLoading) {
    return <PageLoader panels={2} />;
  }

  if (ticketQuery.error || commentsQuery.error || usersQuery.error) {
    return (
      <PageErrorState
        title="Không thể tải chi tiết ticket"
        description={getAppErrorMessage(
          ticketQuery.error ?? commentsQuery.error ?? usersQuery.error,
          "Một phần dữ liệu ticket hoặc luồng trao đổi chưa tải được. Vui lòng thử lại.",
        )}
        onRetry={() => {
          void Promise.all([
            ticketQuery.refetch(),
            commentsQuery.refetch(),
            usersQuery.refetch(),
            customerQuery.refetch(),
          ]);
        }}
      />
    );
  }

  if (!ticket) {
    return (
      <EmptyState
        icon={XCircle}
        title="Không tìm thấy ticket"
        description="Ticket này không còn tồn tại trong dữ liệu demo."
        actionLabel="Quay lại ticket"
        onAction={() => navigate("/tickets")}
      />
    );
  }

  const saveTitle = async () => {
    if (titleDraft.trim() && titleDraft.trim() !== ticket.title) {
      try {
        await updateTicket.mutateAsync({ title: titleDraft.trim() });
        toast.success("Đã cập nhật tiêu đề ticket");
      } catch {}
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px]">
      <Card>
        <CardContent className="flex h-full min-h-[720px] flex-col p-6">
          <div className="mb-6 space-y-3">
            <Input
              value={titleDraft || ticket.title}
              onChange={(event) => setTitleDraft(event.target.value)}
              onBlur={() => void saveTitle()}
              className="h-12 font-display text-2xl font-bold"
            />
            <div className="inline-flex rounded-full bg-muted px-3 py-1 font-mono text-xs text-muted-foreground">
              {ticket.ticket_code}
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2">
            {thread.map((item) =>
              item.type === "system" ? (
                <div key={item.id} className="text-center text-sm italic text-muted-foreground">
                  {item.system_label ?? item.content}
                </div>
              ) : (
                <div
                  key={item.id}
                  className={`max-w-[80%] rounded-2xl p-4 ${
                    item.type === "internal"
                      ? "bg-amber-500/10 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {users.find((user) => user.id === item.author_id)?.full_name ?? "Hệ thống"}
                      </span>
                      {item.type === "internal" ? (
                        <span className="inline-flex items-center gap-1">
                          <EyeOff className="size-3" />
                          Nội bộ
                        </span>
                      ) : null}
                    </div>
                    <span>{timeAgo(item.created_at)}</span>
                  </div>
                  <div className="text-sm leading-6">{item.content}</div>
                </div>
              ),
            )}
          </div>

          <div className="mt-6 space-y-4 border-t border-border pt-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Phản hồi ticket</div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Switch checked={internalReply} onChange={(event) => setInternalReply(event.target.checked)} />
                Nội bộ
              </label>
            </div>
            <Textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Nhập nội dung phản hồi khách hàng"
            />
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  if (reply.trim().length < 10) {
                    toast.error("Phản hồi tối thiểu 10 ký tự");
                    return;
                  }
                  try {
                    await addComment.mutateAsync({
                      content: reply.trim(),
                      isInternal: internalReply,
                    });
                    toast.success("Đã thêm phản hồi mới");
                  } catch {}
                }}
                disabled={addComment.isPending}
              >
                Gửi
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Thuộc tính ticket</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Trạng thái">
              <Select
                value={ticket.status}
                onChange={async (event) => {
                  const nextStatus = event.target.value as typeof ticket.status;
                  try {
                    await updateTicket.mutateAsync({ status: nextStatus });
                    await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
                    toast.success("Đã cập nhật trạng thái");
                  } catch {}
                }}
              >
                <option value="open">Mở</option>
                <option value="in_progress">Đang xử lý</option>
                <option value="pending">Chờ</option>
                <option value="resolved">Đã giải quyết</option>
                <option value="closed">Đóng</option>
              </Select>
            </Field>
            <Field label="Ưu tiên">
              <Select
                value={ticket.priority}
                onChange={async (event) => {
                  try {
                    await updateTicket.mutateAsync({ priority: event.target.value as typeof ticket.priority });
                    await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
                    toast.success("Đã cập nhật mức ưu tiên");
                  } catch {}
                }}
              >
                <option value="low">Thấp</option>
                <option value="medium">Trung bình</option>
                <option value="high">Cao</option>
                <option value="urgent">Khẩn cấp</option>
              </Select>
              <StatusBadge
                label={ticket.priority}
                className={getPriorityColor(ticket.priority)}
                dotClassName="bg-current"
              />
            </Field>
            <Field label="Phụ trách">
              <input
                value={assignedSearch}
                onChange={(event) => setAssignedSearch(event.target.value)}
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                placeholder="Tìm người phụ trách"
              />
              <Select
                value={ticket.assigned_to}
                onChange={async (event) => {
                  try {
                    await updateTicket.mutateAsync({ assigned_to: event.target.value });
                    await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
                    toast.success("Đã cập nhật người phụ trách");
                  } catch {}
                }}
              >
                {filteredUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center justify-between rounded-2xl border border-border p-4 text-sm">
              <span>Hiển thị ghi chú nội bộ</span>
              <Switch checked={showInternal} onChange={(event) => setShowInternal(event.target.checked)} />
            </label>
            {ticket.status === "resolved" ? (
              <Button variant="destructive" onClick={() => setCloseConfirmOpen(true)}>
                <ShieldCheck className="size-4" />
                Close Ticket
              </Button>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Khách hàng liên quan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="font-medium">{customer?.full_name ?? "--"}</div>
            <div className="text-sm text-muted-foreground">{customer?.customer_code}</div>
            <Button variant="secondary" onClick={() => navigate(`/customers/${customer?.id}`)}>
              <ExternalLink className="size-4" />
              Mở hồ sơ khách hàng
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Thông tin bổ sung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Danh mục</span>
              <span>{ticket.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Kênh</span>
              <span>{ticket.channel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hạn xử lý</span>
              <span className={new Date(ticket.due_at).getTime() < Date.now() ? "text-rose-500" : ""}>
                {formatDateTime(ticket.due_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tạo lúc</span>
              <span>{formatDateTime(ticket.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cập nhật</span>
              <span>{timeAgo(ticket.updated_at ?? ticket.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Giải quyết</span>
              <span>{ticket.resolved_at ? formatDateTime(ticket.resolved_at) : "--"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Đóng ticket này?"
        description="Ticket đã resolved sẽ được chuyển sang trạng thái closed."
        confirmLabel="Đóng ticket"
        onConfirm={async () => {
          try {
            await updateTicket.mutateAsync({ status: "closed" });
            await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
            toast.success("Ticket đã được đóng");
          } catch {}
        }}
      />
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      {children}
    </div>
  );
}
