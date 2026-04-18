import { supabase } from "@/lib/supabase";
import { customerService as dataLayerCustomerService } from "@/services/data-layer";
import type { Customer, CustomerNote } from "@/types";
import { useAuthStore } from "@/store/authStore";

import type { CustomerFilters, ServiceRequestOptions } from "@/services/shared";

type DataLayerResult<T> = {
  data: T | null;
  error: { message?: string } | null;
  page?: { nextCursor: string | null; hasMore: boolean };
};

export type CustomerCreateInput = {
  full_name: string;
  date_of_birth?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  province?: string;
  customer_type: Customer["customer_type"];
  assigned_to?: string;
  source?: Customer["source"];
  notes?: string;
  tags?: string[];
};

export type CustomerUpdateInput = Partial<CustomerCreateInput>;

function unwrap<T>(result: DataLayerResult<T>, fallbackMessage: string): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  if (result.data == null) {
    throw new Error(fallbackMessage);
  }
  return result.data;
}

function normalizeCustomerError(error: unknown, fallbackMessage: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : fallbackMessage;
  const normalized = message.toLowerCase();

  if (
    normalized.includes("row-level security") ||
    normalized.includes("violates row-level security policy")
  ) {
    return new Error(
      "Bạn không có quyền xóa mềm khách hàng. Chỉ Sales/Director/Admin/Super Admin được phép thực hiện.",
    );
  }

  return new Error(message || fallbackMessage);
}

function normalizeSortText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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

function mapCustomer(row: Record<string, unknown>): Customer {
  const customerType =
    row.customer_type === "new" ||
    row.customer_type === "potential" ||
    row.customer_type === "loyal" ||
    row.customer_type === "vip" ||
    row.customer_type === "inactive"
      ? row.customer_type
      : "new";

  const source =
    row.source === "direct" ||
    row.source === "marketing" ||
    row.source === "referral" ||
    row.source === "pos" ||
    row.source === "online" ||
    row.source === "other"
      ? row.source
      : "direct";

  const deletedAt = typeof row.deleted_at === "string" ? row.deleted_at : null;

  return {
    id: String(row.id ?? ""),
    customer_code: String(row.customer_code ?? ""),
    full_name: String(row.full_name ?? ""),
    gender: row.gender ? String(row.gender) : null,
    date_of_birth: row.date_of_birth ? String(row.date_of_birth) : null,
    phone: row.phone ? String(row.phone) : "",
    email: row.email ? String(row.email) : "",
    address: row.address ? String(row.address) : "",
    province: row.province ? String(row.province) : "",
    customer_type: customerType,
    assigned_to: row.assigned_to ? String(row.assigned_to) : "",
    total_spent: Number(row.total_spent ?? 0),
    total_orders: Number(row.total_orders ?? 0),
    last_order_at: row.last_order_at ? String(row.last_order_at) : "",
    is_active: !deletedAt && customerType !== "inactive",
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    source,
    tags: [],
    notes: "",
  };
}

