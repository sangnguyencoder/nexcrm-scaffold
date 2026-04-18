import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock3, EyeOff, ExternalLink, MessageSquare, ShieldCheck, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { InspectorList } from "@/components/shared/inspector-list";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { PageErrorState } from "@/components/shared/page-error-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionPanel } from "@/components/shared/section-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserSelect } from "@/components/shared/user-select";
import { useAppMutation } from "@/hooks/useAppMutation";
import {
  queryKeys,
  useCommentsQuery,
  useCustomerDetailQuery,
  useTicketDetailQuery,
  useUsersQuery,
} from "@/hooks/useNexcrmQueries";
import { formatDateTime, formatNumberCompact, formatTicketStatus, timeAgo } from "@/lib/utils";
import { getAppErrorMessage } from "@/services/shared";
import { ticketService } from "@/services/ticketService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ticketQuery = useTicketDetailQuery(id);
  const usersQuery = useUsersQuery();
  const customerQuery = useCustomerDetailQuery(ticketQuery.data?.customer_id);
  const commentsQuery = useCommentsQuery(id, Boolean(id));
  const ticket = ticketQuery.data;
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const customer = customerQuery.data;
  const comments = useMemo(() => commentsQuery.data ?? [], [commentsQuery.data]);
  const [showInternal, setShowInternal] = useState(true);
  const [reply, setReply] = useState("");
  const [internalReply, setInternalReply] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [currentTimestamp] = useState(() => Date.now());
  const replyTooShort = reply.trim().length > 0 && reply.trim().length < 10;

  const thread = useMemo(
    () =>
      comments
        .filter((comment) => comment.ticket_id === ticket?.id)
        .filter((comment) => (showInternal ? true : comment.type !== "internal"))
        .sort((left, right) => new Date(left.created_at).getTime() - new Date(right.created_at).getTime()),
    [comments, showInternal, ticket?.id],
  );

  const isOverdue = ticket ? new Date(ticket.due_at).getTime() < currentTimestamp : false;
  const priorityTone = ticket?.priority === "urgent" || ticket?.priority === "high" ? "danger" : "warning";

  const updateTicket = useAppMutation({
    action: "ticket.update",
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
    action: "ticket.comment.create",
    errorMessage: "Không thể thêm phản hồi.",
    mutationFn: (payload: { content: string; isInternal: boolean }) =>
      ticketService.addComment(id ?? "", payload.content, payload.isInternal),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
      setReply("");
      toast.success("Đã thêm phản hồi mới");
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

  const applyUpdate = async (
    payload: Parameters<typeof ticketService.update>[1],
    successMessage: string,
  ) => {
    try {
      await updateTicket.mutateAsync(payload);
      await queryClient.invalidateQueries({ queryKey: ["ticket-comments"] });
      toast.success(successMessage);
    } catch {
      return;
    }
  };

  const saveTitle = async () => {
    if (titleDraft.trim() && titleDraft.trim() !== ticket.title) {
      await applyUpdate({ title: titleDraft.trim() }, "Đã cập nhật tiêu đề ticket");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={ticket.title}
        // subtitle={`${ticket.ticket_code} · ${customer?.full_name ?? "Chưa gắn khách hàng"} · cập nhật ${timeAgo(ticket.updated_at ?? ticket.created_at)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {customer ? (
              <Button variant="secondary" size="sm" onClick={() => navigate(`/customers/${customer.id}`)}>
                <ExternalLink className="size-4" />
                Hồ sơ khách hàng
              </Button>
            ) : null}
            {ticket.status === "resolved" ? (
              <Button size="sm" onClick={() => setCloseConfirmOpen(true)}>
                <ShieldCheck className="size-4" />
                Close Ticket
              </Button>
            ) : null}
          </div>
        }
      />

      <MetricStrip>
        <MetricStripItem
          label="Trạng thái"
          value={formatTicketStatus(ticket.status)}
          helper="Workflow hiện tại của ticket."
          icon={ShieldCheck}
          tone="info"
        />
        <MetricStripItem
          label="Ưu tiên"
          value={ticket.priority.toUpperCase()}
          helper="Dùng để ưu tiên xử lý trong queue."
          icon={AlertTriangle}
          tone={priorityTone}
        />
        <MetricStripItem
          label="SLA"
          value={isOverdue ? "Quá hạn" : timeAgo(ticket.due_at)}
          helper={formatDateTime(ticket.due_at)}
          icon={Clock3}
          tone={isOverdue ? "danger" : "primary"}
        />
        <MetricStripItem
          label="Trao đổi"
          value={formatNumberCompact(thread.length)}
          helper={`${formatNumberCompact(comments.length)} comment tổng cộng.`}
          icon={MessageSquare}
          tone="primary"
        />
      </MetricStrip>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr),320px]">
        <div className="space-y-5">
          <SectionPanel
            title="Luồng trao đổi"
            // description="Thread chính, đủ rõ để xử lý ticket liên tục mà không đổi trang."
            meta={
              <Button
                variant={showInternal ? "outline" : "ghost"}
                size="sm"
                onClick={() => setShowInternal((value) => !value)}
              >
                <EyeOff className="size-4" />
                {showInternal ? "Ẩn note nội bộ" : "Hiện note nội bộ"}
              </Button>
            }
            contentClassName="p-0 lg:p-0"
          >
            {thread.length ? (
              <div className="max-h-[620px] divide-y divide-border/70 overflow-y-auto">
                {thread.map((item) =>
                  item.type === "system" ? (
                    <div key={item.id} className="px-4 py-4">
                      <div className="rounded-full border border-dashed border-border/80 bg-muted/30 px-4 py-2 text-center text-xs italic text-muted-foreground">
                        {item.system_label ?? item.content}
                      </div>
                    </div>
                  ) : (
                    <div key={item.id} className="px-4 py-4">
                      <div
                        className={
                          item.type === "internal"
                            ? "rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4"
                            : "rounded-2xl border border-border/70 bg-card p-4"
                        }
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {users.find((user) => user.id === item.author_id)?.full_name ?? "Hệ thống"}
                              </span>
                              <StatusBadge
                                label={item.type === "internal" ? "Internal note" : "Public reply"}
                                className={
                                  item.type === "internal"
                                    ? "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-200"
                                    : "bg-muted text-muted-foreground ring-border"
                                }
                                dotClassName={item.type === "internal" ? "bg-amber-500" : "bg-primary"}
                              />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateTime(item.created_at)}
                            </div>
                          </div>
                          <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            {timeAgo(item.created_at)}
                          </div>
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {item.content}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="p-4">
                <EmptyState
                  icon={EyeOff}
                  title="Chưa có trao đổi"
                  description="Ticket này chưa có comment nào để hiển thị."
                  className="min-h-[220px] border-dashed bg-transparent shadow-none"
                />
              </div>
            )}
          </SectionPanel>

          <SectionPanel
            title="Phản hồi ticket"
            // description="Soạn nhanh phản hồi công khai hoặc ghi chú nội bộ ngay trong cùng màn."
          >
            <div className="space-y-4">
              {addComment.actionError ? (
                <ActionErrorAlert
                  error={addComment.actionError}
                  onDismiss={addComment.clearActionError}
                  onRetry={addComment.canRetry ? () => void addComment.retryLast() : undefined}
                />
              ) : null}

              <FormField
                label="Nội dung phản hồi"
                hint={internalReply ? "Ghi chú chỉ hiển thị nội bộ" : "Sẽ được ghi vào thread ticket"}
                description={replyTooShort ? "Phản hồi cần tối thiểu 10 ký tự để gửi." : undefined}
                error={replyTooShort ? "Phản hồi tối thiểu 10 ký tự." : undefined}
              >
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  placeholder={
                    internalReply
                      ? "Nhập ghi chú nội bộ cho team xử lý ticket"
                      : "Nhập phản hồi gửi cho khách hàng"
                  }
                  rows={6}
                />
              </FormField>

              <div className="grid gap-2 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setInternalReply(false)}
                  className={
                    internalReply
                      ? "rounded-xl border border-border/80 px-3 py-2.5 text-left text-sm transition hover:bg-muted/35"
                      : "rounded-xl border border-primary/20 bg-primary/10 px-3 py-2.5 text-left text-sm text-primary transition"
                  }
                >
                  <div className="font-medium">Public reply</div>
                  <div className="mt-1 text-xs text-muted-foreground">Hiển thị trong luồng trao đổi với khách hàng.</div>
                </button>
                <button
                  type="button"
                  onClick={() => setInternalReply(true)}
                  className={
                    internalReply
                      ? "rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-left text-sm text-amber-700 transition dark:text-amber-200"
                      : "rounded-xl border border-border/80 px-3 py-2.5 text-left text-sm transition hover:bg-muted/35"
                  }
                >
                  <div className="flex items-center gap-2 font-medium">
                    <EyeOff className="size-4" />
                    Internal note
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">Chỉ team nội bộ nhìn thấy, không gửi cho khách.</div>
                </button>
              </div>

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
                    } catch {
                      return;
                    }
                  }}
                  disabled={addComment.isPending}
                >
                  {addComment.isPending ? "Đang gửi…" : "Gửi phản hồi"}
                </Button>
              </div>
            </div>
          </SectionPanel>
        </div>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <SectionPanel
            title="Điều phối ticket"
            // description="Cập nhật title, status, priority và assignee mà không làm đứt luồng xử lý."
          >
            <div className="space-y-4">
              {updateTicket.actionError ? (
                <ActionErrorAlert
                  error={updateTicket.actionError}
                  onDismiss={updateTicket.clearActionError}
                  onRetry={updateTicket.canRetry ? () => void updateTicket.retryLast() : undefined}
                />
              ) : null}

              <FormField label="Tiêu đề">
                <Input
                  value={titleDraft || ticket.title}
                  onChange={(event) => setTitleDraft(event.target.value)}
                  onBlur={() => void saveTitle()}
                  aria-label="Tiêu đề ticket"
                />
              </FormField>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <FormField label="Trạng thái">
                  <Select
                    value={ticket.status}
                    onChange={(event) =>
                      void applyUpdate(
                        { status: event.target.value as typeof ticket.status },
                        "Đã cập nhật trạng thái",
                      )
                    }
                  >
                    <option value="open">Mở</option>
                    <option value="in_progress">Đang xử lý</option>
                    <option value="pending">Chờ</option>
                    <option value="resolved">Đã giải quyết</option>
                    <option value="closed">Đóng</option>
                  </Select>
                </FormField>

                <FormField label="Ưu tiên">
                  <Select
                    value={ticket.priority}
                    onChange={(event) =>
                      void applyUpdate(
                        { priority: event.target.value as typeof ticket.priority },
                        "Đã cập nhật mức ưu tiên",
                      )
                    }
                  >
                    <option value="low">Thấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="high">Cao</option>
                    <option value="urgent">Khẩn cấp</option>
                  </Select>
                </FormField>
              </div>

              <FormSection
                title="Phụ trách"
                // description={assignedUser ? `${assignedUser.full_name} · ${assignedUser.department}` : "Chưa gán người xử lý"}
              >
                <FormField label="Người phụ trách">
                  <UserSelect
                    value={ticket.assigned_to}
                    onValueChange={(nextValue) =>
                      void applyUpdate(
                        { assigned_to: nextValue },
                        "Đã cập nhật người phụ trách",
                      )
                    }
                    users={users}
                    placeholder="Chọn người phụ trách"
                  />
                </FormField>
              </FormSection>
            </div>
          </SectionPanel>

          <SectionPanel
            title="SLA & metadata"
            // description="Mọi thông tin đủ để quyết định escalations hoặc follow-up tiếp theo."
          >
            <InspectorList
              items={[
                { label: "Danh mục", value: ticket.category },
                { label: "Kênh", value: ticket.channel },
                {
                  label: "Hạn xử lý",
                  value: formatDateTime(ticket.due_at),
                  valueClassName: isOverdue ? "text-rose-500" : undefined,
                },
                { label: "Tạo lúc", value: formatDateTime(ticket.created_at) },
                { label: "Cập nhật", value: timeAgo(ticket.updated_at ?? ticket.created_at) },
                { label: "Giải quyết", value: ticket.resolved_at ? formatDateTime(ticket.resolved_at) : "--" },
              ]}
            />
          </SectionPanel>

          {customer ? (
            <SectionPanel
              title="Khách hàng liên quan"
              // description="Mở nhanh hồ sơ để xem lịch sử giao dịch hoặc ticket khác."
              contentClassName="space-y-3"
            >
              <div className="text-sm font-medium text-foreground">{customer.full_name}</div>
              <div className="text-xs text-muted-foreground">{customer.customer_code}</div>
              <Button variant="secondary" onClick={() => navigate(`/customers/${customer.id}`)}>
                <ExternalLink className="size-4" />
                Mở hồ sơ khách hàng
              </Button>
            </SectionPanel>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        title="Đóng ticket này?"
        description="Ticket đã resolved sẽ được chuyển sang trạng thái closed."
        confirmLabel="Đóng ticket"
        onConfirm={() => void applyUpdate({ status: "closed" }, "Ticket đã được đóng")}
      />
    </div>
  );
}
