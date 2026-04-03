import { supabase } from "@/lib/supabase";
import type { Ticket, TicketComment } from "@/types";

import { notificationService } from "@/services/notificationService";
import {
  type AuditLogRow,
  type TicketCommentRow,
  type TicketFilters,
  type TicketRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  toTicket,
  toTicketComment,
  toTicketSystemComment,
  withLatency,
} from "@/services/shared";

export type TicketCreateInput = {
  customer_id: string;
  title: string;
  description?: string;
  category: Ticket["category"];
  priority: Ticket["priority"];
  channel: Ticket["channel"];
  assigned_to?: string;
  status?: Ticket["status"];
};

export type TicketUpdateInput = Partial<{
  title: string;
  description: string;
  category: Ticket["category"];
  priority: Ticket["priority"];
  channel: Ticket["channel"];
  assigned_to: string;
  status: Ticket["status"];
  resolved_at: string | null;
}>;

async function fetchTicketRow(id: string) {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export const ticketService = {
  getList(filters: TicketFilters = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = supabase
          .from("support_tickets")
          .select("*")
          .order("created_at", { ascending: false });

        if (filters.priority && filters.priority !== "all") {
          query = query.eq("priority", filters.priority);
        }

        if (filters.assignedTo && filters.assignedTo !== "all") {
          query = query.eq("assigned_to", filters.assignedTo);
        }

        if (filters.category && filters.category !== "all") {
          query = query.eq("category", filters.category);
        }

        if (filters.status && filters.status !== "all") {
          query = query.eq("status", filters.status);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return ((data ?? []) as TicketRow[]).map(toTicket);
      })(),
    );
  },

  getById(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const row = await fetchTicketRow(id);
        return toTicket(row);
      })(),
    );
  },

  create(payload: TicketCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("support_tickets")
          .insert({
            customer_id: payload.customer_id,
            title: payload.title,
            description: payload.description || null,
            category: payload.category,
            priority: payload.priority,
            channel: payload.channel,
            assigned_to: payload.assigned_to || currentUserId,
            status: payload.status ?? "open",
            due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "create",
          entityType: "ticket",
          entityId: data.id,
          newData: {
            message: `Tạo ticket ${data.ticket_code ?? payload.title}`,
            title: payload.title,
            status: payload.status ?? "open",
          },
          userId: currentUserId,
        });

        if (data.assigned_to) {
          await notificationService.createUnique({
            user_id: data.assigned_to,
            title: `Ticket mới: ${data.title}`,
            message: `Bạn vừa được giao ${data.ticket_code ?? payload.title}.`,
            type: "info",
            entity_type: "ticket",
            entity_id: data.id,
          });
        }

        return toTicket(data);
      })(),
    );
  },

  update(id: string, payload: TicketUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        if (payload.status) {
          return ticketService.updateStatus(id, payload.status);
        }

        const previous = await fetchTicketRow(id);
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("support_tickets")
          .update({
            ...payload,
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
          entityType: "ticket",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: {
            message: `Cập nhật ticket ${data.ticket_code ?? data.title}`,
            ...payload,
          },
          userId: currentUserId,
        });

        return toTicket(data);
      })(),
    );
  },

  async updateStatus(id: string, status: Ticket["status"]) {
    ensureSupabaseConfigured();
    const previous = await fetchTicketRow(id);
    const currentUserId = await getCurrentProfileId();
    const resolvedAt =
      status === "resolved" || status === "closed"
        ? previous.resolved_at ?? new Date().toISOString()
        : null;

    const { data, error } = await supabase
      .from("support_tickets")
      .update({
        status,
        resolved_at: resolvedAt,
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
      entityType: "ticket_status",
      entityId: id,
      oldData: {
        ticket_id: id,
        from_status: previous.status,
      },
      newData: {
        ticket_id: id,
        from_status: previous.status,
        to_status: status,
        message: `Trạng thái đổi từ ${previous.status} sang ${status}`,
      },
      userId: currentUserId,
    });

    if (data.assigned_to) {
      await notificationService.createUnique({
        user_id: data.assigned_to,
        title: `Ticket cập nhật: ${data.title}`,
        message: `Trạng thái đã đổi sang ${status}.`,
        type: status === "resolved" || status === "closed" ? "success" : "info",
        entity_type: "ticket",
        entity_id: id,
      });
    }

    return toTicket(data);
  },

  addComment(ticketId: string, content: string, isInternal = false) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        if (!currentUserId) {
          throw new Error("Không tìm thấy người dùng hiện tại để ghi nhận bình luận.");
        }

        const { data, error } = await supabase
          .from("ticket_comments")
          .insert({
            ticket_id: ticketId,
            author_id: currentUserId,
            content,
            is_internal: isInternal,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "create",
          entityType: "ticket_comment",
          entityId: ticketId,
          newData: {
            message: isInternal ? "Thêm ghi chú nội bộ cho ticket" : "Thêm phản hồi ticket",
          },
          userId: currentUserId,
        });

        return toTicketComment(data);
      })(),
    );
  },

  getComments() {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const [{ data: comments, error: commentsError }, { data: audits, error: auditsError }] =
          await Promise.all([
            supabase
              .from("ticket_comments")
              .select("*")
              .order("created_at", { ascending: true }),
            supabase
              .from("audit_logs")
              .select("*")
              .eq("entity_type", "ticket_status")
              .order("created_at", { ascending: true }),
          ]);

        if (commentsError) {
          throw commentsError;
        }

        if (auditsError) {
          throw auditsError;
        }

        const commentItems = ((comments ?? []) as TicketCommentRow[]).map(toTicketComment);
        const systemItems = ((audits ?? []) as AuditLogRow[])
          .map(toTicketSystemComment)
          .filter((item): item is TicketComment => Boolean(item));

        return [...commentItems, ...systemItems].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
      })(),
    );
  },
};
