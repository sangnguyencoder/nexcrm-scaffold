import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { formatTicketStatus, getDefaultLogoUrl } from "@/lib/utils";
import type {
  AppNotification,
  AppSettings,
  AuditAction,
  AuditLogEntry,
  AutomationRule,
  Campaign,
  CampaignChannel,
  CampaignStatus,
  Customer,
  CustomerNote,
  CustomerSource,
  CustomerType,
  DashboardDistributionPoint,
  DashboardRevenuePoint,
  Deal,
  DealStage,
  OutboundMessage,
  OutboundMessageStatus,
  Ticket,
  TicketCategory,
  TicketChannel,
  TicketComment,
  TicketPriority,
  TicketStatus,
  Task,
  TaskEntityType,
  TaskPriority,
  TaskStatus,
  Transaction,
  TransactionItem,
  User,
  UserRole,
} from "@/types";

type Nullable<T> = T | null;

export type ProfileRow = {
  id: string;
  full_name: string;
  role: UserRole;
  department: Nullable<string>;
  avatar_url: Nullable<string>;
  is_active: Nullable<boolean>;
  last_login_at: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type CustomerRow = {
  id: string;
  customer_code: Nullable<string>;
  full_name: string;
  phone: Nullable<string>;
  email: Nullable<string>;
  address: Nullable<string>;
  province: Nullable<string>;
  date_of_birth: Nullable<string>;
  gender: Nullable<string>;
  customer_type: Nullable<CustomerType>;
  source: Nullable<CustomerSource>;
  assigned_to: Nullable<string>;
  total_spent: number | string | null;
  total_orders: number | null;
  last_order_at: Nullable<string>;
  is_active: Nullable<boolean>;
  deleted_at: Nullable<string>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type TransactionRow = {
  id: string;
  customer_id: string;
  invoice_code: Nullable<string>;
  items: Nullable<unknown>;
  subtotal: number | string | null;
  discount: number | string | null;
  tax: number | string | null;
  total_amount: number | string | null;
  payment_method: Nullable<string>;
  payment_status: Nullable<string>;
  status: Nullable<string>;
  notes: Nullable<string>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type TicketRow = {
  id: string;
  ticket_code: Nullable<string>;
  customer_id: string;
  title: string;
  description: Nullable<string>;
  category: Nullable<string>;
  priority: Nullable<string>;
  channel: Nullable<string>;
  assigned_to: Nullable<string>;
  status: Nullable<string>;
  first_response_at: Nullable<string>;
  resolved_at: Nullable<string>;
  due_date: Nullable<string>;
  satisfaction_score: Nullable<number>;
  resolution_note: Nullable<string>;
  created_by: Nullable<string>;
  deleted_at: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type TicketCommentRow = {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  is_internal: Nullable<boolean>;
  created_at: string;
};

export type CampaignRow = {
  id: string;
  name: string;
  description: Nullable<string>;
  channel: CampaignChannel;
  subject: Nullable<string>;
  content: string;
  target_segment: Nullable<Record<string, unknown>>;
  recipient_count: Nullable<number>;
  status: Nullable<CampaignStatus>;
  sent_count: Nullable<number>;
  opened_count: Nullable<number>;
  click_count: Nullable<number>;
  failed_count: Nullable<number>;
  scheduled_at: Nullable<string>;
  sent_at: Nullable<string>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: Nullable<string>;
  type: Nullable<AppNotification["type"]>;
  entity_type: Nullable<AppNotification["entity_type"]>;
  entity_id: Nullable<string>;
  is_read: Nullable<boolean>;
  read_at: Nullable<string>;
  created_at: string;
};

export type OutboundMessageRow = {
  id: string;
  campaign_id: Nullable<string>;
  automation_rule_id: Nullable<string>;
  customer_id: Nullable<string>;
  channel: Nullable<"email" | "sms">;
  provider: Nullable<string>;
  recipient: string;
  subject: Nullable<string>;
  content: string;
  status: Nullable<OutboundMessageStatus>;
  error_message: Nullable<string>;
  metadata: Nullable<Record<string, unknown>>;
  opened_at: Nullable<string>;
  clicked_at: Nullable<string>;
  sent_at: Nullable<string>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type DealRow = {
  id: string;
  title: string;
  customer_id: string;
  owner_id: string;
  stage: Nullable<DealStage>;
  value: number | string | null;
  probability: number | null;
  expected_close_at: Nullable<string>;
  description: Nullable<string>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  title: string;
  description: Nullable<string>;
  entity_type: Nullable<TaskEntityType>;
  entity_id: string;
  assigned_to: Nullable<string>;
  status: Nullable<TaskStatus>;
  priority: Nullable<TaskPriority>;
  due_at: Nullable<string>;
  completed_at: Nullable<string>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type AutomationRuleRow = {
  id: string;
  name: string;
  description: Nullable<string>;
  is_active: Nullable<boolean>;
  trigger_type: string;
  trigger_config: Nullable<Record<string, unknown>>;
  action_type: string;
  action_config: Nullable<Record<string, unknown>>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type AuditLogRow = {
  id: string;
  user_id: Nullable<string>;
  action: Nullable<string>;
  entity_type: Nullable<string>;
  entity_id: Nullable<string>;
  old_data: Nullable<Record<string, unknown>>;
  new_data: Nullable<Record<string, unknown>>;
  created_at: string;
};

export type AppSettingsRow = {
  id: string;
  company_name: string;
  logo_url: Nullable<string>;
  plan: Nullable<AppSettings["plan"]>;
  notification_settings: Nullable<unknown>;
  integrations: Nullable<unknown>;
  created_by: Nullable<string>;
  created_at: string;
  updated_at: string;
};

export type CustomerFilters = {
  search?: string;
  customerType?: CustomerType | "all";
  includeInactive?: boolean;
  sortBy?: "full_name" | "total_spent" | "created_at";
  sortDirection?: "asc" | "desc";
};

export type TransactionFilters = {
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  status?: string;
  search?: string;
};

export type TicketFilters = {
  priority?: string;
  assignedTo?: string;
  category?: string;
  status?: string;
};

export type CampaignFilters = {
  status?: CampaignStatus | "all";
};

export type OutboundMessageFilters = {
  campaignId?: string;
  automationRuleId?: string;
  customerId?: string;
};

export type DealFilters = {
  search?: string;
  stage?: DealStage | "all";
  customerId?: string;
  ownerId?: string;
};

export type TaskFilters = {
  entityType?: TaskEntityType;
  entityId?: string;
  assignedTo?: string;
  status?: TaskStatus | "all";
};

const PROFILE_EMAIL_CACHE_KEY = "nexcrm_profile_email_cache";
const SETTINGS_STORAGE_KEY = "nexcrm_settings";

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: "NexCRM Demo",
  logo_url: getDefaultLogoUrl(),
  plan: "Free",
  notification_settings: [
    {
      key: "ticket_new",
      label: "Ticket mới",
      description: "Nhận thông báo khi có ticket mới phát sinh.",
      enabled: true,
    },
    {
      key: "ticket_update",
      label: "Cập nhật ticket",
      description: "Nhận thông báo khi ticket được cập nhật trạng thái.",
      enabled: true,
    },
    {
      key: "customer_new",
      label: "Khách hàng mới",
      description: "Nhận thông báo khi có khách hàng mới trong hệ thống.",
      enabled: true,
    },
    {
      key: "campaign_done",
      label: "Chiến dịch gửi xong",
      description: "Nhận thông báo khi chiến dịch marketing hoàn tất.",
      enabled: true,
    },
    {
      key: "task_due",
      label: "Nhiệm vụ đến hạn",
      description: "Nhận thông báo khi có follow-up mới hoặc quá hạn.",
      enabled: true,
    },
    {
      key: "deal_stage",
      label: "Cập nhật pipeline",
      description: "Nhận thông báo khi cơ hội bán hàng đổi giai đoạn.",
      enabled: true,
    },
  ],
  integrations: {
    pos_webhook_url: "https://demo.nexcrm.vn/webhooks/pos-sync",
    last_sync: "2024-01-21T09:30:00.000Z",
    pos_status: "active",
    email_provider: {
      provider: null,
      enabled: false,
      from_name: "NexCRM",
      from_email: "hello@demo.nexcrm.vn",
      reply_to: "",
    },
    sms_provider: {
      provider: null,
      enabled: false,
      sender_id: "NexCRM",
      from_number: "",
    },
  },
};

export function cloneDefaultSettings(): AppSettings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
}

const customerDistributionColors: Record<CustomerType, string> = {
  vip: "#3b82f6",
  loyal: "#10b981",
  potential: "#f59e0b",
  new: "#8b92a5",
  inactive: "#ef4444",
};

export function ensureSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Thiếu cấu hình Supabase. Hãy thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env.local.",
    );
  }
}

export async function withLatency<T>(promise: Promise<T>, minMs = 500) {
  const [result] = await Promise.all([
    promise,
    new Promise((resolve) => window.setTimeout(resolve, minMs)),
  ]);

  return result;
}

function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getSettingsStorageKey() {
  return SETTINGS_STORAGE_KEY;
}

export function getCachedSettings() {
  return readJsonStorage<AppSettings>(SETTINGS_STORAGE_KEY, cloneDefaultSettings());
}

export function setCachedSettings(value: AppSettings) {
  writeJsonStorage(SETTINGS_STORAGE_KEY, value);
}

export function readProfileEmailCache() {
  return readJsonStorage<Record<string, string>>(PROFILE_EMAIL_CACHE_KEY, {});
}

export function cacheProfileEmail(profileId: string, email: string) {
  if (!profileId || !email) {
    return;
  }

  const current = readProfileEmailCache();
  current[profileId] = email;
  writeJsonStorage(PROFILE_EMAIL_CACHE_KEY, current);
}

export function getCachedProfileEmail(profileId: string, fallback = "") {
  return readProfileEmailCache()[profileId] ?? fallback;
}

export function normalizeNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function normalizeTransactionItems(raw: unknown): TransactionItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item) => {
    const normalized = item as Record<string, unknown>;
    const qty = Number(normalized.qty ?? 0);
    const price = Number(normalized.price ?? 0);
    const total = Number(normalized.total ?? qty * price);

    return {
      name: String(normalized.name ?? "Sản phẩm"),
      qty,
      price,
      total,
    };
  });
}

