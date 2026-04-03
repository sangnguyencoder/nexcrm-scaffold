import {
  MOCK_AUDIT_LOGS,
  MOCK_AUTOMATION_RULES,
  MOCK_CAMPAIGNS,
  MOCK_CUSTOMERS,
  MOCK_CUSTOMER_NOTES,
  MOCK_DASHBOARD_STATS,
  MOCK_NOTIFICATIONS,
  MOCK_SETTINGS,
  MOCK_TICKETS,
  MOCK_TICKET_COMMENTS,
  MOCK_TRANSACTIONS,
  MOCK_USERS,
} from "@/lib/mock-data";
import { uniqueId } from "@/lib/utils";
import type {
  AppNotification,
  AppSettings,
  AuditLogEntry,
  AutomationRule,
  Campaign,
  Customer,
  CustomerNote,
  Deal,
  DemoDatabase,
  OutboundMessage,
  Task,
  Ticket,
  TicketComment,
  Transaction,
  User,
} from "@/types";

const STORAGE_KEY = "nexcrm_demo_db";
const DELAY_MS = 500;

const defaultDb: DemoDatabase = {
  users: MOCK_USERS,
  customers: MOCK_CUSTOMERS,
  transactions: MOCK_TRANSACTIONS,
  tickets: MOCK_TICKETS,
  deals: [] as Deal[],
  tasks: [] as Task[],
  campaigns: MOCK_CAMPAIGNS,
  outboundMessages: [] as OutboundMessage[],
  notifications: MOCK_NOTIFICATIONS,
  automationRules: MOCK_AUTOMATION_RULES,
  customerNotes: MOCK_CUSTOMER_NOTES,
  ticketComments: MOCK_TICKET_COMMENTS,
  auditLogs: MOCK_AUDIT_LOGS,
  dashboardStats: MOCK_DASHBOARD_STATS,
  settings: MOCK_SETTINGS,
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function delay<T>(value: T) {
  return new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(clone(value)), DELAY_MS);
  });
}

function getDb(): DemoDatabase {
  if (typeof window === "undefined") {
    return clone(defaultDb);
  }

  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const seeded = clone(defaultDb);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  }

  return JSON.parse(raw) as DemoDatabase;
}

function setDb(db: DemoDatabase) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function updateDb<T>(mutate: (db: DemoDatabase) => T): T {
  const db = getDb();
  const result = mutate(db);
  setDb(db);
  return result;
}

function addAudit(
  db: DemoDatabase,
  audit: Omit<AuditLogEntry, "id" | "created_at">,
  notification?: Omit<AppNotification, "id" | "created_at" | "is_read">,
) {
  db.auditLogs.unshift({
    id: uniqueId("audit"),
    created_at: new Date().toISOString(),
    ...audit,
  });

  if (notification) {
    db.notifications.unshift({
      id: uniqueId("notif"),
      created_at: new Date().toISOString(),
      is_read: false,
      ...notification,
    });
  }
}

function getNextCode(prefix: string, items: string[]) {
  const current = Math.max(
    ...items.map((code) => Number(code.split("-").at(-1) ?? 0)),
    0,
  );

  return `${prefix}${String(current + 1).padStart(4, "0")}`;
}

