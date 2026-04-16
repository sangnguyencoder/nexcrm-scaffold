import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pos-signature",
};

const PAYMENT_METHODS = new Set(["cash", "card", "transfer", "qr", "other"]);
const PAYMENT_STATUSES = new Set(["pending", "paid", "partial", "refunded", "cancelled"]);
const TRANSACTION_STATUSES = new Set(["pending", "processing", "completed", "cancelled", "refunded"]);

type PosCustomerInput = {
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
};

type PosItemInput = {
  name: string;
  qty: number;
  price: number;
  total: number;
};

type PosOrderInput = {
  order_id: string;
  invoice_code: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total_amount: number;
  payment_method: "cash" | "card" | "transfer" | "qr" | "other";
  payment_status: "pending" | "paid" | "partial" | "refunded" | "cancelled";
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
  notes: string | null;
};

type PosSyncPayload = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  customer: PosCustomerInput;
  order: PosOrderInput;
  items: PosItemInput[];
};

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullableTrimmedString(value: unknown) {
  const normalized = toTrimmedString(value);
  return normalized || null;
}

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizePaymentMethod(value: unknown): PosOrderInput["payment_method"] {
  const normalized = toTrimmedString(value).toLowerCase();
  if (PAYMENT_METHODS.has(normalized)) {
    return normalized as PosOrderInput["payment_method"];
  }
  return "other";
}

function normalizePaymentStatus(value: unknown): PosOrderInput["payment_status"] {
  const normalized = toTrimmedString(value).toLowerCase();
  if (PAYMENT_STATUSES.has(normalized)) {
    return normalized as PosOrderInput["payment_status"];
  }
  return "paid";
}

function normalizeTransactionStatus(value: unknown): PosOrderInput["status"] {
  const normalized = toTrimmedString(value).toLowerCase();
  if (TRANSACTION_STATUSES.has(normalized)) {
    return normalized as PosOrderInput["status"];
  }
  return "completed";
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String(error.code ?? "") : "";
  const message = "message" in error ? String(error.message ?? "") : "";
  const haystack = `${code} ${message}`.toLowerCase();
  return haystack.includes("23505") || haystack.includes("duplicate");
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    return String(error.message ?? "Lỗi không xác định.");
  }

  return "Lỗi không xác định.";
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) {
    return { items: [] as PosItemInput[], errors: ["items phải là mảng."] };
  }

  const errors: string[] = [];
  const items = value
    .map((item, index) => {
      if (!isRecord(item)) {
        errors.push(`items[${index}] không hợp lệ.`);
        return null;
      }

      const name = toTrimmedString(item.name) || `Sản phẩm #${index + 1}`;
      const qty = toFiniteNumber(item.qty);
      const price = toFiniteNumber(item.price);

      if (qty === null || qty <= 0) {
        errors.push(`items[${index}].qty phải là số > 0.`);
        return null;
      }

      if (price === null || price < 0) {
        errors.push(`items[${index}].price phải là số >= 0.`);
        return null;
      }

      const explicitTotal = toFiniteNumber(item.total);
      const total = explicitTotal !== null ? explicitTotal : qty * price;

      return {
        name,
        qty,
        price,
        total,
      } satisfies PosItemInput;
    })
    .filter((item): item is PosItemInput => item !== null);

  if (!items.length) {
    errors.push("items phải có ít nhất 1 dòng sản phẩm hợp lệ.");
  }

  return { items, errors };
}