export function toUser(profile: ProfileRow, email = ""): User {
  return {
    id: profile.id,
    full_name: profile.full_name,
    email: email || getCachedProfileEmail(profile.id, ""),
    role: profile.role,
    department: profile.department ?? "",
    is_active: profile.is_active ?? true,
    avatar_url: profile.avatar_url ?? null,
  };
}

export function toCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    customer_code: row.customer_code ?? `KH-${new Date(row.created_at).getFullYear()}-0000`,
    full_name: row.full_name,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    province: row.province ?? "",
    customer_type: row.customer_type ?? "new",
    assigned_to: row.assigned_to ?? "",
    total_spent: normalizeNumber(row.total_spent),
    total_orders: row.total_orders ?? 0,
    last_order_at: row.last_order_at ?? row.created_at,
    is_active: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
    source: row.source ?? "direct",
    tags: [],
    notes: "",
  };
}

export function toTransaction(row: TransactionRow): Transaction {
  const subtotal = normalizeNumber(row.subtotal);
  const discount = normalizeNumber(row.discount);
  const taxAmount = normalizeNumber(row.tax);
  const taxableAmount = Math.max(subtotal - discount, 0);

  return {
    id: row.id,
    customer_id: row.customer_id,
    invoice_code: row.invoice_code ?? `HD-${new Date(row.created_at).getFullYear()}-0000`,
    items: normalizeTransactionItems(row.items),
    subtotal,
    discount,
    discount_rate: subtotal ? Math.round((discount / subtotal) * 10000) / 100 : 0,
    tax_rate: taxableAmount ? Math.round((taxAmount / taxableAmount) * 10000) / 100 : 0,
    tax_amount: taxAmount,
    total_amount: normalizeNumber(row.total_amount),
    payment_method:
      (row.payment_method as Transaction["payment_method"] | null) ?? "transfer",
    payment_status:
      (row.payment_status as Transaction["payment_status"] | null) ?? "paid",
    status: (row.status as Transaction["status"] | null) ?? "completed",
    created_at: row.created_at,
    notes: row.notes ?? "",
  };
}

