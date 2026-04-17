export type UserRole =
  | "super_admin"
  | "admin"
  | "sales"
  | "cskh"
  | "marketing"
  | "director";

export type CustomerType =
  | "new"
  | "potential"
  | "loyal"
  | "vip"
  | "inactive";

export type CustomerSource =
  | "direct"
  | "marketing"
  | "referral"
  | "pos"
  | "online"
  | "other";

export type PaymentMethod = "cash" | "card" | "transfer" | "qr" | "other";
export type PaymentStatus =
  | "paid"
  | "pending"
  | "partial"
  | "refunded"
  | "cancelled";
export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded";

export type TicketCategory =
  | "complaint"
  | "feedback"
  | "inquiry"
  | "return"
  | "other";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketChannel =
  | "phone"
  | "email"
  | "direct"
  | "chat"
  | "social"
  | "other";
export type TicketStatus =
  | "open"
  | "in_progress"
  | "pending"
  | "resolved"
  | "closed";

export type CampaignChannel = "email" | "sms" | "both";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "sent_with_errors"
  | "cancelled";

export type DealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type TaskStatus = "todo" | "in_progress" | "done" | "overdue";
export type TaskPriority = "low" | "medium" | "high";
export type TaskEntityType = "customer" | "ticket" | "transaction" | "deal";

export type NotificationType = "info" | "success" | "warning" | "error";
export type NotificationEntityType =
  | "ticket"
  | "customer"
  | "campaign"
  | "transaction"
  | "task"
  | "deal"
  | "automation"
  | "system";

export type OutboundMessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "failed";

export type PosSyncStatus =
  | "active"
  | "received"
  | "processing"
  | "success"
  | "failed"
  | "error"
  | "duplicate";

export type EmailProviderType = "resend" | null;
export type SmsProviderType = "twilio" | null;

export type AuditAction = "create" | "update" | "delete";

export interface User {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department: string;
  is_active: boolean;
  avatar_url: string | null;
  has_profile?: boolean;
}

export interface Customer {
  id: string;
  customer_code: string;
  full_name: string;
  gender?: string | null;
  phone: string;
  email: string;
  address: string;
  province: string;
  customer_type: CustomerType;
  assigned_to: string;
  total_spent: number;
  total_orders: number;
  last_order_at: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  source: CustomerSource;
  tags: string[];
  notes: string;
}

export interface TransactionItem {
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface Transaction {
  id: string;
  customer_id: string;
  invoice_code: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  discount_rate?: number;
  tax_rate?: number;
  tax_amount?: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: TransactionStatus;
  created_at: string;
  notes?: string;
}

export interface Ticket {
  id: string;
  ticket_code: string;
  customer_id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  channel: TicketChannel;
  assigned_to: string;
  status: TicketStatus;
  created_at: string;
  updated_at?: string;
  resolved_at: string | null;
  due_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  subject: string;
  content: string;
  status: CampaignStatus;
  recipient_count: number;
  sent_count: number;
  opened_count: number;
  click_count?: number;
  failed_count?: number;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  description?: string;
  customer_types?: CustomerType[];
  click_rate?: number;
  open_rate?: number;
}

export interface Deal {
  id: string;
  title: string;
  customer_id: string;
  owner_id: string;
  stage: DealStage;
  value: number;
  probability: number;
  expected_close_at: string | null;
  description: string;
  created_at: string;
  updated_at?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  entity_type: TaskEntityType;
  entity_id: string;
  assigned_to: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  entity_type: NotificationEntityType;
  entity_id: string;
  is_read: boolean;
  created_at: string;
}

export interface OutboundMessage {
  id: string;
  campaign_id: string | null;
  automation_rule_id: string | null;
  customer_id: string | null;
  channel: Exclude<CampaignChannel, "both">;
  provider: string;
  recipient: string;
  subject: string;
  content: string;
  status: OutboundMessageStatus;
  error_message: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface DashboardRevenuePoint {
  period: string;
  revenue: number;
  orders: number;
}

export interface DashboardDistributionPoint {
  type: string;
  count: number;
  color: string;
}

export interface DashboardCustomerSummary {
  id: string;
  full_name: string;
  customer_code: string;
  customer_type: CustomerType;
  total_spent: number;
}

export interface DashboardTicketSummary {
  id: string;
  title: string;
  priority: TicketPriority;
  customer_id: string;
  customer_name: string;
  created_at: string;
}

export interface DashboardStats {
  total_customers: number;
  new_customers_month: number;
  total_revenue_month: number;
  total_orders_month: number;
  open_tickets: number;
  resolved_tickets_month: number;
  revenue_chart: DashboardRevenuePoint[];
  customer_type_distribution: DashboardDistributionPoint[];
  top_customers: DashboardCustomerSummary[];
  urgent_tickets: DashboardTicketSummary[];
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  trigger_type: "birthday" | "inactive_days" | "after_purchase" | "new_customer";
  trigger_days: number | null;
  action: string;
  action_summary: string;
  action_type: "send_email" | "send_sms";
  channel: Exclude<CampaignChannel, "both">;
  content: string;
  variables: string[];
  is_active: boolean;
  sent_count: number;
  created_at: string;
  updated_at?: string;
  last_run_at: string | null;
  schedule_enabled: boolean;
  schedule_interval_minutes: number | null;
  schedule_next_run_at: string | null;
  schedule_last_status: "idle" | "success" | "failed";
  schedule_last_error: string | null;
  schedule_retry_count: number;
}

export interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string;
  note_type: "general" | "call" | "meeting" | "internal";
  content: string;
  created_at: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  type: "comment" | "internal" | "system";
  system_label?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string;
  before: unknown | null;
  after: unknown | null;
  created_at: string;
  message: string;
}

export interface PosSyncLog {
  id: string;
  source: string;
  event_id: string;
  event_type: string;
  order_external_id: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: "received" | "processing" | "success" | "failed" | "duplicate";
  error_message: string | null;
  customer_id: string | null;
  transaction_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationSetting {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface AppSettings {
  company_name: string;
  logo_url: string | null;
  plan: "Free";
  notification_settings: NotificationSetting[];
  integrations: {
    pos_webhook_url: string;
    last_sync: string;
    pos_status: PosSyncStatus;
    email_provider: {
      provider: EmailProviderType;
      enabled: boolean;
      from_name: string;
      from_email: string;
      reply_to: string;
    };
    sms_provider: {
      provider: SmsProviderType;
      enabled: boolean;
      sender_id: string;
      from_number: string;
    };
  };
}

export interface DemoDatabase {
  users: User[];
  customers: Customer[];
  transactions: Transaction[];
  tickets: Ticket[];
  deals: Deal[];
  tasks: Task[];
  campaigns: Campaign[];
  outboundMessages: OutboundMessage[];
  notifications: AppNotification[];
  automationRules: AutomationRule[];
  customerNotes: CustomerNote[];
  ticketComments: TicketComment[];
  auditLogs: AuditLogEntry[];
  dashboardStats: DashboardStats;
  settings: AppSettings;
}
