import { supabase } from "@/lib/supabase";
import type { Task } from "@/types";

import { notificationService } from "@/services/notificationService";
import {
  type TaskFilters,
  type TaskRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getCurrentProfileId,
  toTask,
  withLatency,
} from "@/services/shared";

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

async function fetchTaskRow(id: string) {
  const { data, error } = await supabase.from("tasks").select("*").eq("id", id).single();

  if (error) {
    throw error;
  }

  return data as TaskRow;
}

export const taskService = {
  getList(filters: TaskFilters = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });

        if (filters.entityType) {
          query = query.eq("entity_type", filters.entityType);
        }

        if (filters.entityId) {
          query = query.eq("entity_id", filters.entityId);
        }

        if (filters.assignedTo && filters.assignedTo !== "all") {
          query = query.eq("assigned_to", filters.assignedTo);
        }

        if (filters.status && filters.status !== "all") {
          query = query.eq("status", filters.status);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return ((data ?? []) as TaskRow[]).map(toTask).map((task) => {
          if (
            task.status !== "done" &&
            task.due_at &&
            new Date(task.due_at).getTime() < Date.now()
          ) {
            return {
              ...task,
              status: "overdue" as const,
            };
          }

          return task;
        });
      })(),
    );
  },

  create(payload: TaskCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title: payload.title,
            description: payload.description ?? null,
            entity_type: payload.entity_type,
            entity_id: payload.entity_id,
            assigned_to: payload.assigned_to ?? currentUserId,
            status: payload.status ?? "todo",
            priority: payload.priority ?? "medium",
            due_at: payload.due_at ?? null,
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "create",
          entityType: "task",
          entityId: data.id,
          newData: {
            message: `Tạo nhiệm vụ ${payload.title}`,
            entity_type: payload.entity_type,
            entity_id: payload.entity_id,
          },
          userId: currentUserId,
        });

        if (data.assigned_to) {
          await notificationService.createUnique({
            user_id: data.assigned_to,
            title: `Nhiệm vụ mới: ${data.title}`,
            message: payload.description ?? "Bạn vừa được giao một nhiệm vụ follow-up mới.",
            type: "info",
            entity_type: "task",
            entity_id: data.id,
          });
        }

        return toTask(data as TaskRow);
      })(),
    );
  },

  update(id: string, payload: TaskUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchTaskRow(id);
        const currentUserId = await getCurrentProfileId();
        const nextStatus = payload.status ?? previous.status ?? "todo";
        const completedAt =
          nextStatus === "done"
            ? payload.completed_at ?? previous.completed_at ?? new Date().toISOString()
            : payload.completed_at === undefined
              ? previous.completed_at
              : payload.completed_at;
        const { data, error } = await supabase
          .from("tasks")
          .update({
            title: payload.title ?? previous.title,
            description: payload.description ?? previous.description,
            entity_type: payload.entity_type ?? previous.entity_type,
            entity_id: payload.entity_id ?? previous.entity_id,
            assigned_to: payload.assigned_to ?? previous.assigned_to,
            status: nextStatus,
            priority: payload.priority ?? previous.priority,
            due_at: payload.due_at === undefined ? previous.due_at : payload.due_at,
            completed_at: completedAt,
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
          entityType: "task",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: {
            message: `Cập nhật nhiệm vụ ${data.title}`,
            status: data.status,
          },
          userId: currentUserId,
        });

        if (data.assigned_to && data.status === "overdue") {
          await notificationService.createUnique({
            user_id: data.assigned_to,
            title: `Nhiệm vụ quá hạn: ${data.title}`,
            message: "Deadline đã tới hạn, cần cập nhật ngay.",
            type: "warning",
            entity_type: "task",
            entity_id: data.id,
          });
        }

        return toTask(data as TaskRow);
      })(),
    );
  },

  complete(id: string) {
    return taskService.update(id, {
      status: "done",
      completed_at: new Date().toISOString(),
    });
  },

  delete(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchTaskRow(id);
        const currentUserId = await getCurrentProfileId();
        const { error } = await supabase.from("tasks").delete().eq("id", id);

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "delete",
          entityType: "task",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: { message: `Xóa nhiệm vụ ${previous.title}` },
          userId: currentUserId,
        });
      })(),
    );
  },
};