export function toTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    ticket_code: row.ticket_code ?? `TK-${new Date(row.created_at).getFullYear()}-0000`,
    customer_id: row.customer_id,
    title: row.title,
    description: row.description ?? "",
    category: (row.category as TicketCategory | null) ?? "inquiry",
    priority: (row.priority as TicketPriority | null) ?? "medium",
    channel: (row.channel as TicketChannel | null) ?? "email",
    assigned_to: row.assigned_to ?? "",
    status: (row.status as TicketStatus | null) ?? "open",
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at,
    due_at:
      row.due_date ??
      new Date(new Date(row.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function toCampaign(row: CampaignRow): Campaign {
  const targetSegment = (row.target_segment ?? {}) as { customer_types?: CustomerType[] };
  const recipientCount = row.recipient_count ?? 0;
  const clickCount = row.click_count ?? 0;
  const openedCount = row.opened_count ?? 0;

  return {
    id: row.id,
    name: row.name,
    channel: row.channel,
    subject: row.subject ?? "",
    content: row.content,
    status: row.status ?? "draft",
    recipient_count: recipientCount,
    sent_count: row.sent_count ?? 0,
    opened_count: openedCount,
    click_count: clickCount,
    failed_count: row.failed_count ?? 0,
    scheduled_at: row.scheduled_at,
    sent_at: row.sent_at,
    created_at: row.created_at,
    description: row.description ?? "",
    customer_types: targetSegment.customer_types ?? [],
    click_rate: recipientCount ? Math.round((clickCount / recipientCount) * 100) : 0,
    open_rate: recipientCount ? Math.round((openedCount / recipientCount) * 100) : 0,
  };
}

export function toAppSettings(row: AppSettingsRow): AppSettings {
  const notificationSettings = Array.isArray(row.notification_settings)
    ? row.notification_settings
    : cloneDefaultSettings().notification_settings;
  const integrations =
    row.integrations && typeof row.integrations === "object"
      ? row.integrations
      : cloneDefaultSettings().integrations;

  return {
    company_name: row.company_name,
    logo_url: row.logo_url ?? null,
    plan: row.plan ?? "Free",
    notification_settings: notificationSettings as AppSettings["notification_settings"],
    integrations: {
      ...cloneDefaultSettings().integrations,
      ...(integrations as AppSettings["integrations"]),
    },
  };
}

export function toNotification(row: NotificationRow): AppNotification {
  return {
    id: row.id,
    title: row.title,
    message: row.message ?? "",
    type: row.type ?? "info",
    entity_type: row.entity_type ?? "system",
    entity_id: row.entity_id ?? "",
    is_read: row.is_read ?? false,
    created_at: row.created_at,
  };
}

export function toOutboundMessage(row: OutboundMessageRow): OutboundMessage {
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    automation_rule_id: row.automation_rule_id,
    customer_id: row.customer_id,
    channel: row.channel ?? "email",
    provider: row.provider ?? "simulation",
    recipient: row.recipient,
    subject: row.subject ?? "",
    content: row.content,
    status: row.status ?? "queued",
    error_message: row.error_message,
    opened_at: row.opened_at,
    clicked_at: row.clicked_at,
    sent_at: row.sent_at,
    created_at: row.created_at,
  };
}

export function toDeal(row: DealRow): Deal {
  return {
    id: row.id,
    title: row.title,
    customer_id: row.customer_id,
    owner_id: row.owner_id,
    stage: row.stage ?? "lead",
    value: normalizeNumber(row.value),
    probability: row.probability ?? 0,
    expected_close_at: row.expected_close_at,
    description: row.description ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    entity_type: row.entity_type ?? "customer",
    entity_id: row.entity_id,
    assigned_to: row.assigned_to ?? "",
    status: row.status ?? "todo",
    priority: row.priority ?? "medium",
    due_at: row.due_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function describeTrigger(triggerType: string, config?: Record<string, unknown> | null) {
  if (triggerType === "birthday") {
    return "Vào ngày sinh nhật của khách hàng";
  }
  if (triggerType === "inactive_days") {
    return `Không mua hàng trong ${String(config?.days ?? 30)} ngày`;
  }
  if (triggerType === "after_purchase") {
    return `Sau khi mua hàng ${String(config?.days ?? 7)} ngày`;
  }

  return "Khi có khách hàng mới";
}

function describeAction(actionType: string, config?: Record<string, unknown> | null) {
  if (actionType === "send_sms") {
    return `Gửi SMS ${String(config?.summary ?? "tự động")}`;
  }

  return `Gửi Email ${String(config?.summary ?? "tự động")}`;
}

export function toAutomationRule(row: AutomationRuleRow): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    trigger: describeTrigger(row.trigger_type, row.trigger_config),
    action: describeAction(row.action_type, row.action_config),
    channel: row.action_type === "send_sms" ? "sms" : "email",
    content: String(row.action_config?.content ?? ""),
    is_active: row.is_active ?? true,
    sent_count: Number(row.action_config?.sent_count ?? 0),
    created_at: row.created_at,
  };
}

export function toAuditLog(row: AuditLogRow): AuditLogEntry {
  const action = (row.action as AuditAction | null) ?? "update";
  const entityType = row.entity_type ?? "system";
  const entityId = row.entity_id ?? row.id;
  const nextData = row.new_data ?? null;
  const previousData = row.old_data ?? null;

  return {
    id: row.id,
    user_id: row.user_id ?? "",
    action,
    entity_type: entityType,
    entity_id: entityId,
    before: previousData,
    after: nextData,
    created_at: row.created_at,
    message:
      typeof nextData?.message === "string"
        ? nextData.message
        : `${action.toUpperCase()} ${entityType} ${entityId}`,
  };
}

export function toCustomerNote(row: AuditLogRow): CustomerNote | null {
  const nextData = row.new_data ?? {};
  const customerId = String(nextData.customer_id ?? row.entity_id ?? "");

  if (!customerId) {
    return null;
  }

  return {
    id: row.id,
    customer_id: customerId,
    author_id: String(nextData.author_id ?? row.user_id ?? ""),
    note_type:
      (nextData.note_type as CustomerNote["note_type"] | undefined) ?? "general",
    content: String(nextData.content ?? ""),
    created_at: String(nextData.created_at ?? row.created_at),
  };
}

export function toTicketComment(row: TicketCommentRow): TicketComment {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    author_id: row.author_id,
    content: row.content,
    created_at: row.created_at,
    type: row.is_internal ? "internal" : "comment",
  };
}