function normalizePayload(value: unknown) {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return {
      payload: null,
      errors: ["Payload phải là JSON object."],
      fallbackEventId: `invalid-${crypto.randomUUID()}`,
      fallbackEventType: "invalid_payload",
      fallbackOrderId: null,
    };
  }

  const eventId = toTrimmedString(value.event_id);
  const eventType = toTrimmedString(value.event_type) || "order.created";
  const occurredAt = toTrimmedString(value.occurred_at) || new Date().toISOString();

  if (!eventId) {
    errors.push("event_id là bắt buộc.");
  }

  const customer = isRecord(value.customer) ? value.customer : {};
  const order = isRecord(value.order) ? value.order : {};
  const orderId = toTrimmedString(order.order_id);

  if (!orderId) {
    errors.push("order.order_id là bắt buộc.");
  }

  const normalizedItems = normalizeItems(value.items);
  errors.push(...normalizedItems.errors);

  const subtotalFromItems = normalizedItems.items.reduce((sum, item) => sum + item.total, 0);
  const discount = toFiniteNumber(order.discount) ?? 0;
  const tax = toFiniteNumber(order.tax) ?? 0;
  const subtotal = toFiniteNumber(order.subtotal) ?? subtotalFromItems;
  const computedTotal = Math.max(subtotal - discount, 0) + tax;
  const totalAmount = toFiniteNumber(order.total_amount) ?? computedTotal;

  if (totalAmount < 0) {
    errors.push("order.total_amount không được nhỏ hơn 0.");
  }

  const payload: PosSyncPayload = {
    event_id: eventId || `invalid-${crypto.randomUUID()}`,
    event_type: eventType,
    occurred_at: occurredAt,
    customer: {
      full_name: toTrimmedString(customer.full_name) || "Khách POS",
      phone: toNullableTrimmedString(customer.phone),
      email: (() => {
        const normalizedEmail = toNullableTrimmedString(customer.email);
        return normalizedEmail ? normalizedEmail.toLowerCase() : null;
      })(),
      address: toNullableTrimmedString(customer.address),
    },
    order: {
      order_id: orderId || `missing-order-${crypto.randomUUID()}`,
      invoice_code: toNullableTrimmedString(order.invoice_code),
      subtotal,
      discount,
      tax,
      total_amount: totalAmount,
      payment_method: normalizePaymentMethod(order.payment_method),
      payment_status: normalizePaymentStatus(order.payment_status),
      status: normalizeTransactionStatus(order.status),
      notes: toNullableTrimmedString(order.notes),
    },
    items: normalizedItems.items,
  };

  return {
    payload,
    errors,
    fallbackEventId: payload.event_id,
    fallbackEventType: payload.event_type,
    fallbackOrderId: payload.order.order_id,
  };
}

async function updatePosIntegrationStatus(
  adminClient: ReturnType<typeof createClient>,
  patch: Record<string, unknown>,
) {
  const { data: settingsRow } = await adminClient
    .from("app_settings")
    .select("id,integrations")
    .eq("id", "default")
    .maybeSingle();

  if (!settingsRow) {
    return;
  }

  const integrations = isRecord(settingsRow.integrations) ? settingsRow.integrations : {};
  const nextIntegrations = {
    ...integrations,
    ...patch,
  };

  await adminClient
    .from("app_settings")
    .update({
      integrations: nextIntegrations,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "default");
}

async function findExistingCustomer(
  adminClient: ReturnType<typeof createClient>,
  phone: string | null,
  email: string | null,
) {
  if (phone) {
    const { data, error } = await adminClient
      .from("customers")
      .select("id,full_name,phone,email,address")
      .eq("phone", phone)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data?.length) {
      return data[0];
    }
  }

  if (email) {
    const { data, error } = await adminClient
      .from("customers")
      .select("id,full_name,phone,email,address")
      .ilike("email", email)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (data?.length) {
      return data[0];
    }
  }

  return null;
}

