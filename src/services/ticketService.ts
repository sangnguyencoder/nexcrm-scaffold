import { supabase } from "@/lib/supabase";
import { ticketService as dataLayerTicketService } from "@/services/data-layer";
import type { Ticket, TicketComment } from "@/types";
import { useAuthStore } from "@/store/authStore";

import type { ServiceRequestOptions, TicketFilters } from "@/services/shared";

type DataLayerResult<T> = {
  data: T | null;
  error: { message?: string } | null;
  page?: { nextCursor: string | null; hasMore: boolean };
};

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
  due_at: string | null;
}>;

function unwrap<T>(result: DataLayerResult<T>, fallbackMessage: string): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  if (result.data == null) {
    throw new Error(fallbackMessage);
  }
  return result.data;
}

function requireOrgContext() {
  const state = useAuthStore.getState();
  const orgId = state.orgId;
  const userId = state.profile?.id ?? state.user?.id ?? null;
  if (!orgId) {
    throw new Error("Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại.");
  }
  return { orgId, userId };
}

function mapTicket(row: Record<string, unknown>): Ticket {
  return {
    id: String(row.id ?? ""),
    ticket_code: row.ticket_code ? String(row.ticket_code) : "",
    customer_id: String(row.customer_id ?? ""),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : "",
    category:
      row.category === "complaint" ||
      row.category === "feedback" ||
      row.category === "inquiry" ||
      row.category === "return" ||
      row.category === "other"
        ? row.category
        : "other",
    priority:
      row.priority === "low" ||
      row.priority === "medium" ||
      row.priority === "high" ||
      row.priority === "urgent"
        ? row.priority
        : "medium",
    channel:
      row.channel === "phone" ||
      row.channel === "email" ||
      row.channel === "direct" ||
      row.channel === "chat" ||
      row.channel === "social" ||
      row.channel === "other"
        ? row.channel
        : "direct",
    assigned_to: row.assigned_to ? String(row.assigned_to) : "",
    status:
      row.status === "open" ||
      row.status === "in_progress" ||
      row.status === "pending" ||
      row.status === "resolved" ||
      row.status === "closed"
        ? row.status
        : "open",
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    resolved_at: row.resolved_at ? String(row.resolved_at) : null,
    due_at: row.due_at ? String(row.due_at) : "",
  };
}

function mapTicketComment(row: Record<string, unknown>): TicketComment {
  const isInternal = Boolean(row.is_internal);
  return {
    id: String(row.id ?? ""),
    ticket_id: String(row.ticket_id ?? ""),
    author_id: row.author_id ? String(row.author_id) : null,
    content: String(row.content ?? ""),
    created_at: String(row.created_at ?? ""),
    type: isInternal ? "internal" : "comment",
    system_label: undefined,
  };
}

async function collectTickets(filters: TicketFilters = {}) {
  const rows: Ticket[] = [];
  let cursor: string | null = null;
  const maxIterations = 8;
  const pageLimit = 100;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await dataLayerTicketService.getList({
      customerId: filters.customerId,
      status:
        filters.status &&
        filters.status !== "all" &&
        (filters.status === "open" ||
          filters.status === "in_progress" ||
          filters.status === "pending" ||
          filters.status === "resolved" ||
          filters.status === "closed")
          ? filters.status
          : undefined,
      priority:
        filters.priority &&
        filters.priority !== "all" &&
        (filters.priority === "low" ||
          filters.priority === "medium" ||
          filters.priority === "high" ||
          filters.priority === "urgent")
          ? filters.priority
          : undefined,
      assignedTo: filters.assignedTo && filters.assignedTo !== "all" ? filters.assignedTo : undefined,
      search: filters.search,
      limit: pageLimit,
      cursor,
    });

    const pageRows = unwrap(
      result as DataLayerResult<Array<Record<string, unknown>>>,
      "Không thể tải danh sách ticket.",
    ).map(mapTicket);
    rows.push(...pageRows);
    if (!result.page?.hasMore || !result.page.nextCursor) {
      break;
    }
    cursor = result.page.nextCursor;
  }

  return rows;
}

export const ticketService = {
  async getList(filters: TicketFilters = {}, options: ServiceRequestOptions = {}) {
    void options;
    return collectTickets(filters);
  },

  async getById(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTicketService.getById(id);
    return mapTicket(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không tìm thấy ticket."),
    );
  },

  async create(payload: TicketCreateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTicketService.create({
      customer_id: payload.customer_id,
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
      channel: payload.channel,
      assigned_to: payload.assigned_to || undefined,
      status: payload.status || undefined,
    });

    return mapTicket(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể tạo ticket."),
    );
  },

  async update(id: string, payload: TicketUpdateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTicketService.update(id, {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      priority: payload.priority,
      channel: payload.channel,
      assigned_to: payload.assigned_to || undefined,
      status: payload.status,
      satisfaction_score: undefined,
    });

    const ticket = mapTicket(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể cập nhật ticket."),
    );

    if (payload.due_at !== undefined) {
      const { orgId } = requireOrgContext();
      const { data, error } = await supabase
        .from("support_tickets")
        .update({
          due_at: payload.due_at,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId)
        .eq("id", id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return mapTicket((data ?? {}) as Record<string, unknown>);
    }

    return ticket;
  },

  async updateStatus(
    id: string,
    status: Ticket["status"],
    options: ServiceRequestOptions = {},
  ) {
    void options;
    return ticketService.update(id, { status });
  },

  async addComment(
    ticketId: string,
    content: string,
    isInternal = false,
    options: ServiceRequestOptions = {},
  ) {
    void options;
    const { orgId, userId } = requireOrgContext();
    if (!userId) {
      throw new Error("Không xác định được người dùng hiện tại để thêm comment.");
    }

    const result = await dataLayerTicketService.addComment({
      ticket_id: ticketId,
      content,
      is_internal: isInternal,
    });

    const inserted = unwrap(
      result as DataLayerResult<{
        id: string;
        ticket_id: string;
        content: string;
        is_internal: boolean;
      }>,
      "Không thể thêm bình luận ticket.",
    );

    return {
      id: inserted.id,
      ticket_id: inserted.ticket_id,
      author_id: userId,
      content: inserted.content,
      created_at: new Date().toISOString(),
      type: inserted.is_internal ? "internal" : "comment",
      system_label: undefined,
    } satisfies TicketComment;
  },

  async getComments(ticketId?: string, options: ServiceRequestOptions = {}) {
    void options;
    const { orgId } = requireOrgContext();
    let query = supabase
      .from("ticket_comments")
      .select("id, ticket_id, author_id, content, is_internal, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (ticketId) {
      query = query.eq("ticket_id", ticketId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapTicketComment);
  },
};