export const demoApi = {
  reset() {
    localStorage.removeItem(STORAGE_KEY);
  },
  dashboard: {
    get: async () => delay(getDb().dashboardStats),
  },
  customers: {
    list: async () => delay(getDb().customers),
    getById: async (id: string) =>
      delay(getDb().customers.find((customer) => customer.id === id) ?? null),
    add: async (
      payload: Omit<
        Customer,
        "id" | "customer_code" | "created_at" | "last_order_at" | "total_spent" | "total_orders" | "is_active"
      >,
    ) =>
      delay(
        updateDb((db) => {
          const customer: Customer = {
            ...payload,
            id: uniqueId("customer"),
            customer_code: getNextCode(
              "KH-2024-",
              db.customers.map((item) => item.customer_code),
            ),
            created_at: new Date().toISOString(),
            last_order_at: new Date().toISOString(),
            total_spent: 0,
            total_orders: 0,
            is_active: payload.customer_type !== "inactive",
          };

          db.customers.unshift(customer);
          addAudit(
            db,
            {
              user_id: "u1",
              action: "create",
              entity_type: "customer",
              entity_id: customer.customer_code,
              before: null,
              after: { full_name: customer.full_name, province: customer.province },
              message: "Tạo khách hàng mới từ giao diện demo.",
            },
            {
              title: "Khách hàng mới vừa được thêm",
              message: `${customer.full_name} đã được lưu vào danh sách khách hàng.`,
              type: "success",
              entity_type: "customer",
              entity_id: customer.id,
            },
          );

          return customer;
        }),
      ),
    update: async (id: string, payload: Partial<Customer>) =>
      delay(
        updateDb((db) => {
          const index = db.customers.findIndex((customer) => customer.id === id);

          if (index === -1) {
            return null;
          }

          const before = clone(db.customers[index]);
          db.customers[index] = { ...db.customers[index], ...payload };
          addAudit(db, {
            user_id: "u1",
            action: "update",
            entity_type: "customer",
            entity_id: db.customers[index].customer_code,
            before,
            after: db.customers[index],
            message: "Cập nhật hồ sơ khách hàng.",
          });

          return db.customers[index];
        }),
      ),
    delete: async (id: string) =>
      delay(
        updateDb((db) => {
          const customer = db.customers.find((item) => item.id === id);

          if (!customer) {
            return false;
          }

          customer.is_active = false;
          customer.customer_type = "inactive";
          addAudit(db, {
            user_id: "u1",
            action: "delete",
            entity_type: "customer",
            entity_id: customer.customer_code,
            before: customer,
            after: null,
            message: "Xóa khách hàng khỏi danh sách demo.",
          });

          return true;
        }),
      ),
    bulkDelete: async (ids: string[]) =>
      delay(
        updateDb((db) => {
          db.customers = db.customers.map((customer) =>
            ids.includes(customer.id)
              ? { ...customer, is_active: false, customer_type: "inactive" }
              : customer,
          );
          return true;
        }),
      ),
    bulkChangeType: async (ids: string[], customerType: Customer["customer_type"]) =>
      delay(
        updateDb((db) => {
          db.customers = db.customers.map((customer) =>
            ids.includes(customer.id)
              ? { ...customer, customer_type: customerType }
              : customer,
          );
          return true;
        }),
      ),
    addNote: async (
      customerId: string,
      content: string,
      noteType: CustomerNote["note_type"] = "general",
    ) =>
      delay(
        updateDb((db) => {
          const note: CustomerNote = {
            id: uniqueId("note"),
            customer_id: customerId,
            author_id: "u1",
            note_type: noteType,
            content,
            created_at: new Date().toISOString(),
          };
          db.customerNotes.unshift(note);
          return note;
        }),
      ),
  },
  transactions: {
    list: async () => delay(getDb().transactions),
    add: async (
      payload: Omit<Transaction, "id" | "invoice_code" | "created_at" | "subtotal" | "total_amount"> & {
        invoice_code?: string;
      },
    ) =>
      delay(
        updateDb((db) => {
          const subtotal = payload.items.reduce((sum, item) => sum + item.total, 0);
          const taxAmount = payload.tax_amount ?? 0;
          const transaction: Transaction = {
            ...payload,
            id: uniqueId("transaction"),
            invoice_code:
              payload.invoice_code ||
              getNextCode("HD-2024-", db.transactions.map((item) => item.invoice_code)),
            created_at: new Date().toISOString(),
            subtotal,
            tax_amount: taxAmount,
            total_amount: subtotal - payload.discount + taxAmount,
          };

          db.transactions.unshift(transaction);

          const customer = db.customers.find((item) => item.id === payload.customer_id);
          if (customer) {
            customer.total_orders += 1;
            customer.total_spent += transaction.total_amount;
            customer.last_order_at = transaction.created_at;
          }

          addAudit(db, {
            user_id: "u1",
            action: "create",
            entity_type: "transaction",
            entity_id: transaction.invoice_code,
            before: null,
            after: { total_amount: transaction.total_amount },
            message: "Tạo giao dịch mới từ màn hình giao dịch.",
          });

          return transaction;
        }),
      ),
  },
  tickets: {
    list: async () => delay(getDb().tickets),
    getById: async (id: string) =>
      delay(getDb().tickets.find((ticket) => ticket.id === id) ?? null),
    add: async (
      payload: Omit<Ticket, "id" | "ticket_code" | "created_at" | "resolved_at" | "due_at">,
    ) =>
      delay(
        updateDb((db) => {
          const ticket: Ticket = {
            ...payload,
            id: uniqueId("ticket"),
            ticket_code: getNextCode(
              "TK-2024-",
              db.tickets.map((item) => item.ticket_code),
            ),
            created_at: new Date().toISOString(),
            resolved_at: null,
            due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          };

          db.tickets.unshift(ticket);
          addAudit(
            db,
            {
              user_id: "u1",
              action: "create",
              entity_type: "ticket",
              entity_id: ticket.ticket_code,
              before: null,
              after: { title: ticket.title, priority: ticket.priority },
              message: "Tạo ticket hỗ trợ mới.",
            },
            {
              title: "Ticket mới cần xử lý",
              message: `${ticket.ticket_code} vừa được tạo trong hệ thống.`,
              type: "warning",
              entity_type: "ticket",
              entity_id: ticket.id,
            },
          );
          return ticket;
        }),
      ),
    update: async (id: string, payload: Partial<Ticket>) =>
      delay(
        updateDb((db) => {
          const index = db.tickets.findIndex((ticket) => ticket.id === id);
          if (index === -1) {
            return null;
          }
          const before = clone(db.tickets[index]);
          db.tickets[index] = {
            ...db.tickets[index],
            ...payload,
            resolved_at:
              payload.status === "resolved"
                ? new Date().toISOString()
                : db.tickets[index].resolved_at,
          };
          addAudit(db, {
            user_id: "u1",
            action: "update",
            entity_type: "ticket",
            entity_id: db.tickets[index].ticket_code,
            before,
            after: db.tickets[index],
            message: "Cập nhật ticket hỗ trợ.",
          });
          return db.tickets[index];
        }),
      ),
    addComment: async (
      ticketId: string,
      comment: Pick<TicketComment, "content" | "type">,
    ) =>
      delay(
        updateDb((db) => {
          const record: TicketComment = {
            id: uniqueId("comment"),
            ticket_id: ticketId,
            author_id: comment.type === "system" ? null : "u1",
            content: comment.content,
            created_at: new Date().toISOString(),
            type: comment.type,
            system_label: comment.type === "system" ? comment.content : undefined,
          };
          db.ticketComments.push(record);
          return record;
        }),
      ),
  },
  campaigns: {
    list: async () => delay(getDb().campaigns),
    add: async (
      payload: Omit<
        Campaign,
        "id" | "created_at" | "sent_count" | "opened_count" | "sent_at"
      >,
    ) =>
      delay(
        updateDb((db) => {
          const campaign: Campaign = {
            ...payload,
            id: uniqueId("campaign"),
            created_at: new Date().toISOString(),
            sent_count: 0,
            opened_count: 0,
            sent_at: null,
          };
          db.campaigns.unshift(campaign);
          return campaign;
        }),
      ),
    update: async (id: string, payload: Partial<Campaign>) =>
      delay(
        updateDb((db) => {
          const campaign = db.campaigns.find((item) => item.id === id);
          if (!campaign) return null;
          Object.assign(campaign, payload);
          return campaign;
        }),
      ),
    duplicate: async (id: string) =>
      delay(
        updateDb((db) => {
          const campaign = db.campaigns.find((item) => item.id === id);
          if (!campaign) {
            return null;
          }
          const duplicated: Campaign = {
            ...campaign,
            id: uniqueId("campaign"),
            name: `${campaign.name} (Bản sao)`,
            status: "draft",
            created_at: new Date().toISOString(),
            sent_at: null,
            sent_count: 0,
            opened_count: 0,
          };
          db.campaigns.unshift(duplicated);
          return duplicated;
        }),
      ),
    delete: async (id: string) =>
      delay(
        updateDb((db) => {
          db.campaigns = db.campaigns.filter((item) => item.id !== id);
          return true;
        }),
      ),
  },
  notifications: {
    list: async () => delay(getDb().notifications),
    markRead: async (id: string) =>
      delay(
        updateDb((db) => {
          db.notifications = db.notifications.map((item) =>
            item.id === id ? { ...item, is_read: true } : item,
          );
          return true;
        }),
      ),
    markAllRead: async () =>
      delay(
        updateDb((db) => {
          db.notifications = db.notifications.map((item) => ({
            ...item,
            is_read: true,
          }));
          return true;
        }),
      ),
  },
  users: {
    list: async () => delay(getDb().users),
    add: async (
      payload: Omit<User, "id" | "avatar_url" | "is_active"> & { password: string },
    ) =>
      delay(
        updateDb((db) => {
          const user: User = {
            id: uniqueId("user"),
            full_name: payload.full_name,
            email: payload.email,
            role: payload.role,
            department: payload.department,
            avatar_url: null,
            is_active: true,
          };
          db.users.push(user);
          return user;
        }),
      ),
    update: async (
      id: string,
      payload: Partial<Pick<User, "role" | "department" | "full_name" | "email">>,
    ) =>
      delay(
        updateDb((db) => {
          const user = db.users.find((item) => item.id === id);
          if (!user) {
            return null;
          }
          Object.assign(user, payload);
          return user;
        }),
      ),
    toggleStatus: async (id: string) =>
      delay(
        updateDb((db) => {
          const user = db.users.find((item) => item.id === id);
          if (!user) {
            return null;
          }
          user.is_active = !user.is_active;
          return user;
        }),
      ),
    updateRole: async (id: string, role: User["role"]) =>
      delay(
        updateDb((db) => {
          const user = db.users.find((item) => item.id === id);
          if (!user) {
            return null;
          }
          user.role = role;
          return user;
        }),
      ),
    delete: async (id: string) =>
      delay(
        updateDb((db) => {
          db.users = db.users.filter((item) => item.id !== id);
          return true;
        }),
      ),
  },
  automation: {
    list: async () => delay(getDb().automationRules),
    add: async (
      payload: Omit<
        AutomationRule,
        "id" | "is_active" | "sent_count" | "created_at" | "updated_at" | "last_run_at"
      >,
    ) =>
      delay(
        updateDb((db) => {
          const rule: AutomationRule = {
            ...payload,
            id: uniqueId("rule"),
            is_active: true,
            sent_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_run_at: null,
          };
          db.automationRules.unshift(rule);
          return rule;
        }),
      ),
    toggle: async (id: string) =>
      delay(
        updateDb((db) => {
          const rule = db.automationRules.find((item) => item.id === id);
          if (!rule) {
            return null;
          }
          rule.is_active = !rule.is_active;
          return rule;
        }),
      ),
  },
  settings: {
    get: async () => delay(getDb().settings),
    update: async (payload: Partial<AppSettings>) =>
      delay(
        updateDb((db) => {
          db.settings = {
            ...db.settings,
            ...payload,
            integrations: {
              ...db.settings.integrations,
              ...payload.integrations,
            },
          };
          return db.settings;
        }),
      ),
    toggleNotification: async (key: string, enabled: boolean) =>
      delay(
        updateDb((db) => {
          db.settings.notification_settings = db.settings.notification_settings.map(
            (item) => (item.key === key ? { ...item, enabled } : item),
          );
          return db.settings;
        }),
      ),
  },
  audit: {
    list: async () => delay(getDb().auditLogs),
  },
  notes: {
    list: async () => delay(getDb().customerNotes),
  },
  comments: {
    list: async () => delay(getDb().ticketComments),
  },
};
