import { z } from "zod";

import { useAuthStore } from "@/store/authStore";
import type { UserRole } from "@/types";
import { supabase } from "@/services/supabase";
import { isMissingRpcFunctionError } from "@/services/shared";
import { encryptAppSettingsSecrets } from "@/utils/secretEncryption";

type ServiceError = {
  message: string;
  code?: string;
  details?: unknown;
};

export type CursorPage = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type ServiceResponse<T> = {
  data: T | null;
  error: ServiceError | null;
  page?: CursorPage;
};

export type ListParams = {
  cursor?: string | null;
  limit?: number;
};

const DEFAULT_LIST_LIMIT = 30;
const MAX_LIST_LIMIT = 200;

const userRoleSchema = z.enum([
  "super_admin",
  "admin",
  "director",
  "sales",
  "cskh",
  "marketing",
]);

const customerTypeSchema = z.enum(["new", "potential", "loyal", "vip", "inactive"]);
const campaignChannelSchema = z.enum(["email", "sms", "both"]);
const campaignStatusSchema = z.enum(["draft", "scheduled", "sending", "sent", "sent_with_errors", "cancelled"]);
const ticketPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const ticketCategorySchema = z.enum(["complaint", "feedback", "inquiry", "return", "other"]);
const ticketStatusSchema = z.enum(["open", "in_progress", "pending", "resolved", "closed"]);
const ticketChannelSchema = z.enum(["phone", "email", "direct", "chat", "social", "other"]);
const paymentMethodSchema = z.enum(["cash", "card", "transfer", "qr", "other"]);
const paymentStatusSchema = z.enum(["pending", "paid", "partial", "refunded", "cancelled"]);
const transactionStatusSchema = z.enum([
  "pending",
  "processing",
  "completed",
  "cancelled",
  "refunded",
]);
const dealStageSchema = z.enum(["lead", "qualified", "proposal", "negotiation", "won", "lost"]);
const taskStatusSchema = z.enum(["pending", "in_progress", "done", "cancelled"]);
const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
const taskTypeSchema = z.enum(["call", "email", "meeting", "follow_up", "demo", "other"]);

const cursorSchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().min(1),
});

const idSchema = z.string().uuid();

const listParamsSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
});

const csvEscape = (input: unknown) => {
  const text = String(input ?? "");
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

function normalizeError(error: unknown): ServiceError {
  if (error && typeof error === "object") {
    const message = "message" in error ? String(error.message ?? "") : "";
    const code = "code" in error ? String(error.code ?? "") : undefined;
    const details = "details" in error ? (error as { details?: unknown }).details : undefined;

    return {
      message: message || "Lỗi dịch vụ không xác định.",
      code,
      details,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: "Lỗi dịch vụ không xác định." };
}

function ok<T>(data: T, page?: CursorPage): ServiceResponse<T> {
  return {
    data,
    error: null,
    page,
  };
}

function fail<T>(error: unknown): ServiceResponse<T> {
  return {
    data: null,
    error: normalizeError(error),
  };
}

function validate<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): { ok: true; data: z.infer<TSchema> } | { ok: false; error: ServiceError } {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }

  return {
    ok: false,
    error: {
      message: parsed.error.issues.map((issue) => issue.message).join(", ") || "Dữ liệu đầu vào không hợp lệ.",
      details: parsed.error.format(),
    },
  };
}

function getOrgContext():
  | { ok: true; orgId: string; userId: string | null; role: UserRole | null }
  | { ok: false; error: ServiceError } {
  const state = useAuthStore.getState();
  if (!state.orgId) {
    return {
      ok: false,
      error: { message: "Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại." },
    };
  }

  return {
    ok: true,
    orgId: state.orgId,
    userId: state.profile?.id ?? state.user?.id ?? null,
    role: state.role ?? null,
  };
}

function encodeBase64(value: string) {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }

  return value;
}

function decodeBase64(value: string) {
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(value);
  }

  return value;
}

function encodeCursor(input: { createdAt: string; id: string }) {
  return encodeBase64(JSON.stringify(input));
}

function decodeCursor(cursor?: string | null) {
  if (!cursor) {
    return null;
  }

  try {
    const raw = decodeBase64(cursor);
    const parsed = JSON.parse(raw);
    const validated = cursorSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }

    return validated.data;
  } catch {
    return null;
  }
}

function getPageInfo<T extends { id?: unknown; created_at?: unknown }>(
  rows: T[],
  limit: number,
): {
  pageRows: T[];
  page: CursorPage;
} {
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const last = pageRows.at(-1);
  const lastId = typeof last?.id === "string" ? last.id : null;
  const lastCreatedAt = typeof last?.created_at === "string" ? last.created_at : null;
  return {
    pageRows,
    page: {
      hasMore,
      nextCursor: hasMore && lastId && lastCreatedAt ? encodeCursor({ createdAt: lastCreatedAt, id: lastId }) : null,
    },
  };
}

function normalizeLimit(input?: number) {
  if (!input || Number.isNaN(input)) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(input)));
}