function mapCustomerNote(row: Record<string, unknown>): CustomerNote {
  const noteType = String(row.note_type ?? "general");
  const normalizedType: CustomerNote["note_type"] =
    noteType === "call" || noteType === "meeting" || noteType === "internal"
      ? noteType
      : "general";

  return {
    id: String(row.id ?? ""),
    customer_id: String(row.customer_id ?? ""),
    author_id: String(row.author_id ?? ""),
    note_type: normalizedType,
    content: String(row.content ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

async function collectCustomers(filters: CustomerFilters = {}) {
  const rows: Customer[] = [];
  let cursor: string | null = null;
  const maxIterations = 8;
  const pageLimit = 100;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await dataLayerCustomerService.getList({
      search: filters.search,
      customerType:
        filters.customerType && filters.customerType !== "all" ? filters.customerType : undefined,
      includeInactive: filters.includeInactive ?? false,
      limit: pageLimit,
      cursor,
    });
    const pageRows = unwrap(result as DataLayerResult<Array<Record<string, unknown>>>, "Không thể tải danh sách khách hàng.");
    rows.push(...pageRows.map(mapCustomer));
    if (!result.page?.hasMore || !result.page.nextCursor) {
      break;
    }
    cursor = result.page.nextCursor;
  }

  if (filters.sortBy) {
    const direction = filters.sortDirection === "asc" ? 1 : -1;
    rows.sort((left, right) => {
      switch (filters.sortBy) {
        case "full_name":
          return normalizeSortText(left.full_name).localeCompare(normalizeSortText(right.full_name)) * direction;
        case "phone":
          return normalizeSortText(left.phone).localeCompare(normalizeSortText(right.phone)) * direction;
        case "email":
          return normalizeSortText(left.email).localeCompare(normalizeSortText(right.email)) * direction;
        case "customer_type":
          return normalizeSortText(left.customer_type).localeCompare(normalizeSortText(right.customer_type)) * direction;
        case "assigned_to":
          return normalizeSortText(left.assigned_to).localeCompare(normalizeSortText(right.assigned_to)) * direction;
        case "total_spent":
          return (left.total_spent - right.total_spent) * direction;
        case "total_orders":
          return (left.total_orders - right.total_orders) * direction;
        case "updated_at":
          return (
            (new Date(left.updated_at ?? left.created_at).getTime() -
              new Date(right.updated_at ?? right.created_at).getTime()) *
            direction
          );
        case "last_order_at":
          return (
            (new Date(left.last_order_at || left.created_at).getTime() -
              new Date(right.last_order_at || right.created_at).getTime()) *
            direction
          );
        case "created_at":
        default:
          return (
            (new Date(left.created_at).getTime() - new Date(right.created_at).getTime()) * direction
          );
      }
    });
  }

  return rows;
}

async function loadCustomer(id: string) {
  const result = await dataLayerCustomerService.getById(id);
  const row = unwrap(result as DataLayerResult<Record<string, unknown>>, "Không tìm thấy khách hàng.");
  return mapCustomer(row);
}

export const customerService = {
  async getList(filters: CustomerFilters = {}, options: ServiceRequestOptions = {}) {
    void options;
    return collectCustomers(filters);
  },

  async getById(id: string, options: ServiceRequestOptions = {}) {
    void options;
    return loadCustomer(id);
  },

  async create(payload: CustomerCreateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerCustomerService.create({
      full_name: payload.full_name,
      date_of_birth: payload.date_of_birth || undefined,
      phone: payload.phone || undefined,
      email: payload.email || undefined,
      address: payload.address || undefined,
      province: payload.province || undefined,
      customer_type: payload.customer_type,
      source: payload.source || undefined,
      assigned_to: payload.assigned_to || undefined,
    });
    const created = mapCustomer(
      unwrap(
        result as DataLayerResult<Record<string, unknown>>,
        "Không thể tạo khách hàng.",
      ),
    );

    if (payload.notes?.trim()) {
      await customerService.addNote(created.id, payload.notes.trim(), "general");
    }

    if (payload.tags?.length) {
      const tagResult = await dataLayerCustomerService.bulkAddTag({
        customerIds: [created.id],
        tagNames: payload.tags,
      });
      if (tagResult.error) {
        throw new Error(tagResult.error.message || "Không thể gán tag cho khách hàng.");
      }
    }

    return created;
  },

  async update(id: string, payload: CustomerUpdateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerCustomerService.update(id, {
      full_name: payload.full_name,
      date_of_birth: payload.date_of_birth || undefined,
      phone: payload.phone || undefined,
      email: payload.email || undefined,
      address: payload.address || undefined,
      province: payload.province || undefined,
      customer_type: payload.customer_type,
      source: payload.source || undefined,
      assigned_to: payload.assigned_to || undefined,
    });
    return mapCustomer(
      unwrap(
        result as DataLayerResult<Record<string, unknown>>,
        "Không thể cập nhật khách hàng.",
      ),
    );
  },

  async softDelete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    try {
      const current = await loadCustomer(id);
      const result = await dataLayerCustomerService.softDelete(id);
      unwrap(result as DataLayerResult<{ id: string; deleted_at: string }>, "Không thể xóa mềm khách hàng.");
      return {
        ...current,
        customer_type: "inactive" as const,
        is_active: false,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      throw normalizeCustomerError(error, "Không thể xóa mềm khách hàng.");
    }
  },

  async softDeleteMany(ids: string[], options: ServiceRequestOptions = {}) {
    void options;
    try {
      const updated: Customer[] = [];
      for (const id of ids) {
        updated.push(await customerService.softDelete(id));
      }
      return updated;
    } catch (error) {
      throw normalizeCustomerError(error, "Không thể cập nhật danh sách khách hàng.");
    }
  },

  async bulkChangeType(ids: string[], customerType: Customer["customer_type"], options: ServiceRequestOptions = {}) {
    void options;
    const updated: Customer[] = [];
    for (const id of ids) {
      const customer = await customerService.update(id, { customer_type: customerType });
      updated.push({
        ...customer,
        is_active: customerType !== "inactive",
      });
    }
    return updated;
  },

  async addNote(
    customerId: string,
    content: string,
    noteType: CustomerNote["note_type"],
    options: ServiceRequestOptions = {},
  ) {
    void options;
    const { orgId, userId } = requireOrgContext();
    if (!userId) {
      throw new Error("Không xác định được người dùng hiện tại để tạo ghi chú.");
    }

    const mappedType =
      noteType === "call" || noteType === "meeting"
        ? noteType
        : noteType === "internal"
          ? "system"
          : "general";

    const { error } = await supabase.from("customer_notes").insert({
      org_id: orgId,
      customer_id: customerId,
      author_id: userId,
      note_type: mappedType,
      content,
    });

    if (error) {
      throw error;
    }
  },

  async getNotes(customerId?: string, options: ServiceRequestOptions = {}) {
    void options;
    const { orgId } = requireOrgContext();
    let query = supabase
      .from("customer_notes")
      .select("id, customer_id, author_id, note_type, content, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (customerId) {
      query = query.eq("customer_id", customerId);
    }

    const { data, error } = await query;
    if (error) {
      throw error;
    }

    return ((data ?? []) as Array<Record<string, unknown>>).map(mapCustomerNote);
  },
};
