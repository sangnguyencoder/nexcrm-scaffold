import { taskService as dataLayerTaskService } from "@/services/data-layer";
import type { Task } from "@/types";

import type { ServiceRequestOptions, TaskFilters } from "@/services/shared";

type DataLayerResult<T> = {
  data: T | null;
  error: { message?: string } | null;
  page?: { nextCursor: string | null; hasMore: boolean };
};

export type TaskCreateInput = {
  title: string;
  description?: string;
  entity_type: Task["entity_type"];
  entity_id: string;
  assigned_to?: string;
  status?: Task["status"];
  priority?: Task["priority"];
  due_at?: string | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  completed_at?: string | null;
};

function unwrap<T>(result: DataLayerResult<T>, fallbackMessage: string): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  if (result.data == null) {
    throw new Error(fallbackMessage);
  }
  return result.data;
}

function mapStatus(status: string, dueAt: string | null): Task["status"] {
  if (status === "done") {
    return "done";
  }
  if (status === "in_progress") {
    return "in_progress";
  }
  if (dueAt && new Date(dueAt).getTime() < Date.now()) {
    return "overdue";
  }
  return "todo";
}

function toDbStatus(status?: Task["status"]) {
  if (status === "done") return "done" as const;
  if (status === "in_progress") return "in_progress" as const;
  return "pending" as const;
}

function mapPriority(priority: string): Task["priority"] {
  if (priority === "low" || priority === "medium" || priority === "high") {
    return priority;
  }
  return "medium";
}

function mapTask(row: Record<string, unknown>): Task {
  const dealId = row.deal_id ? String(row.deal_id) : null;
  const customerId = row.customer_id ? String(row.customer_id) : null;
  const ticketId = row.ticket_id ? String(row.ticket_id) : null;
  const dueAt = row.due_date ? String(row.due_date) : null;
  const rawStatus = String(row.status ?? "pending");

  let entityType: Task["entity_type"] = "customer";
  let entityId = "";
  if (dealId) {
    entityType = "deal";
    entityId = dealId;
  } else if (ticketId) {
    entityType = "ticket";
    entityId = ticketId;
  } else if (customerId) {
    entityType = "customer";
    entityId = customerId;
  }

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : "",
    entity_type: entityType,
    entity_id: entityId,
    assigned_to: row.assigned_to ? String(row.assigned_to) : "",
    status: mapStatus(rawStatus, dueAt),
    priority: mapPriority(String(row.priority ?? "medium")),
    due_at: dueAt,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function mapEntityToPayload(input: { entity_type?: Task["entity_type"]; entity_id?: string }) {
  if (input.entity_type === "deal") {
    return { deal_id: input.entity_id ?? null, customer_id: null, ticket_id: null };
  }
  if (input.entity_type === "ticket") {
    return { deal_id: null, customer_id: null, ticket_id: input.entity_id ?? null };
  }
  if (input.entity_type === "transaction") {
    return { deal_id: null, customer_id: null, ticket_id: null };
  }
  return { deal_id: null, customer_id: input.entity_id ?? null, ticket_id: null };
}

async function collectTasks(filters: TaskFilters = {}) {
  const rows: Task[] = [];
  let cursor: string | null = null;
  const maxIterations = 8;
  const pageLimit = 100;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await dataLayerTaskService.getList({
      dealId: filters.entityType === "deal" ? filters.entityId : undefined,
      customerId: filters.entityType === "customer" ? filters.entityId : undefined,
      ticketId: filters.entityType === "ticket" ? filters.entityId : undefined,
      assignedTo: filters.assignedTo && filters.assignedTo !== "all" ? filters.assignedTo : undefined,
      status:
        filters.status === "done"
          ? "done"
          : filters.status === "in_progress"
            ? "in_progress"
            : undefined,
      overdueOnly: filters.status === "overdue",
      limit: pageLimit,
      cursor,
    });

    const pageRows = unwrap(
      result as DataLayerResult<Array<Record<string, unknown>>>,
      "Không thể tải danh sách nhiệm vụ.",
    ).map(mapTask);
    rows.push(...pageRows);

    if (!result.page?.hasMore || !result.page.nextCursor) {
      break;
    }
    cursor = result.page.nextCursor;
  }

  return rows.filter((task) => {
    if (!filters.status || filters.status === "all") {
      return true;
    }
    return task.status === filters.status;
  });
}

export const taskService = {
  async getList(filters: TaskFilters = {}, options: ServiceRequestOptions = {}) {
    void options;
    return collectTasks(filters);
  },

  async create(payload: TaskCreateInput, options: ServiceRequestOptions = {}) {
    void options;
    const entityPayload = mapEntityToPayload(payload);
    const result = await dataLayerTaskService.create({
      ...entityPayload,
      title: payload.title,
      description: payload.description || "",
      task_type: payload.entity_type === "deal" ? "follow_up" : "other",
      due_date: payload.due_at || null,
      status: toDbStatus(payload.status),
      priority: payload.priority === "low" || payload.priority === "high" ? payload.priority : "medium",
      assigned_to: payload.assigned_to || undefined,
    });
    return mapTask(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể tạo nhiệm vụ."),
    );
  },

  async update(id: string, payload: TaskUpdateInput, options: ServiceRequestOptions = {}) {
    void options;
    const entityPayload = mapEntityToPayload(payload);
    const result = await dataLayerTaskService.update(id, {
      ...entityPayload,
      title: payload.title,
      description: payload.description,
      due_date: payload.due_at ?? undefined,
      status: payload.status ? toDbStatus(payload.status) : undefined,
      priority: payload.priority,
      assigned_to: payload.assigned_to,
      completed_at: payload.completed_at,
    });
    return mapTask(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể cập nhật nhiệm vụ."),
    );
  },

  async complete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTaskService.complete(id);
    return mapTask(
      unwrap(
        result as DataLayerResult<Record<string, unknown>>,
        "Không thể đánh dấu hoàn thành nhiệm vụ.",
      ),
    );
  },

  async delete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerTaskService.softDelete(id);
    unwrap(result as DataLayerResult<{ id: string; deleted_at: string }>, "Không thể xóa nhiệm vụ.");
  },

  async softDelete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    return taskService.delete(id);
  },
};
