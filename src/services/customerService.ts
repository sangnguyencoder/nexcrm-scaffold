import { supabase } from "@/lib/supabase";
import type { Customer, CustomerNote } from "@/types";

import {
  type CustomerFilters,
  type CustomerRow,
  createAuditLog,
  ensureSupabaseConfigured,
  getAppErrorMessage,
  getCurrentProfileId,
  runBestEffort,
  toCustomer,
  toCustomerNote,
  withLatency,
} from "@/services/shared";

export type CustomerCreateInput = {
  full_name: string;
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

function buildSearchQuery(search: string) {
  const keyword = search.replaceAll("%", "").trim();
  return `full_name.ilike.%${keyword}%,phone.ilike.%${keyword}%,email.ilike.%${keyword}%`;
}

async function fetchCustomerRow(id: string) {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function ensureUniqueCustomerContact({
  id,
  phone,
  email,
}: {
  id?: string;
  phone?: string;
  email?: string;
}) {
  const normalizedPhone = phone?.trim();
  const normalizedEmail = email?.trim();

  if (normalizedPhone) {
    let phoneQuery = supabase
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .limit(1);

    if (id) {
      phoneQuery = phoneQuery.neq("id", id);
    }

    const { data: phoneDuplicate, error: phoneError } = await phoneQuery.maybeSingle();

    if (phoneError) {
      throw phoneError;
    }

    if (phoneDuplicate) {
      throw new Error("Số điện thoại đã tồn tại trong hệ thống.");
    }
  }

  if (normalizedEmail) {
    let emailQuery = supabase
      .from("customers")
      .select("id")
      .ilike("email", normalizedEmail)
      .limit(1);

    if (id) {
      emailQuery = emailQuery.neq("id", id);
    }

    const { data: emailDuplicate, error: emailError } = await emailQuery.maybeSingle();

    if (emailError) {
      throw emailError;
    }

    if (emailDuplicate) {
      throw new Error("Email đã tồn tại trong hệ thống.");
    }
  }
}

export const customerService = {
  getList(filters: CustomerFilters = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();

        let query = supabase.from("customers").select("*");

        if (filters.search) {
          query = query.or(buildSearchQuery(filters.search));
        }

        if (filters.customerType && filters.customerType !== "all") {
          query = query.eq("customer_type", filters.customerType);
        }

        if (filters.includeInactive === false) {
          query = query.eq("is_active", true);
        }

        const sortBy = filters.sortBy ?? "created_at";
        const ascending = (filters.sortDirection ?? "desc") === "asc";
        const { data, error } = await query.order(sortBy, { ascending });

        if (error) {
          throw error;
        }

        return ((data ?? []) as CustomerRow[]).map(toCustomer);
      })(),
    );
  },

  getById(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const row = await fetchCustomerRow(id);
        return toCustomer(row);
      })(),
    );
  },

  create(payload: CustomerCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        await ensureUniqueCustomerContact({
          phone: payload.phone,
          email: payload.email,
        });

        const { data, error } = await supabase
          .from("customers")
          .insert({
            full_name: payload.full_name,
            phone: payload.phone || null,
            email: payload.email || null,
            address: payload.address || null,
            province: payload.province || null,
            customer_type: payload.customer_type,
            source: payload.source ?? "direct",
            assigned_to: payload.assigned_to || currentUserId,
            created_by: currentUserId,
          })
          .select("*")
          .single();

        if (error) {
          throw new Error(getAppErrorMessage(error, "Không thể tạo khách hàng."));
        }

        void runBestEffort("customer.create.audit", () =>
          createAuditLog({
            action: "create",
            entityType: "customer",
            entityId: data.id,
            newData: {
              message: `Tạo khách hàng ${payload.full_name}`,
              customer_code: data.customer_code,
            },
            userId: currentUserId,
          }),
        );

        const noteContent = payload.notes?.trim();
        if (noteContent) {
          void runBestEffort("customer.create.note", () =>
            customerService.addNote(data.id, noteContent, "general"),
          );
        }

        return toCustomer(data);
      })(),
    );
  },

  update(id: string, payload: CustomerUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchCustomerRow(id);
        const currentUserId = await getCurrentProfileId();
        await ensureUniqueCustomerContact({
          id,
          phone: payload.phone ?? previous.phone ?? undefined,
          email: payload.email ?? previous.email ?? undefined,
        });

        const { data, error } = await supabase
          .from("customers")
          .update({
            full_name: payload.full_name ?? previous.full_name,
            phone: payload.phone ?? previous.phone,
            email: payload.email ?? previous.email,
            address: payload.address ?? previous.address,
            province: payload.province ?? previous.province,
            customer_type: payload.customer_type ?? previous.customer_type,
            source: payload.source ?? previous.source,
            assigned_to: payload.assigned_to ?? previous.assigned_to,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw new Error(getAppErrorMessage(error, "Không thể cập nhật khách hàng."));
        }

        void runBestEffort("customer.update.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "customer",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Cập nhật khách hàng ${data.full_name}`,
              customer_type: data.customer_type,
              assigned_to: data.assigned_to,
            },
            userId: currentUserId,
          }),
        );

        return toCustomer(data);
      })(),
    );
  },

  softDelete(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchCustomerRow(id);
        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("customers")
          .update({
            is_active: false,
            customer_type: "inactive",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        void runBestEffort("customer.softDelete.audit", () =>
          createAuditLog({
            action: "delete",
            entityType: "customer",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: { message: `Chuyển khách hàng ${previous.full_name} sang inactive` },
            userId: currentUserId,
          }),
        );

        return toCustomer(data);
      })(),
    );
  },

  softDeleteMany(ids: string[]) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        if (!ids.length) {
          return [];
        }

        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("customers")
          .update({
            is_active: false,
            customer_type: "inactive",
            updated_at: new Date().toISOString(),
          })
          .in("id", ids)
          .select("*");

        if (error) {
          throw error;
        }

        void runBestEffort("customer.softDeleteMany.audit", () =>
          createAuditLog({
            action: "delete",
            entityType: "customer",
            entityId: ids[0] ?? null,
            newData: {
              message: `Chuyển ${ids.length} khách hàng sang inactive`,
              ids,
            },
            userId: currentUserId,
          }),
        );

        return ((data ?? []) as CustomerRow[]).map(toCustomer);
      })(),
    );
  },

  bulkChangeType(ids: string[], customerType: Customer["customer_type"]) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        if (!ids.length) {
          return [];
        }

        const currentUserId = await getCurrentProfileId();
        const { data, error } = await supabase
          .from("customers")
          .update({
            customer_type: customerType,
            is_active: customerType === "inactive" ? false : true,
            updated_at: new Date().toISOString(),
          })
          .in("id", ids)
          .select("*");

        if (error) {
          throw error;
        }

        void runBestEffort("customer.bulkChangeType.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "customer",
            entityId: ids[0] ?? null,
            newData: {
              message: `Cập nhật phân loại cho ${ids.length} khách hàng`,
              customer_type: customerType,
              ids,
            },
            userId: currentUserId,
          }),
        );

        return ((data ?? []) as CustomerRow[]).map(toCustomer);
      })(),
    );
  },

  addNote(customerId: string, content: string, noteType: CustomerNote["note_type"]) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUserId = await getCurrentProfileId();
        await createAuditLog({
          action: "create",
          entityType: "customer_note",
          entityId: customerId,
          newData: {
            customer_id: customerId,
            author_id: currentUserId,
            note_type: noteType,
            content,
            created_at: new Date().toISOString(),
            message: "Thêm ghi chú khách hàng",
          },
          userId: currentUserId,
        });
      })(),
    );
  },

  getNotes(customerId?: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        let query = supabase
          .from("audit_logs")
          .select("*")
          .eq("entity_type", "customer_note")
          .order("created_at", { ascending: false });

        if (customerId) {
          query = query.eq("entity_id", customerId);
        }

        const { data, error } = await query;

        if (error) {
          throw error;
        }

        return ((data ?? []) as Parameters<typeof toCustomerNote>[0][])
          .map(toCustomerNote)
          .filter((note): note is CustomerNote => Boolean(note));
      })(),
    );
  },
};