async function upsertCustomer(
  adminClient: ReturnType<typeof createClient>,
  customerInput: PosCustomerInput,
) {
  const existing = await findExistingCustomer(
    adminClient,
    customerInput.phone,
    customerInput.email,
  );

  if (existing) {
    const { data, error } = await adminClient
      .from("customers")
      .update({
        full_name: customerInput.full_name || existing.full_name,
        phone: customerInput.phone ?? existing.phone,
        email: customerInput.email ?? existing.email,
        address: customerInput.address ?? existing.address,
        source: "pos",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return data.id as string;
  }

  const { data, error } = await adminClient
    .from("customers")
    .insert({
      full_name: customerInput.full_name,
      phone: customerInput.phone,
      email: customerInput.email,
      address: customerInput.address,
      source: "pos",
      customer_type: "new",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

async function createTransaction(
  adminClient: ReturnType<typeof createClient>,
  customerId: string,
  payload: PosSyncPayload,
) {
  const { data, error } = await adminClient
    .from("transactions")
    .insert({
      customer_id: customerId,
      invoice_code: payload.order.invoice_code || `POS-${payload.order.order_id}`,
      items: payload.items,
      subtotal: payload.order.subtotal,
      discount: payload.order.discount,
      tax: payload.order.tax,
      total_amount: payload.order.total_amount,
      payment_method: payload.order.payment_method,
      payment_status: payload.order.payment_status,
      status: payload.order.status,
      notes: payload.order.notes
        ? `[POS] ${payload.order.notes}`
        : `[POS] Đồng bộ từ order ${payload.order.order_id}`,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method không hợp lệ. Chỉ hỗ trợ POST." },
      { status: 405, headers: corsHeaders },
    );
  }

  const legacyEnabled =
    (Deno.env.get("ENABLE_LEGACY_POS_SYNC_WEBHOOK") ?? "").trim().toLowerCase() === "true";
  if (!legacyEnabled) {
    return Response.json(
      {
        error:
          "pos-sync-webhook (legacy) đã bị khóa. Dùng edge function pos-sync với polling/manual import theo kiến trúc mới.",
      },
      { status: 410, headers: corsHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const webhookSecret = Deno.env.get("POS_WEBHOOK_SECRET") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    return Response.json(
      { error: "Thiếu SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY hoặc POS_WEBHOOK_SECRET." },
      { status: 500, headers: corsHeaders },
    );
  }

  const providedSecret = request.headers.get("x-pos-signature")?.trim() ?? "";
  if (!providedSecret || providedSecret !== webhookSecret) {
    return Response.json(
      { error: "Webhook secret không hợp lệ." },
      { status: 401, headers: corsHeaders },
    );
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch {
    return Response.json(
      { error: "Body phải là JSON hợp lệ." },
      { status: 400, headers: corsHeaders },
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const normalized = normalizePayload(rawPayload);
  const now = new Date().toISOString();

  if (!normalized.payload || normalized.errors.length) {
    await adminClient.from("pos_sync_logs").insert({
      source: "pos",
      event_id: normalized.fallbackEventId,
      event_type: normalized.fallbackEventType,
      order_external_id: normalized.fallbackOrderId,
      status: "failed",
      payload: isRecord(rawPayload) ? rawPayload : { raw_payload: rawPayload },
      validation_errors: normalized.errors,
      error_message: "Payload không hợp lệ.",
      processed_at: now,
    });

    await updatePosIntegrationStatus(adminClient, {
      pos_status: "error",
    });

    return Response.json(
      {
        status: "failed",
        error: "Payload không hợp lệ.",
        validation_errors: normalized.errors,
      },
      { status: 400, headers: corsHeaders },
    );
  }

  const payload = normalized.payload;

  const { data: createdLog, error: createLogError } = await adminClient
    .from("pos_sync_logs")
    .insert({
      source: "pos",
      event_id: payload.event_id,
      event_type: payload.event_type,
      order_external_id: payload.order.order_id,
      customer_phone: payload.customer.phone,
      customer_email: payload.customer.email,
      status: "processing",
      payload,
    })
    .select("id")
    .single();

  if (createLogError) {
    if (isUniqueViolation(createLogError)) {
      return Response.json(
        {
          status: "duplicate",
          message: `Event ${payload.event_id} đã được xử lý trước đó.`,
        },
        { status: 200, headers: corsHeaders },
      );
    }

    return Response.json(
      { status: "failed", error: extractErrorMessage(createLogError) },
      { status: 400, headers: corsHeaders },
    );
  }

  const logId = createdLog.id as string;

  try {
    const { data: duplicateOrderRows, error: duplicateOrderError } = await adminClient
      .from("pos_sync_logs")
      .select("id,transaction_id")
      .eq("order_external_id", payload.order.order_id)
      .eq("status", "success")
      .neq("id", logId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (duplicateOrderError) {
      throw duplicateOrderError;
    }

    if (duplicateOrderRows?.length) {
      const duplicateOrder = duplicateOrderRows[0];
      await adminClient
        .from("pos_sync_logs")
        .update({
          status: "duplicate",
          error_message: `Order ${payload.order.order_id} đã tồn tại trong hệ thống.`,
          transaction_id: duplicateOrder.transaction_id ?? null,
          processed_at: now,
        })
        .eq("id", logId);

      await updatePosIntegrationStatus(adminClient, {
        pos_status: "success",
      });

      return Response.json(
        {
          status: "duplicate",
          message: `Order ${payload.order.order_id} đã được đồng bộ trước đó.`,
          log_id: logId,
          transaction_id: duplicateOrder.transaction_id ?? null,
        },
        { status: 200, headers: corsHeaders },
      );
    }

    const customerId = await upsertCustomer(adminClient, payload.customer);
    const transactionId = await createTransaction(adminClient, customerId, payload);

    await adminClient
      .from("pos_sync_logs")
      .update({
        status: "success",
        customer_id: customerId,
        transaction_id: transactionId,
        processed_at: now,
      })
      .eq("id", logId);

    await updatePosIntegrationStatus(adminClient, {
      pos_status: "success",
      last_sync: now,
    });

    return Response.json(
      {
        status: "success",
        log_id: logId,
        customer_id: customerId,
        transaction_id: transactionId,
      },
      { status: 200, headers: corsHeaders },
    );
  } catch (error) {
    const message = extractErrorMessage(error);
    await adminClient
      .from("pos_sync_logs")
      .update({
        status: "failed",
        error_message: message,
        processed_at: now,
      })
      .eq("id", logId);

    await updatePosIntegrationStatus(adminClient, {
      pos_status: "error",
    });

    return Response.json(
      { status: "failed", error: message, log_id: logId },
      { status: 500, headers: corsHeaders },
    );
  }
});