export function toTicketSystemComment(row: AuditLogRow): TicketComment | null {
  if (row.entity_type !== "ticket_status") {
    return null;
  }

  const nextData = row.new_data ?? {};
  const ticketId = String(nextData.ticket_id ?? row.entity_id ?? "");
  const fromStatus = String(nextData.from_status ?? "");
  const toStatus = String(nextData.to_status ?? "");

  if (!ticketId) {
    return null;
  }

  return {
    id: row.id,
    ticket_id: ticketId,
    author_id: row.user_id ?? null,
    content: `Trạng thái đổi từ ${formatTicketStatus(fromStatus)} sang ${formatTicketStatus(toStatus)}`,
    created_at: row.created_at,
    type: "system",
    system_label: `Trạng thái đổi từ ${formatTicketStatus(fromStatus)} sang ${formatTicketStatus(toStatus)}`,
  };
}

export async function getCurrentAuthUser(): Promise<SupabaseAuthUser | null> {
  ensureSupabaseConfigured();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (data.user?.email) {
    cacheProfileEmail(data.user.id, data.user.email);
  }

  return data.user;
}

export async function getCurrentProfileId() {
  const user = await getCurrentAuthUser();
  return user?.id ?? null;
}

export async function createAuditLog({
  action,
  entityType,
  entityId,
  oldData,
  newData,
  userId,
}: {
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  userId?: string | null;
}) {
  ensureSupabaseConfigured();

  const actorId = userId ?? (await getCurrentProfileId());

  const { error } = await supabase.from("audit_logs").insert({
    user_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    old_data: oldData ?? null,
    new_data: newData ?? null,
  });

  if (error) {
    throw error;
  }
}

export function buildCustomerDistribution(customers: Customer[]): DashboardDistributionPoint[] {
  return (["vip", "loyal", "potential", "new", "inactive"] as CustomerType[]).map((type) => ({
    type:
      type === "vip"
        ? "VIP"
        : type === "loyal"
          ? "Thân thiết"
          : type === "potential"
            ? "Tiềm năng"
            : type === "inactive"
              ? "Không hoạt động"
              : "Mới",
    count: customers.filter((customer) => customer.customer_type === type).length,
    color: customerDistributionColors[type],
  }));
}

export function buildRevenueSeries(transactions: Transaction[]): DashboardRevenuePoint[] {
  const grouped = new Map<string, { revenue: number; orders: number }>();

  for (const transaction of transactions) {
    const key = transaction.created_at.slice(0, 10);
    const current = grouped.get(key) ?? { revenue: 0, orders: 0 };
    current.revenue += transaction.total_amount;
    current.orders += 1;
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, value]) => ({
      period,
      revenue: value.revenue,
      orders: value.orders,
    }));
}