function mapCustomer(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    customer_code: String(row.customer_code ?? ""),
    full_name: String(row.full_name ?? ""),
    phone: row.phone ? String(row.phone) : "",
    email: row.email ? String(row.email) : "",
    address: row.address ? String(row.address) : "",
    province: row.province ? String(row.province) : "",
    customer_type: customerTypeSchema.catch("new").parse(row.customer_type),
    source: typeof row.source === "string" ? row.source : "direct",
    assigned_to: row.assigned_to ? String(row.assigned_to) : "",
    total_spent: Number(row.total_spent ?? 0),
    total_orders: Number(row.total_orders ?? 0),
    last_order_at: row.last_order_at ? String(row.last_order_at) : null,
    custom_fields:
      row.custom_fields && typeof row.custom_fields === "object"
        ? (row.custom_fields as Record<string, unknown>)
        : {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function mapTransactionItem(value: unknown) {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const qty = Number(raw.qty ?? 0);
  const price = Number(raw.price ?? 0);
  const total = Number(raw.total ?? qty * price);
  return {
    name: String(raw.name ?? ""),
    qty,
    price,
    total,
  };
}

function mapTransaction(row: Record<string, unknown>) {
  const items = Array.isArray(row.items) ? row.items.map(mapTransactionItem) : [];
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    customer_id: String(row.customer_id ?? ""),
    invoice_code: row.invoice_code ? String(row.invoice_code) : null,
    items,
    total_amount: Number(row.total_amount ?? 0),
    payment_method: paymentMethodSchema.catch("other").parse(row.payment_method),
    payment_status: paymentStatusSchema.catch("pending").parse(row.payment_status),
    status: transactionStatusSchema.catch("pending").parse(row.status),
    source: typeof row.source === "string" ? row.source : "manual",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function mapTicket(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    ticket_code: row.ticket_code ? String(row.ticket_code) : null,
    customer_id: String(row.customer_id ?? ""),
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : "",
    category: ticketCategorySchema.catch("other").parse(row.category),
    priority: ticketPrioritySchema.catch("medium").parse(row.priority),
    channel: ticketChannelSchema.catch("email").parse(row.channel),
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    status: ticketStatusSchema.catch("open").parse(row.status),
    satisfaction_score: row.satisfaction_score ? Number(row.satisfaction_score) : null,
    due_at: row.due_at ? String(row.due_at) : "",
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    resolved_at: row.resolved_at ? String(row.resolved_at) : null,
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function mapCampaign(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    name: String(row.name ?? ""),
    channel: campaignChannelSchema.catch("email").parse(row.channel),
    target_segment:
      row.target_segment && typeof row.target_segment === "object"
        ? (row.target_segment as Record<string, unknown>)
        : {},
    status: campaignStatusSchema.catch("draft").parse(row.status),
    sent_count: Number(row.sent_count ?? 0),
    opened_count: Number(row.opened_count ?? 0),
    failed_count: Number(row.failed_count ?? 0),
    recipient_count: Number(row.recipient_count ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    scheduled_at: row.scheduled_at ? String(row.scheduled_at) : null,
    content: row.content ? String(row.content) : "",
    subject: row.subject ? String(row.subject) : "",
  };
}

function mapDeal(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    customer_id: row.customer_id ? String(row.customer_id) : null,
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : "",
    stage: dealStageSchema.catch("lead").parse(row.stage),
    value: Number(row.value ?? 0),
    probability: Number(row.probability ?? 0),
    expected_close_date: row.expected_close_date ? String(row.expected_close_date) : null,
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function mapTask(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    deal_id: row.deal_id ? String(row.deal_id) : null,
    customer_id: row.customer_id ? String(row.customer_id) : null,
    ticket_id: row.ticket_id ? String(row.ticket_id) : null,
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : "",
    task_type: taskTypeSchema.catch("follow_up").parse(row.task_type),
    due_date: row.due_date ? String(row.due_date) : null,
    completed_at: row.completed_at ? String(row.completed_at) : null,
    status: taskStatusSchema.catch("pending").parse(row.status),
    priority: taskPrioritySchema.catch("medium").parse(row.priority),
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    deleted_at: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function mapNotification(row: Record<string, unknown>) {
  return {
    id: String(row.id ?? ""),
    org_id: String(row.org_id ?? ""),
    user_id: String(row.user_id ?? ""),
    title: String(row.title ?? ""),
    message: String(row.message ?? ""),
    type: typeof row.type === "string" ? row.type : "info",
    is_read: Boolean(row.is_read),
    entity_type: typeof row.entity_type === "string" ? row.entity_type : "system",
    entity_id: row.entity_id ? String(row.entity_id) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function applyCursor(query: any, cursor?: string | null) {
  const decoded = decodeCursor(cursor);
  if (!decoded) {
    return query;
  }

  return query.lt("created_at", decoded.createdAt);
}

const customerCreateSchema = z.object({
  full_name: z.string().trim().min(2),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  address: z.string().trim().optional(),
  province: z.string().trim().optional(),
  date_of_birth: z.string().trim().optional(),
  gender: z.string().trim().optional(),
  customer_type: customerTypeSchema.default("new"),
  source: z.string().trim().optional(),
  assigned_to: idSchema.optional(),
  custom_fields: z.record(z.string(), z.unknown()).optional(),
});

const customerUpdateSchema = customerCreateSchema.partial();

const customerListSchema = listParamsSchema.extend({
  search: z.string().trim().optional(),
  customerType: customerTypeSchema.optional(),
  assignedTo: idSchema.optional(),
  includeInactive: z.boolean().optional(),
});

const transactionItemSchema = z.object({
  name: z.string().trim().min(1),
  qty: z.number().nonnegative(),
  price: z.number().nonnegative(),
  total: z.number().nonnegative().optional(),
});

const transactionCreateSchema = z.object({
  customer_id: idSchema,
  invoice_code: z.string().trim().optional(),
  items: z.array(transactionItemSchema).min(1),
  payment_method: paymentMethodSchema,
  payment_status: paymentStatusSchema.optional(),
  status: transactionStatusSchema.optional(),
  source: z.enum(["manual", "pos_sync", "api"]).optional(),
  notes: z.string().trim().optional(),
});

const transactionListSchema = listParamsSchema.extend({
  customerId: idSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  status: transactionStatusSchema.optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

const ticketCreateSchema = z.object({
  customer_id: idSchema,
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  category: ticketCategorySchema.default("other"),
  priority: ticketPrioritySchema.default("medium"),
  channel: ticketChannelSchema.default("email"),
  assigned_to: idSchema.optional(),
  status: ticketStatusSchema.optional(),
});

const ticketUpdateSchema = z.object({
  title: z.string().trim().min(3).optional(),
  description: z.string().trim().optional(),
  category: ticketCategorySchema.optional(),
  priority: ticketPrioritySchema.optional(),
  channel: ticketChannelSchema.optional(),
  assigned_to: idSchema.nullable().optional(),
  status: ticketStatusSchema.optional(),
  satisfaction_score: z.number().int().min(1).max(5).nullable().optional(),
});

const ticketListSchema = listParamsSchema.extend({
  customerId: idSchema.optional(),
  status: ticketStatusSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assignedTo: idSchema.optional(),
  search: z.string().trim().optional(),
});

const campaignCreateSchema = z.object({
  name: z.string().trim().min(3),
  channel: campaignChannelSchema,
  target_segment: z.record(z.string(), z.unknown()).optional(),
  content: z.string().trim().min(1),
  subject: z.string().trim().optional(),
  status: campaignStatusSchema.optional(),
  scheduled_at: z.string().trim().nullable().optional(),
});

const campaignUpdateSchema = campaignCreateSchema.partial();

const campaignListSchema = listParamsSchema.extend({
  status: campaignStatusSchema.optional(),
  channel: campaignChannelSchema.optional(),
  search: z.string().trim().optional(),
});

const automationCreateSchema = z.object({
  name: z.string().trim().min(3),
  description: z.string().trim().optional(),
  trigger_type: z.enum(["birthday", "inactive_days", "after_purchase", "new_customer"]),
  trigger_config: z.record(z.string(), z.unknown()).optional(),
  action_type: z.enum(["send_email", "send_sms"]),
  action_config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

const automationUpdateSchema = automationCreateSchema.partial();

const dealCreateSchema = z.object({
  customer_id: idSchema.nullable().optional(),
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  stage: dealStageSchema.optional(),
  value: z.number().nonnegative().optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expected_close_date: z.string().trim().nullable().optional(),
  assigned_to: idSchema.nullable().optional(),
});

const dealUpdateSchema = dealCreateSchema.partial();

const dealListSchema = listParamsSchema.extend({
  stage: dealStageSchema.optional(),
  assignedTo: idSchema.optional(),
  customerId: idSchema.optional(),
  search: z.string().trim().optional(),
});

const taskCreateSchema = z.object({
  deal_id: idSchema.nullable().optional(),
  customer_id: idSchema.nullable().optional(),
  ticket_id: idSchema.nullable().optional(),
  title: z.string().trim().min(3),
  description: z.string().trim().optional(),
  task_type: taskTypeSchema.default("follow_up"),
  due_date: z.string().trim().nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigned_to: idSchema.nullable().optional(),
});

const taskUpdateSchema = taskCreateSchema.partial().extend({
  completed_at: z.string().trim().nullable().optional(),
});

const taskListSchema = listParamsSchema.extend({
  dealId: idSchema.optional(),
  customerId: idSchema.optional(),
  ticketId: idSchema.optional(),
  status: taskStatusSchema.optional(),
  assignedTo: idSchema.optional(),
  overdueOnly: z.boolean().optional(),
});

const reportRangeSchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});

const revenueChartSchema = reportRangeSchema.extend({
  groupBy: z.enum(["day", "week", "month"]).default("day"),
});

const storageUploadSchema = z.object({
  bucket: z.string().trim().min(1).default("attachments"),
  path: z.string().trim().min(1),
  upsert: z.boolean().optional(),
});

const settingsUpdateSchema = z.object({
  email_provider: z.enum(["resend", "sendgrid", "smtp"]).optional(),
  email_api_key: z.string().optional(),
  email_from_name: z.string().optional(),
  email_from_address: z.string().email().optional(),
  sms_provider: z.enum(["twilio", "esms", "viettel_sms"]).nullable().optional(),
  sms_api_key: z.string().optional(),
  pos_provider: z.enum(["kiotviet", "misa", "haravan", "sapo", "custom"]).nullable().optional(),
  pos_api_endpoint: z.string().url().optional(),
  pos_api_key: z.string().optional(),
  pos_sync_interval: z.number().int().min(5).max(1440).optional(),
  pos_sync_enabled: z.boolean().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  date_format: z.string().optional(),
});

const testEmailSchema = z.object({
  provider: z.enum(["resend", "sendgrid", "smtp"]),
  apiKey: z.string().trim().min(1),
  fromEmail: z.string().email(),
});

const testPosSchema = z.object({
  provider: z.string().trim().min(1),
  endpoint: z.string().url(),
  apiKey: z.string().trim().min(1),
});

export const customerService = {
  async getList(params: z.input<typeof customerListSchema> = {}): Promise<ServiceResponse<ReturnType<typeof mapCustomer>[]>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }

    const parsed = validate(customerListSchema, params);
    if (!parsed.ok) {
      return fail(parsed.error);
    }

    const { orgId } = context;
    const limit = normalizeLimit(parsed.data.limit);
    try {
      let query = supabase.from("customers").select("*").eq("org_id", orgId).is("deleted_at", null);

      if (parsed.data.search) {
        const keyword = parsed.data.search.replaceAll("%", "").trim();
        query = query.or(`full_name.ilike.%${keyword}%,phone.ilike.%${keyword}%,email.ilike.%${keyword}%`);
      }

      if (parsed.data.customerType) {
        query = query.eq("customer_type", parsed.data.customerType);
      }

      if (parsed.data.assignedTo) {
        query = query.eq("assigned_to", parsed.data.assignedTo);
      }

      if (!parsed.data.includeInactive) {
        query = query.neq("customer_type", "inactive");
      }

      query = applyCursor(query, parsed.data.cursor);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (error) {
        return fail(error);
      }

      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapCustomer), page);
    } catch (error) {
      return fail(error);
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReturnType<typeof mapCustomer>>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) {
      return fail(idCheck.error);
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) {
        return fail(error);
      }
      if (!data) {
        return fail({ message: "Customer not found." });
      }

      return ok(mapCustomer(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof customerCreateSchema>): Promise<ServiceResponse<ReturnType<typeof mapCustomer>>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }
    const parsed = validate(customerCreateSchema, payload);
    if (!parsed.ok) {
      return fail(parsed.error);
    }

    try {
      if (parsed.data.phone) {
        const { data: duplicatePhone } = await supabase
          .from("customers")
          .select("id")
          .eq("org_id", context.orgId)
          .eq("phone", parsed.data.phone)
          .is("deleted_at", null)
          .maybeSingle();

        if (duplicatePhone) {
          return fail({
            message: "Số điện thoại đã tồn tại trong tổ chức. Vui lòng kiểm tra hoặc merge hồ sơ.",
            code: "duplicate_phone",
          });
        }
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          org_id: context.orgId,
          full_name: parsed.data.full_name,
          phone: parsed.data.phone ?? null,
          email: parsed.data.email ?? null,
          address: parsed.data.address ?? null,
          province: parsed.data.province ?? null,
          date_of_birth: parsed.data.date_of_birth ?? null,
          gender: parsed.data.gender ?? null,
          customer_type: parsed.data.customer_type,
          source: parsed.data.source ?? "direct",
          assigned_to: parsed.data.assigned_to ?? context.userId,
          custom_fields: parsed.data.custom_fields ?? {},
          created_by: context.userId,
        })
        .select("*")
        .single();

      if (error) {
        return fail(error);
      }

      return ok(mapCustomer(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async update(id: string, payload: z.input<typeof customerUpdateSchema>): Promise<ServiceResponse<ReturnType<typeof mapCustomer>>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) {
      return fail(idCheck.error);
    }
    const parsed = validate(customerUpdateSchema, payload);
    if (!parsed.ok) {
      return fail(parsed.error);
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) {
        return fail(error);
      }
      return ok(mapCustomer(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async softDelete(id: string): Promise<ServiceResponse<{ id: string; deleted_at: string }>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) {
      return fail(idCheck.error);
    }

    const deletedAt = new Date().toISOString();
    try {
      const { data: rpcDeletedAt, error: rpcError } = await supabase.rpc(
        "app_soft_delete_customer",
        { p_customer_id: idCheck.data },
      );

      if (rpcError) {
        if (isMissingRpcFunctionError(rpcError)) {
          return fail({
            message:
              "Hệ thống chưa cập nhật chức năng xóa mềm khách hàng. Vui lòng chạy migration mới nhất rồi thử lại.",
            code: "RPC_MISSING",
            details: rpcError,
          });
        }
        return fail(rpcError);
      }

      return ok({
        id: idCheck.data,
        deleted_at:
          typeof rpcDeletedAt === "string" && rpcDeletedAt.trim()
            ? rpcDeletedAt
            : deletedAt,
      });
    } catch (error) {
      return fail(error);
    }
  },

  async bulkAssign(input: { ids: string[]; assigned_to: string }): Promise<ServiceResponse<{ updated: number }>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }

    const parsed = validate(
      z.object({
        ids: z.array(idSchema).min(1),
        assigned_to: idSchema,
      }),
      input,
    );
    if (!parsed.ok) {
      return fail(parsed.error);
    }

    try {
      const { data, error } = await supabase
        .from("customers")
        .update({
          assigned_to: parsed.data.assigned_to,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .in("id", parsed.data.ids)
        .is("deleted_at", null)
        .select("id");

      if (error) {
        return fail(error);
      }

      return ok({ updated: (data ?? []).length });
    } catch (error) {
      return fail(error);
    }
  },

  async bulkAddTag(input: {
    customerIds: string[];
    tagIds?: string[];
    tagNames?: string[];
  }): Promise<ServiceResponse<{ linked: number; tagIds: string[] }>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }

    const parsed = validate(
      z.object({
        customerIds: z.array(idSchema).min(1),
        tagIds: z.array(idSchema).optional(),
        tagNames: z.array(z.string().trim().min(1)).optional(),
      }),
      input,
    );
    if (!parsed.ok) {
      return fail(parsed.error);
    }

    if (!parsed.data.tagIds?.length && !parsed.data.tagNames?.length) {
      return fail({ message: "tagIds hoặc tagNames là bắt buộc." });
    }

    try {
      const resolvedTagIds = new Set(parsed.data.tagIds ?? []);
      const tagNames = parsed.data.tagNames ?? [];

      if (tagNames.length) {
        const { data: existingTags, error: existingTagsError } = await supabase
          .from("tags")
          .select("id, name")
          .eq("org_id", context.orgId)
          .in("name", tagNames);

        if (existingTagsError) {
          return fail(existingTagsError);
        }

        for (const tag of (existingTags ?? []) as Array<{ id: string; name: string }>) {
          resolvedTagIds.add(tag.id);
        }

        const existingNameSet = new Set(
          ((existingTags ?? []) as Array<{ id: string; name: string }>).map((item) => item.name),
        );
        const missingNames = tagNames.filter((name) => !existingNameSet.has(name));
        if (missingNames.length) {
          const { data: insertedTags, error: insertTagError } = await supabase
            .from("tags")
            .insert(
              missingNames.map((name) => ({
                org_id: context.orgId,
                name,
                created_by: context.userId,
              })),
            )
            .select("id");

          if (insertTagError) {
            return fail(insertTagError);
          }

          for (const tag of (insertedTags ?? []) as Array<{ id: string }>) {
            resolvedTagIds.add(tag.id);
          }
        }
      }

      const relations = parsed.data.customerIds.flatMap((customerId) =>
        [...resolvedTagIds].map((tagId) => ({
          org_id: context.orgId,
          customer_id: customerId,
          tag_id: tagId,
          created_by: context.userId,
        })),
      );

      const { data, error } = await supabase
        .from("customer_tags")
        .upsert(relations, { onConflict: "org_id,customer_id,tag_id", ignoreDuplicates: true })
        .select("customer_id, tag_id");

      if (error) {
        return fail(error);
      }

      return ok({
        linked: (data ?? []).length,
        tagIds: [...resolvedTagIds],
      });
    } catch (error) {
      return fail(error);
    }
  },

  async exportCSV(params: z.input<typeof customerListSchema> = {}): Promise<ServiceResponse<{ fileName: string; blob: Blob; csv: string }>> {
    const rows: Array<ReturnType<typeof mapCustomer>> = [];
    let cursor: string | null = params.cursor ?? null;

    for (let index = 0; index < 20; index += 1) {
      const response = await customerService.getList({
        ...params,
        limit: params.limit ?? 250,
        cursor,
      });

      if (response.error) {
        return fail(response.error);
      }

      const pageRows = response.data ?? [];
      rows.push(...pageRows);
      cursor = response.page?.nextCursor ?? null;

      if (!response.page?.hasMore || !cursor) {
        break;
      }
    }

    const headers = [
      "customer_code",
      "full_name",
      "phone",
      "email",
      "customer_type",
      "source",
      "total_spent",
      "total_orders",
      "created_at",
    ];

    const body = rows
      .map((row) =>
        [
          row.customer_code,
          row.full_name,
          row.phone,
          row.email,
          row.customer_type,
          row.source,
          row.total_spent,
          row.total_orders,
          row.created_at,
        ]
          .map(csvEscape)
          .join(","),
      )
      .join("\n");

    const csv = `${headers.join(",")}\n${body}`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const dateStamp = new Date().toISOString().slice(0, 10);
    return ok({
      fileName: `customers-${dateStamp}.csv`,
      blob,
      csv,
    });
  },
};

export const transactionService = {
  async getList(params: z.input<typeof transactionListSchema> = {}): Promise<ServiceResponse<Array<ReturnType<typeof mapTransaction>>>> {
    const context = getOrgContext();
    if (!context.ok) {
      return fail(context.error);
    }

    const parsed = validate(transactionListSchema, params);
    if (!parsed.ok) {
      return fail(parsed.error);
    }

    const limit = normalizeLimit(parsed.data.limit);

    try {
      let query = supabase.from("transactions").select("*").eq("org_id", context.orgId).is("deleted_at", null);

      if (parsed.data.customerId) {
        query = query.eq("customer_id", parsed.data.customerId);
      }
      if (parsed.data.paymentStatus) {
        query = query.eq("payment_status", parsed.data.paymentStatus);
      }
      if (parsed.data.status) {
        query = query.eq("status", parsed.data.status);
      }
      if (parsed.data.from) {
        query = query.gte("created_at", `${parsed.data.from}T00:00:00`);
      }
      if (parsed.data.to) {
        query = query.lte("created_at", `${parsed.data.to}T23:59:59`);
      }

      query = applyCursor(query, parsed.data.cursor);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (error) {
        return fail(error);
      }

      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapTransaction), page);
    } catch (error) {
      return fail(error);
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReturnType<typeof mapTransaction>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .maybeSingle();

      if (error) return fail(error);
      if (!data) return fail({ message: "Transaction not found." });

      return ok(mapTransaction(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof transactionCreateSchema>): Promise<ServiceResponse<ReturnType<typeof mapTransaction>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(transactionCreateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const items = parsed.data.items.map((item) => ({
        ...item,
        total: item.total ?? item.qty * item.price,
      }));
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

      const { data, error } = await supabase
        .from("transactions")
        .insert({
          org_id: context.orgId,
          customer_id: parsed.data.customer_id,
          invoice_code: parsed.data.invoice_code ?? null,
          items,
          total_amount: totalAmount,
          payment_method: parsed.data.payment_method,
          payment_status: parsed.data.payment_status ?? "paid",
          status: parsed.data.status ?? "completed",
          source: parsed.data.source ?? "manual",
          notes: parsed.data.notes ?? null,
          created_by: context.userId,
        })
        .select("*")
        .single();

      if (error) return fail(error);
      return ok(mapTransaction(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async update(
    id: string,
    payload: Partial<z.infer<typeof transactionCreateSchema>>,
  ): Promise<ServiceResponse<ReturnType<typeof mapTransaction>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const parsed = validate(transactionCreateSchema.partial(), payload);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const nextPayload: Record<string, unknown> = {
        ...parsed.data,
        updated_at: new Date().toISOString(),
      };

      if (parsed.data.items) {
        nextPayload.items = parsed.data.items.map((item) => ({
          ...item,
          total: item.total ?? item.qty * item.price,
        }));
        nextPayload.total_amount = (nextPayload.items as Array<{ total: number }>).reduce(
          (sum, item) => sum + item.total,
          0,
        );
      }

      const { data, error } = await supabase
        .from("transactions")
        .update(nextPayload)
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) return fail(error);
      return ok(mapTransaction(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async softDelete(id: string): Promise<ServiceResponse<{ id: string; deleted_at: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);

    const deletedAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          deleted_at: deletedAt,
          status: "cancelled",
          updated_at: deletedAt,
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null);

      if (error) return fail(error);
      return ok({ id: idCheck.data, deleted_at: deletedAt });
    } catch (error) {
      return fail(error);
    }
  },

  async getByCustomer(customerId: string, params: Omit<z.input<typeof transactionListSchema>, "customerId"> = {}) {
    const idCheck = validate(idSchema, customerId);
    if (!idCheck.ok) return fail<Array<ReturnType<typeof mapTransaction>>>(idCheck.error);
    return transactionService.getList({ ...params, customerId: idCheck.data });
  },

  async getStats(input: { from?: string; to?: string } = {}): Promise<
    ServiceResponse<{
      total_amount: number;
      total_count: number;
      paid_count: number;
      pending_count: number;
      refunded_count: number;
    }>
  > {
    const response = await transactionService.getList({
      from: input.from,
      to: input.to,
      limit: 1000,
    });
    if (response.error) {
      return fail(response.error);
    }
    const rows = response.data ?? [];
    return ok({
      total_amount: rows.reduce((sum, row) => sum + row.total_amount, 0),
      total_count: rows.length,
      paid_count: rows.filter((row) => row.payment_status === "paid").length,
      pending_count: rows.filter((row) => row.payment_status === "pending").length,
      refunded_count: rows.filter((row) => row.payment_status === "refunded").length,
    });
  },
};

export const ticketService = {
  async getList(params: z.input<typeof ticketListSchema> = {}): Promise<ServiceResponse<Array<ReturnType<typeof mapTicket>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(ticketListSchema, params);
    if (!parsed.ok) return fail(parsed.error);
    const limit = normalizeLimit(parsed.data.limit);

    try {
      let query = supabase.from("support_tickets").select("*").eq("org_id", context.orgId).is("deleted_at", null);
      if (parsed.data.customerId) query = query.eq("customer_id", parsed.data.customerId);
      if (parsed.data.status) query = query.eq("status", parsed.data.status);
      if (parsed.data.priority) query = query.eq("priority", parsed.data.priority);
      if (parsed.data.assignedTo) query = query.eq("assigned_to", parsed.data.assignedTo);
      if (parsed.data.search) {
        const keyword = parsed.data.search.replaceAll("%", "").trim();
        query = query.or(`title.ilike.%${keyword}%,ticket_code.ilike.%${keyword}%`);
      }
      query = applyCursor(query, parsed.data.cursor);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (error) return fail(error);
      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapTicket), page);
    } catch (error) {
      return fail(error);
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReturnType<typeof mapTicket>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return fail(error);
      if (!data) return fail({ message: "Ticket not found." });
      return ok(mapTicket(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof ticketCreateSchema>): Promise<ServiceResponse<ReturnType<typeof mapTicket>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(ticketCreateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .insert({
          org_id: context.orgId,
          customer_id: parsed.data.customer_id,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          category: parsed.data.category,
          priority: parsed.data.priority,
          channel: parsed.data.channel,
          status: parsed.data.status ?? "open",
          assigned_to: parsed.data.assigned_to ?? context.userId,
          created_by: context.userId,
        })
        .select("*")
        .single();

      if (error) return fail(error);
      return ok(mapTicket(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async update(id: string, payload: z.input<typeof ticketUpdateSchema>): Promise<ServiceResponse<ReturnType<typeof mapTicket>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const parsed = validate(ticketUpdateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const nextStatus = parsed.data.status;
      const resolvedAt =
        nextStatus === "resolved" || nextStatus === "closed" ? new Date().toISOString() : undefined;

      const { data, error } = await supabase
        .from("support_tickets")
        .update({
          ...parsed.data,
          resolved_at: resolvedAt,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(mapTicket(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async addComment(input: {
    ticket_id: string;
    content: string;
    is_internal?: boolean;
  }): Promise<ServiceResponse<{ id: string; ticket_id: string; content: string; is_internal: boolean }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);

    const parsed = validate(
      z.object({
        ticket_id: idSchema,
        content: z.string().trim().min(1),
        is_internal: z.boolean().optional(),
      }),
      input,
    );
    if (!parsed.ok) return fail(parsed.error);

    try {
      const { data, error } = await supabase
        .from("ticket_comments")
        .insert({
          org_id: context.orgId,
          ticket_id: parsed.data.ticket_id,
          author_id: context.userId,
          content: parsed.data.content,
          is_internal: parsed.data.is_internal ?? false,
        })
        .select("id, ticket_id, content, is_internal")
        .single();

      if (error) return fail(error);
      return ok({
        id: String(data.id),
        ticket_id: String(data.ticket_id),
        content: String(data.content),
        is_internal: Boolean(data.is_internal),
      });
    } catch (error) {
      return fail(error);
    }
  },

  async getByCustomer(customerId: string, params: Omit<z.input<typeof ticketListSchema>, "customerId"> = {}) {
    const idCheck = validate(idSchema, customerId);
    if (!idCheck.ok) return fail<Array<ReturnType<typeof mapTicket>>>(idCheck.error);
    return ticketService.getList({ ...params, customerId: idCheck.data });
  },

  async softDelete(id: string): Promise<ServiceResponse<{ id: string; deleted_at: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const deletedAt = new Date().toISOString();
    try {
      let query = supabase
        .from("support_tickets")
        .update({ deleted_at: deletedAt, updated_at: deletedAt, status: "closed" })
        .eq("id", idCheck.data)
        .is("deleted_at", null);

      if (context.role !== "super_admin") {
        query = query.eq("org_id", context.orgId);
      }

      const { data, error } = await query.select("id, deleted_at").maybeSingle();
      if (error) return fail(error);
      if (!data) {
        return fail({
          code: "NO_ROWS_AFFECTED",
          message: "Không thể xóa ticket. Dữ liệu không tồn tại hoặc bạn không có quyền thao tác.",
        });
      }
      return ok({
        id: String(data.id),
        deleted_at:
          typeof data.deleted_at === "string" && data.deleted_at.trim()
            ? String(data.deleted_at)
            : deletedAt,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export const campaignService = {
  async getList(params: z.input<typeof campaignListSchema> = {}): Promise<ServiceResponse<Array<ReturnType<typeof mapCampaign>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(campaignListSchema, params);
    if (!parsed.ok) return fail(parsed.error);

    const limit = normalizeLimit(parsed.data.limit);
    try {
      let query = supabase.from("campaigns").select("*").eq("org_id", context.orgId).is("deleted_at", null);
      if (parsed.data.status) query = query.eq("status", parsed.data.status);
      if (parsed.data.channel) query = query.eq("channel", parsed.data.channel);
      if (parsed.data.search) {
        const keyword = parsed.data.search.replaceAll("%", "").trim();
        query = query.or(`name.ilike.%${keyword}%,subject.ilike.%${keyword}%`);
      }
      query = applyCursor(query, parsed.data.cursor);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (error) return fail(error);
      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapCampaign), page);
    } catch (error) {
      return fail(error);
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReturnType<typeof mapCampaign>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return fail(error);
      if (!data) return fail({ message: "Campaign not found." });
      return ok(mapCampaign(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof campaignCreateSchema>): Promise<ServiceResponse<ReturnType<typeof mapCampaign>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(campaignCreateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const { data, error } = await supabase
        .from("campaigns")
        .insert({
          org_id: context.orgId,
          name: parsed.data.name,
          channel: parsed.data.channel,
          target_segment: parsed.data.target_segment ?? {},
          content: parsed.data.content,
          subject: parsed.data.subject ?? null,
          status: parsed.data.status ?? "draft",
          scheduled_at: parsed.data.scheduled_at ?? null,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(mapCampaign(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async update(id: string, payload: z.input<typeof campaignUpdateSchema>): Promise<ServiceResponse<ReturnType<typeof mapCampaign>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const parsed = validate(campaignUpdateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();

      if (error) return fail(error);
      return ok(mapCampaign(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async send(id: string): Promise<ServiceResponse<{ id: string; status: string; sent_count: number; failed_count: number }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);

    try {
      const markSending = await supabase
        .from("campaigns")
        .update({
          status: "sending",
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("id, recipient_count")
        .single();

      if (markSending.error) {
        return fail(markSending.error);
      }

      const invoke = await supabase.functions.invoke("send-campaign", {
        body: {
          orgId: context.orgId,
          campaignId: idCheck.data,
        },
      });

      if (invoke.error) {
        await supabase
          .from("campaigns")
          .update({
            status: "draft",
            updated_at: new Date().toISOString(),
          })
          .eq("org_id", context.orgId)
          .eq("id", idCheck.data);
        return fail(invoke.error);
      }

      const sentCount = Number(
        (invoke.data as { sent_count?: unknown } | null)?.sent_count ??
          (markSending.data as { recipient_count?: unknown } | null)?.recipient_count ??
          0,
      );
      const failedCount = Number((invoke.data as { failed_count?: unknown } | null)?.failed_count ?? 0);

      const finalized = await supabase
        .from("campaigns")
        .update({
          status: "sent",
          sent_count: sentCount,
          failed_count: failedCount,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .select("id, status, sent_count, failed_count")
        .single();

      if (finalized.error) {
        return fail(finalized.error);
      }

      return ok({
        id: String(finalized.data.id),
        status: String(finalized.data.status),
        sent_count: Number(finalized.data.sent_count ?? 0),
        failed_count: Number(finalized.data.failed_count ?? 0),
      });
    } catch (error) {
      return fail(error);
    }
  },

  async getStats(): Promise<
    ServiceResponse<{
      total: number;
      draft: number;
      scheduled: number;
      sending: number;
      sent: number;
      cancelled: number;
    }>
  > {
    const response = await campaignService.getList({ limit: 1000 });
    if (response.error) return fail(response.error);

    const rows = response.data ?? [];
    return ok({
      total: rows.length,
      draft: rows.filter((row) => row.status === "draft").length,
      scheduled: rows.filter((row) => row.status === "scheduled").length,
      sending: rows.filter((row) => row.status === "sending").length,
      sent: rows.filter((row) => row.status === "sent").length,
      cancelled: rows.filter((row) => row.status === "cancelled").length,
    });
  },

  async softDelete(id: string): Promise<ServiceResponse<{ id: string; deleted_at: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const deletedAt = new Date().toISOString();
    try {
      let query = supabase
        .from("campaigns")
        .update({ deleted_at: deletedAt, status: "cancelled", updated_at: deletedAt })
        .eq("id", idCheck.data)
        .is("deleted_at", null);

      if (context.role !== "super_admin") {
        query = query.eq("org_id", context.orgId);
      }

      const { data, error } = await query.select("id, deleted_at").maybeSingle();
      if (error) return fail(error);
      if (!data) {
        return fail({
          code: "NO_ROWS_AFFECTED",
          message: "Không thể xóa chiến dịch. Dữ liệu không tồn tại hoặc bạn không có quyền thao tác.",
        });
      }
      return ok({
        id: String(data.id),
        deleted_at:
          typeof data.deleted_at === "string" && data.deleted_at.trim()
            ? String(data.deleted_at)
            : deletedAt,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export const automationService = {
  async getList(params: z.input<typeof listParamsSchema> = {}): Promise<
    ServiceResponse<
      Array<{
        id: string;
        org_id: string;
        name: string;
        description: string | null;
        trigger_type: string;
        trigger_config: Record<string, unknown>;
        action_type: string;
        action_config: Record<string, unknown>;
        is_active: boolean;
        created_at: string;
        updated_at: string;
      }>
    >
  > {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(listParamsSchema, params);
    if (!parsed.ok) return fail(parsed.error);
    const limit = normalizeLimit(parsed.data.limit);

    try {
      let query = supabase.from("automation_rules").select("*").eq("org_id", context.orgId).is("deleted_at", null);
      query = applyCursor(query, parsed.data.cursor);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (error) return fail(error);
      const rows = (data ?? []) as Array<Record<string, unknown>>;
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(
        pageRows.map((row) => ({
          id: String(row.id ?? ""),
          org_id: String(row.org_id ?? ""),
          name: String(row.name ?? ""),
          description: row.description ? String(row.description) : null,
          trigger_type: String(row.trigger_type ?? ""),
          trigger_config:
            row.trigger_config && typeof row.trigger_config === "object"
              ? (row.trigger_config as Record<string, unknown>)
              : {},
          action_type: String(row.action_type ?? ""),
          action_config:
            row.action_config && typeof row.action_config === "object"
              ? (row.action_config as Record<string, unknown>)
              : {},
          is_active: Boolean(row.is_active),
          created_at: String(row.created_at ?? ""),
          updated_at: String(row.updated_at ?? ""),
        })),
        page,
      );
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof automationCreateSchema>) {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(automationCreateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({
          org_id: context.orgId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          trigger_type: parsed.data.trigger_type,
          trigger_config: parsed.data.trigger_config ?? {},
          action_type: parsed.data.action_type,
          action_config: parsed.data.action_config ?? {},
          is_active: parsed.data.is_active ?? true,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(data as Record<string, unknown>);
    } catch (error) {
      return fail(error);
    }
  },

  async update(id: string, payload: z.input<typeof automationUpdateSchema>) {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const parsed = validate(automationUpdateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase
        .from("automation_rules")
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(data as Record<string, unknown>);
    } catch (error) {
      return fail(error);
    }
  },

  async toggle(id: string, isActive?: boolean) {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);

    try {
      const current = await supabase
        .from("automation_rules")
        .select("is_active")
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .maybeSingle();

      if (current.error) return fail(current.error);

      const nextState = typeof isActive === "boolean" ? isActive : !Boolean(current.data?.is_active);
      const { data, error } = await supabase
        .from("automation_rules")
        .update({
          is_active: nextState,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("id, is_active")
        .single();

      if (error) return fail(error);
      return ok({
        id: String(data.id),
        is_active: Boolean(data.is_active),
      });
    } catch (error) {
      return fail(error);
    }
  },

  async manualRun(id: string) {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);

    try {
      const invoke = await supabase.functions.invoke("run-automation", {
        body: {
          orgId: context.orgId,
          ruleId: idCheck.data,
          manual: true,
        },
      });
      if (invoke.error) return fail(invoke.error);
      return ok(
        (invoke.data as { success?: boolean; processed?: number; message?: string } | null) ?? {
          success: true,
          processed: 0,
          message: "Manual run executed.",
        },
      );
    } catch (error) {
      return fail(error);
    }
  },

  async softDelete(id: string) {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const deletedAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from("automation_rules")
        .update({ deleted_at: deletedAt, updated_at: deletedAt, is_active: false })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null);
      if (error) return fail(error);
      return ok({ id: idCheck.data, deleted_at: deletedAt });
    } catch (error) {
      return fail(error);
    }
  },
};

export const dealService = {
  async getList(params: z.input<typeof dealListSchema> = {}): Promise<ServiceResponse<Array<ReturnType<typeof mapDeal>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(dealListSchema, params);
    if (!parsed.ok) return fail(parsed.error);
    const limit = normalizeLimit(parsed.data.limit);
    try {
      let query = supabase.from("deals").select("*").eq("org_id", context.orgId).is("deleted_at", null);
      if (parsed.data.stage) query = query.eq("stage", parsed.data.stage);
      if (parsed.data.assignedTo) query = query.eq("assigned_to", parsed.data.assignedTo);
      if (parsed.data.customerId) query = query.eq("customer_id", parsed.data.customerId);
      if (parsed.data.search) {
        const keyword = parsed.data.search.replaceAll("%", "").trim();
        query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`);
      }
      query = applyCursor(query, parsed.data.cursor);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (error) return fail(error);
      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapDeal), page);
    } catch (error) {
      return fail(error);
    }
  },

  async getById(id: string): Promise<ServiceResponse<ReturnType<typeof mapDeal>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    try {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return fail(error);
      if (!data) return fail({ message: "Deal not found." });
      return ok(mapDeal(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof dealCreateSchema>): Promise<ServiceResponse<ReturnType<typeof mapDeal>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(dealCreateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase
        .from("deals")
        .insert({
          org_id: context.orgId,
          customer_id: parsed.data.customer_id ?? null,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          stage: parsed.data.stage ?? "lead",
          value: parsed.data.value ?? 0,
          probability: parsed.data.probability ?? 0,
          expected_close_date: parsed.data.expected_close_date ?? null,
          assigned_to: parsed.data.assigned_to ?? context.userId,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(mapDeal(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async update(id: string, payload: z.input<typeof dealUpdateSchema>): Promise<ServiceResponse<ReturnType<typeof mapDeal>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const parsed = validate(dealUpdateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase
        .from("deals")
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(mapDeal(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async updateStage(id: string, stage: z.infer<typeof dealStageSchema>) {
    const parsed = validate(dealStageSchema, stage);
    if (!parsed.ok) return fail(parsed.error);
    const probabilityMap: Record<z.infer<typeof dealStageSchema>, number> = {
      lead: 10,
      qualified: 30,
      proposal: 50,
      negotiation: 75,
      won: 100,
      lost: 0,
    };
    return dealService.update(id, { stage: parsed.data, probability: probabilityMap[parsed.data] });
  },

  async getByCustomer(customerId: string, params: Omit<z.input<typeof dealListSchema>, "customerId"> = {}) {
    const idCheck = validate(idSchema, customerId);
    if (!idCheck.ok) return fail<Array<ReturnType<typeof mapDeal>>>(idCheck.error);
    return dealService.getList({ ...params, customerId: idCheck.data });
  },

  async softDelete(id: string): Promise<ServiceResponse<{ id: string; deleted_at: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const deletedAt = new Date().toISOString();
    try {
      let query = supabase
        .from("deals")
        .update({ deleted_at: deletedAt, updated_at: deletedAt, stage: "lost" })
        .eq("id", idCheck.data)
        .is("deleted_at", null);

      if (context.role !== "super_admin") {
        query = query.eq("org_id", context.orgId);
      }

      const { data, error } = await query.select("id, deleted_at").maybeSingle();
      if (error) return fail(error);
      if (!data) {
        return fail({
          code: "NO_ROWS_AFFECTED",
          message: "Không thể xóa cơ hội. Dữ liệu không tồn tại hoặc bạn không có quyền thao tác.",
        });
      }
      return ok({
        id: String(data.id),
        deleted_at:
          typeof data.deleted_at === "string" && data.deleted_at.trim()
            ? String(data.deleted_at)
            : deletedAt,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export const taskService = {
  async getList(params: z.input<typeof taskListSchema> = {}): Promise<ServiceResponse<Array<ReturnType<typeof mapTask>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(taskListSchema, params);
    if (!parsed.ok) return fail(parsed.error);
    const limit = normalizeLimit(parsed.data.limit);

    try {
      let query = supabase.from("tasks").select("*").eq("org_id", context.orgId).is("deleted_at", null);
      if (parsed.data.dealId) query = query.eq("deal_id", parsed.data.dealId);
      if (parsed.data.customerId) query = query.eq("customer_id", parsed.data.customerId);
      if (parsed.data.ticketId) query = query.eq("ticket_id", parsed.data.ticketId);
      if (parsed.data.status) query = query.eq("status", parsed.data.status);
      if (parsed.data.assignedTo) query = query.eq("assigned_to", parsed.data.assignedTo);
      if (parsed.data.overdueOnly) {
        query = query.lt("due_date", new Date().toISOString()).neq("status", "done").neq("status", "cancelled");
      }
      query = applyCursor(query, parsed.data.cursor);

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (error) return fail(error);

      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapTask), page);
    } catch (error) {
      return fail(error);
    }
  },

  async create(payload: z.input<typeof taskCreateSchema>): Promise<ServiceResponse<ReturnType<typeof mapTask>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(taskCreateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          org_id: context.orgId,
          deal_id: parsed.data.deal_id ?? null,
          customer_id: parsed.data.customer_id ?? null,
          ticket_id: parsed.data.ticket_id ?? null,
          title: parsed.data.title,
          description: parsed.data.description ?? null,
          task_type: parsed.data.task_type,
          due_date: parsed.data.due_date ?? null,
          status: parsed.data.status ?? "pending",
          priority: parsed.data.priority ?? "medium",
          assigned_to: parsed.data.assigned_to ?? context.userId,
          created_by: context.userId,
        })
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(mapTask(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async update(id: string, payload: z.input<typeof taskUpdateSchema>): Promise<ServiceResponse<ReturnType<typeof mapTask>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const parsed = validate(taskUpdateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const { data, error } = await supabase
        .from("tasks")
        .update({
          ...parsed.data,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("*")
        .single();
      if (error) return fail(error);
      return ok(mapTask(data as Record<string, unknown>));
    } catch (error) {
      return fail(error);
    }
  },

  async complete(id: string) {
    return taskService.update(id, {
      status: "done",
      completed_at: new Date().toISOString(),
    });
  },

  async getOverdue(params: Omit<z.input<typeof taskListSchema>, "overdueOnly"> = {}) {
    return taskService.getList({ ...params, overdueOnly: true });
  },

  async getByDeal(dealId: string, params: Omit<z.input<typeof taskListSchema>, "dealId"> = {}) {
    const idCheck = validate(idSchema, dealId);
    if (!idCheck.ok) return fail<Array<ReturnType<typeof mapTask>>>(idCheck.error);
    return taskService.getList({ ...params, dealId: idCheck.data });
  },

  async softDelete(id: string): Promise<ServiceResponse<{ id: string; deleted_at: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    const deletedAt = new Date().toISOString();
    try {
      let query = supabase
        .from("tasks")
        .update({ deleted_at: deletedAt, updated_at: deletedAt, status: "cancelled" })
        .eq("id", idCheck.data)
        .is("deleted_at", null);

      if (context.role !== "super_admin") {
        query = query.eq("org_id", context.orgId);
      }

      const { data, error } = await query.select("id, deleted_at").maybeSingle();
      if (error) return fail(error);
      if (!data) {
        return fail({
          code: "NO_ROWS_AFFECTED",
          message: "Không thể xóa nhiệm vụ. Dữ liệu không tồn tại hoặc bạn không có quyền thao tác.",
        });
      }
      return ok({
        id: String(data.id),
        deleted_at:
          typeof data.deleted_at === "string" && data.deleted_at.trim()
            ? String(data.deleted_at)
            : deletedAt,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export const reportService = {
  async getDashboardStats(input: z.input<typeof reportRangeSchema>): Promise<ServiceResponse<Record<string, unknown>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(reportRangeSchema, input);
    if (!parsed.ok) return fail(parsed.error);

    try {
      const { data, error } = await supabase.rpc("get_dashboard_stats", {
        p_org_id: context.orgId,
        p_from: parsed.data.from,
        p_to: parsed.data.to,
      });
      if (error) return fail(error);
      return ok((data as Record<string, unknown>) ?? {});
    } catch (error) {
      return fail(error);
    }
  },

  async getRevenueChart(input: z.input<typeof revenueChartSchema>): Promise<ServiceResponse<Array<Record<string, unknown>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(revenueChartSchema, input);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const { data, error } = await supabase.rpc("get_revenue_chart", {
        p_org_id: context.orgId,
        p_from: parsed.data.from,
        p_to: parsed.data.to,
        p_group_by: parsed.data.groupBy,
      });
      if (error) return fail(error);
      return ok((data ?? []) as Array<Record<string, unknown>>);
    } catch (error) {
      return fail(error);
    }
  },

  async getCustomerSegments(): Promise<ServiceResponse<Array<Record<string, unknown>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    try {
      const { data, error } = await supabase.rpc("get_customer_segments", {
        p_org_id: context.orgId,
      });
      if (error) return fail(error);
      return ok((data ?? []) as Array<Record<string, unknown>>);
    } catch (error) {
      return fail(error);
    }
  },

  async getPipelineSummary(): Promise<ServiceResponse<Array<Record<string, unknown>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    try {
      const { data, error } = await supabase.rpc("get_pipeline_summary", {
        p_org_id: context.orgId,
      });
      if (error) return fail(error);
      return ok((data ?? []) as Array<Record<string, unknown>>);
    } catch (error) {
      return fail(error);
    }
  },
};

export const exportService = {
  async exportCustomersCSV(params: z.input<typeof customerListSchema> = {}): Promise<ServiceResponse<{ fileName: string; blob: Blob }>> {
    const response = await customerService.exportCSV(params);
    if (response.error || !response.data) {
      return fail(response.error ?? { message: "Không thể xuất CSV khách hàng." });
    }
    return ok({
      fileName: response.data.fileName,
      blob: response.data.blob,
    });
  },

  async exportTransactionsCSV(params: z.input<typeof transactionListSchema> = {}): Promise<ServiceResponse<{ fileName: string; blob: Blob; csv: string }>> {
    const response = await transactionService.getList({ ...params, limit: params.limit ?? 1000 });
    if (response.error) return fail(response.error);
    const rows = response.data ?? [];
    const headers = [
      "invoice_code",
      "customer_id",
      "total_amount",
      "payment_method",
      "payment_status",
      "status",
      "created_at",
    ];
    const body = rows
      .map((row) =>
        [
          row.invoice_code ?? "",
          row.customer_id,
          row.total_amount,
          row.payment_method,
          row.payment_status,
          row.status,
          row.created_at,
        ]
          .map(csvEscape)
          .join(","),
      )
      .join("\n");
    const csv = `${headers.join(",")}\n${body}`;
    return ok({
      fileName: `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      blob: new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      csv,
    });
  },

  async exportReportExcel(input: {
    from: string;
    to: string;
    groupBy?: "day" | "week" | "month";
    fileName?: string;
  }): Promise<ServiceResponse<{ fileName: string; blob: Blob }>> {
    const parsed = validate(
      z.object({
        from: z.string().trim().min(1),
        to: z.string().trim().min(1),
        groupBy: z.enum(["day", "week", "month"]).optional(),
        fileName: z.string().trim().optional(),
      }),
      input,
    );
    if (!parsed.ok) return fail(parsed.error);

    try {
      const [dashboard, revenue, segments, pipeline] = await Promise.all([
        reportService.getDashboardStats({ from: parsed.data.from, to: parsed.data.to }),
        reportService.getRevenueChart({
          from: parsed.data.from,
          to: parsed.data.to,
          groupBy: parsed.data.groupBy ?? "day",
        }),
        reportService.getCustomerSegments(),
        reportService.getPipelineSummary(),
      ]);

      if (dashboard.error) return fail(dashboard.error);
      if (revenue.error) return fail(revenue.error);
      if (segments.error) return fail(segments.error);
      if (pipeline.error) return fail(pipeline.error);

      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      const dashboardSheet = XLSX.utils.json_to_sheet([dashboard.data ?? {}]);
      const revenueSheet = XLSX.utils.json_to_sheet(revenue.data ?? []);
      const segmentSheet = XLSX.utils.json_to_sheet(segments.data ?? []);
      const pipelineSheet = XLSX.utils.json_to_sheet(pipeline.data ?? []);

      XLSX.utils.book_append_sheet(workbook, dashboardSheet, "Dashboard");
      XLSX.utils.book_append_sheet(workbook, revenueSheet, "Revenue");
      XLSX.utils.book_append_sheet(workbook, segmentSheet, "Segments");
      XLSX.utils.book_append_sheet(workbook, pipelineSheet, "Pipeline");

      const arrayBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      return ok({
        fileName:
          parsed.data.fileName ?? `crm-report-${parsed.data.from}-to-${parsed.data.to}.xlsx`,
        blob,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export const notificationService = {
  async getList(params: {
    userId?: string;
    onlyUnread?: boolean;
    cursor?: string | null;
    limit?: number;
  } = {}): Promise<ServiceResponse<Array<ReturnType<typeof mapNotification>>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);

    const parsed = validate(
      z.object({
        userId: idSchema.optional(),
        onlyUnread: z.boolean().optional(),
        cursor: z.string().nullable().optional(),
        limit: z.number().int().min(1).max(MAX_LIST_LIMIT).optional(),
      }),
      params,
    );
    if (!parsed.ok) return fail(parsed.error);

    const userId = parsed.data.userId ?? context.userId;
    if (!userId) {
      return fail({ message: "Thiếu ngữ cảnh người dùng." });
    }

    const limit = normalizeLimit(parsed.data.limit);

    try {
      let query = supabase
        .from("notifications")
        .select("*")
        .eq("org_id", context.orgId)
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (parsed.data.onlyUnread) {
        query = query.eq("is_read", false);
      }
      query = applyCursor(query, parsed.data.cursor);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);
      if (error) return fail(error);
      const rows = (data ?? []) as Record<string, unknown>[];
      const { pageRows, page } = getPageInfo(rows, limit);
      return ok(pageRows.map(mapNotification), page);
    } catch (error) {
      return fail(error);
    }
  },

  async markRead(id: string): Promise<ServiceResponse<{ id: string; is_read: boolean }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const idCheck = validate(idSchema, id);
    if (!idCheck.ok) return fail(idCheck.error);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("id", idCheck.data)
        .is("deleted_at", null)
        .select("id, is_read")
        .single();
      if (error) return fail(error);
      return ok({
        id: String(data.id),
        is_read: Boolean(data.is_read),
      });
    } catch (error) {
      return fail(error);
    }
  },

  async markAllRead(userId?: string): Promise<ServiceResponse<{ updated: number }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const targetUserId = userId ?? context.userId;
    if (!targetUserId) return fail({ message: "Thiếu ngữ cảnh người dùng." });
    try {
      const { data, error } = await supabase
        .from("notifications")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", context.orgId)
        .eq("user_id", targetUserId)
        .eq("is_read", false)
        .is("deleted_at", null)
        .select("id");
      if (error) return fail(error);
      return ok({ updated: (data ?? []).length });
    } catch (error) {
      return fail(error);
    }
  },

  async getUnreadCount(userId?: string): Promise<ServiceResponse<{ count: number }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const targetUserId = userId ?? context.userId;
    if (!targetUserId) return fail({ message: "Thiếu ngữ cảnh người dùng." });

    try {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("org_id", context.orgId)
        .eq("user_id", targetUserId)
        .eq("is_read", false)
        .is("deleted_at", null);

      if (error) return fail(error);
      return ok({ count: count ?? 0 });
    } catch (error) {
      return fail(error);
    }
  },
};

export const storageService = {
  async upload(input: z.input<typeof storageUploadSchema> & { file: File | Blob }): Promise<
    ServiceResponse<{
      bucket: string;
      fullPath: string;
      path: string;
    }>
  > {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(storageUploadSchema, input);
    if (!parsed.ok) return fail(parsed.error);
    if (!input.file) return fail({ message: "Thiếu tệp tải lên." });

    const normalizedPath = parsed.data.path.replace(/^\/+/, "");
    const fullPath = `${context.orgId}/${normalizedPath}`;
    try {
      const { error } = await supabase.storage
        .from(parsed.data.bucket)
        .upload(fullPath, input.file, { upsert: parsed.data.upsert ?? false });
      if (error) return fail(error);
      return ok({
        bucket: parsed.data.bucket,
        path: normalizedPath,
        fullPath,
      });
    } catch (error) {
      return fail(error);
    }
  },

  async download(input: { bucket: string; path: string }): Promise<ServiceResponse<{ blob: Blob; fullPath: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(
      z.object({
        bucket: z.string().trim().min(1),
        path: z.string().trim().min(1),
      }),
      input,
    );
    if (!parsed.ok) return fail(parsed.error);
    const fullPath = `${context.orgId}/${parsed.data.path.replace(/^\/+/, "")}`;
    try {
      const { data, error } = await supabase.storage.from(parsed.data.bucket).download(fullPath);
      if (error) return fail(error);
      if (!data) return fail({ message: "Không tìm thấy tệp." });
      return ok({
        blob: data,
        fullPath,
      });
    } catch (error) {
      return fail(error);
    }
  },

  async delete(input: { bucket: string; path: string }): Promise<ServiceResponse<{ deleted: string[] }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(
      z.object({
        bucket: z.string().trim().min(1),
        path: z.string().trim().min(1),
      }),
      input,
    );
    if (!parsed.ok) return fail(parsed.error);
    const fullPath = `${context.orgId}/${parsed.data.path.replace(/^\/+/, "")}`;
    try {
      const { data, error } = await supabase.storage.from(parsed.data.bucket).remove([fullPath]);
      if (error) return fail(error);
      return ok({
        deleted: ((data ?? []) as Array<{ name: string }>).map((item) => item.name),
      });
    } catch (error) {
      return fail(error);
    }
  },

  async getPublicUrl(input: { bucket: string; path: string }): Promise<ServiceResponse<{ url: string; fullPath: string }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(
      z.object({
        bucket: z.string().trim().min(1),
        path: z.string().trim().min(1),
      }),
      input,
    );
    if (!parsed.ok) return fail(parsed.error);
    const fullPath = `${context.orgId}/${parsed.data.path.replace(/^\/+/, "")}`;
    try {
      const { data } = supabase.storage.from(parsed.data.bucket).getPublicUrl(fullPath);
      return ok({
        fullPath,
        url: data.publicUrl,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export const settingsService = {
  async get(): Promise<ServiceResponse<Record<string, unknown>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    try {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("org_id", context.orgId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return fail(error);
      return ok((data as Record<string, unknown>) ?? {});
    } catch (error) {
      return fail(error);
    }
  },

  async update(payload: z.input<typeof settingsUpdateSchema>): Promise<ServiceResponse<Record<string, unknown>>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(settingsUpdateSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const encryptedPayload = await encryptAppSettingsSecrets(parsed.data);
      const { data, error } = await supabase
        .from("app_settings")
        .upsert(
          {
            org_id: context.orgId,
            ...encryptedPayload,
            updated_by: context.userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "org_id" },
        )
        .select("*")
        .single();
      if (error) return fail(error);
      return ok((data as Record<string, unknown>) ?? {});
    } catch (error) {
      return fail(error);
    }
  },

  async testEmailConnection(payload: z.input<typeof testEmailSchema>): Promise<ServiceResponse<{ success: boolean; message: string; details?: unknown }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(testEmailSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const invoke = await supabase.functions.invoke("test-email-connection", {
        body: {
          orgId: context.orgId,
          provider: parsed.data.provider,
          apiKey: parsed.data.apiKey,
          fromEmail: parsed.data.fromEmail,
        },
      });

      if (invoke.error) {
        return ok({
          success: false,
          message: "Kiểm tra kết nối Email thất bại.",
          details: invoke.error,
        });
      }

      return ok({
        success: true,
        message: "Kết nối Email thành công.",
        details: invoke.data,
      });
    } catch (error) {
      return fail(error);
    }
  },

  async testPOSConnection(payload: z.input<typeof testPosSchema>): Promise<ServiceResponse<{ success: boolean; message: string; details?: unknown }>> {
    const context = getOrgContext();
    if (!context.ok) return fail(context.error);
    const parsed = validate(testPosSchema, payload);
    if (!parsed.ok) return fail(parsed.error);
    try {
      const invoke = await supabase.functions.invoke("test-pos-connection", {
        body: {
          orgId: context.orgId,
          provider: parsed.data.provider,
          endpoint: parsed.data.endpoint,
          apiKey: parsed.data.apiKey,
        },
      });

      if (invoke.error) {
        return ok({
          success: false,
          message: "Kiểm tra kết nối POS thất bại.",
          details: invoke.error,
        });
      }

      return ok({
        success: true,
        message: "Kết nối POS thành công.",
        details: invoke.data,
      });
    } catch (error) {
      return fail(error);
    }
  },
};

export type DataLayerServices = {
  customerService: typeof customerService;
  transactionService: typeof transactionService;
  ticketService: typeof ticketService;
  campaignService: typeof campaignService;
  automationService: typeof automationService;
  dealService: typeof dealService;
  taskService: typeof taskService;
  reportService: typeof reportService;
  exportService: typeof exportService;
  notificationService: typeof notificationService;
  storageService: typeof storageService;
  settingsService: typeof settingsService;
};
