import {
  ensureOrgAccess,
  errorResponse,
  handleOptions,
  isRecord,
  isUuid,
  jsonResponse,
  parseJsonBody,
  resolveCaller,
  toFiniteNumber,
  toNullableTrimmedString,
  toTrimmedString,
} from "../_shared/common.ts";
import type { AppSettingsRecord } from "../_shared/providers.ts";
import { decryptAppSettingsSecrets } from "../_shared/secrets.ts";
import { validateOutboundEndpoint } from "../_shared/network-security.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type RequestBody = {
  org_id?: string;
  orgId?: string;
  since?: string;
  limit?: number;
  provider?: string;
  endpoint?: string;
  apiKey?: string;
  manual_csv?: string;
  manualCsv?: string;
  orders?: unknown[];
};

type POSOrderItem = {
  name: string;
  qty: number;
  price: number;
  total: number;
};

type POSOrder = {
  pos_transaction_id: string;
  invoice_code: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  items: POSOrderItem[];
  subtotal: number;
  total_amount: number;
  payment_method: "cash" | "card" | "transfer" | "qr" | "other";
  payment_status: "pending" | "paid" | "partial" | "refunded" | "cancelled";
  status: "pending" | "processing" | "completed" | "cancelled" | "refunded";
  transaction_at: string;
  notes: string | null;
};

interface POSProvider {
  readonly name: string;
  getOrders(since: Date, limit: number): Promise<POSOrder[]>;
}

function resolveOrgId(body: RequestBody | null): string | null {
  return toNullableTrimmedString(body?.org_id ?? body?.orgId);
}

function normalizePaymentMethod(value: unknown): POSOrder["payment_method"] {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "cash" || normalized === "card" || normalized === "transfer" || normalized === "qr") {
    return normalized;
  }
  return "other";
}

function normalizePaymentStatus(value: unknown): POSOrder["payment_status"] {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "pending" || normalized === "paid" || normalized === "partial" || normalized === "refunded" || normalized === "cancelled") {
    return normalized;
  }
  return "paid";
}

function normalizeStatus(value: unknown): POSOrder["status"] {
  const normalized = toTrimmedString(value).toLowerCase();
  if (normalized === "pending" || normalized === "processing" || normalized === "completed" || normalized === "cancelled" || normalized === "refunded") {
    return normalized;
  }
  return "completed";
}

function normalizeItems(rawItems: unknown): POSOrderItem[] {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const items: POSOrderItem[] = [];
  for (const item of rawItems) {
    if (!isRecord(item)) {
      continue;
    }
    const qty = toFiniteNumber(item.qty ?? item.quantity) ?? 0;
    const price = toFiniteNumber(item.price ?? item.unit_price) ?? 0;
    const total = toFiniteNumber(item.total ?? item.amount) ?? qty * price;
    if (qty <= 0 || price < 0) {
      continue;
    }

    items.push({
      name: toTrimmedString(item.name ?? item.product_name) || "Sản phẩm POS",
      qty,
      price,
      total,
    });
  }

  return items;
}

function normalizeOrder(raw: unknown): POSOrder | null {
  if (!isRecord(raw)) {
    return null;
  }

  const customerBlock = isRecord(raw.customer) ? raw.customer : {};
  const items = normalizeItems(raw.items ?? raw.order_items ?? raw.products);
  const subtotalFromItems = items.reduce((sum, item) => sum + item.total, 0);
  const subtotal = toFiniteNumber(raw.subtotal) ?? subtotalFromItems;
  const totalAmount = toFiniteNumber(raw.total_amount ?? raw.total ?? raw.grand_total) ?? subtotal;
  const invoiceCode =
    toNullableTrimmedString(raw.pos_transaction_id) ??
    toNullableTrimmedString(raw.transaction_id) ??
    toNullableTrimmedString(raw.order_id) ??
    toNullableTrimmedString(raw.invoice_code) ??
    toNullableTrimmedString(raw.code);

  if (!invoiceCode) {
    return null;
  }

  const transactionAt =
    toNullableTrimmedString(raw.transaction_at) ??
    toNullableTrimmedString(raw.created_at) ??
    toNullableTrimmedString(raw.order_date) ??
    new Date().toISOString();

  return {
    pos_transaction_id: invoiceCode,
    invoice_code: invoiceCode,
    customer_name:
      toTrimmedString(customerBlock.full_name ?? customerBlock.name ?? raw.customer_name) || "Khách POS",
    customer_phone: toNullableTrimmedString(customerBlock.phone ?? raw.customer_phone),
    customer_email: toNullableTrimmedString(customerBlock.email ?? raw.customer_email)?.toLowerCase() ?? null,
    customer_address: toNullableTrimmedString(customerBlock.address ?? raw.customer_address),
    items,
    subtotal: subtotal >= 0 ? subtotal : 0,
    total_amount: totalAmount >= 0 ? totalAmount : 0,
    payment_method: normalizePaymentMethod(raw.payment_method),
    payment_status: normalizePaymentStatus(raw.payment_status),
    status: normalizeStatus(raw.status),
    transaction_at: transactionAt,
    notes: toNullableTrimmedString(raw.notes),
  };
}

class KiotVietProvider implements POSProvider {
  readonly name = "kiotviet";

  constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
  ) {}

  async getOrders(since: Date, limit: number): Promise<POSOrder[]> {
    const url = new URL(this.endpoint);
    url.searchParams.set("since", since.toISOString());
    url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 500))));

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "POS API trả về lỗi.");
    }

    const payload = (await response.json().catch(() => null)) as unknown;
    const rawOrders = Array.isArray(payload)
      ? payload
      : isRecord(payload) && Array.isArray(payload.orders)
        ? payload.orders
        : isRecord(payload) && isRecord(payload.data) && Array.isArray(payload.data.orders)
          ? payload.data.orders
          : isRecord(payload) && Array.isArray(payload.data)
            ? payload.data
            : [];

    return rawOrders.map((item) => normalizeOrder(item)).filter((item): item is POSOrder => Boolean(item));
  }
}

class ManualImportProvider implements POSProvider {
  readonly name = "manual_import";

  constructor(
    private readonly csvText: string | null,
    private readonly orders: unknown[],
  ) {}

  private parseCsv(): POSOrder[] {
    if (!this.csvText) {
      return [];
    }

    const lines = this.csvText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return [];
    }

    const headers = lines[0].split(",").map((header) => header.trim().toLowerCase());
    const rows: POSOrder[] = [];

    for (const line of lines.slice(1)) {
      const cells = line.split(",").map((cell) => cell.trim());
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] ?? null;
      });

      const normalized = normalizeOrder(record);
      if (normalized) {
        rows.push(normalized);
      }
    }

    return rows;
  }

  async getOrders(_since: Date, limit: number): Promise<POSOrder[]> {
    const normalizedFromBody = this.orders
      .map((item) => normalizeOrder(item))
      .filter((item): item is POSOrder => Boolean(item));
    const normalizedFromCsv = this.parseCsv();
    const merged = [...normalizedFromBody, ...normalizedFromCsv];
    return merged.slice(0, Math.max(1, Math.min(limit, 2000)));
  }
}

async function getPOSProvider(settings: AppSettingsRecord, body: RequestBody): Promise<POSProvider> {
  const manualCsv = toNullableTrimmedString(body.manual_csv ?? body.manualCsv);
  const manualOrders = Array.isArray(body.orders) ? body.orders : [];

  if (manualCsv || manualOrders.length > 0) {
    return new ManualImportProvider(manualCsv, manualOrders);
  }

  const provider = toTrimmedString(body.provider ?? settings.pos_provider).toLowerCase() || "kiotviet";
  const endpoint = toNullableTrimmedString(body.endpoint) ?? toNullableTrimmedString(settings.pos_api_endpoint);
  const apiKey = toNullableTrimmedString(body.apiKey) ?? toNullableTrimmedString(settings.pos_api_key);

  if (!endpoint || !apiKey) {
    throw new Error("Thiếu endpoint hoặc API key cho POS provider.");
  }

  const endpointCheck = await validateOutboundEndpoint(endpoint);
  if (!endpointCheck.ok) {
    throw new Error(`Endpoint POS bị chặn bởi chính sách SSRF: ${endpointCheck.message}`);
  }

  if (provider === "kiotviet" || provider === "haravan" || provider === "misa" || provider === "sapo" || provider === "custom") {
    return new KiotVietProvider(endpointCheck.url.toString(), apiKey);
  }

  throw new Error(`POS provider '${provider}' chưa được hỗ trợ.`);
}

async function upsertCustomer(
  adminClient: SupabaseClient,
  orgId: string,
  order: POSOrder,
  actorId: string | null,
): Promise<string> {
  let existingCustomerId: string | null = null;

  if (order.customer_phone) {
    const { data } = await adminClient
      .from("customers")
      .select("id")
      .eq("org_id", orgId)
      .eq("phone", order.customer_phone)
      .is("deleted_at", null)
      .maybeSingle();

    existingCustomerId = toNullableTrimmedString((data as { id?: string | null } | null)?.id);
  }

  if (!existingCustomerId && order.customer_email) {
    const { data } = await adminClient
      .from("customers")
      .select("id")
      .eq("org_id", orgId)
      .ilike("email", order.customer_email)
      .is("deleted_at", null)
      .maybeSingle();

    existingCustomerId = toNullableTrimmedString((data as { id?: string | null } | null)?.id);
  }

  if (existingCustomerId) {
    await adminClient
      .from("customers")
      .update({
        full_name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email,
        address: order.customer_address,
        source: "pos",
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", orgId)
      .eq("id", existingCustomerId)
      .is("deleted_at", null);

    return existingCustomerId;
  }

  const { data: created, error: createError } = await adminClient
    .from("customers")
    .insert({
      org_id: orgId,
      full_name: order.customer_name,
      phone: order.customer_phone,
      email: order.customer_email,
      address: order.customer_address,
      source: "pos",
      customer_type: "new",
      created_by: actorId,
      updated_by: actorId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw createError ?? new Error("Không tạo được customer từ dữ liệu POS.");
  }

  return String((created as { id: string }).id);
}

async function upsertTransaction(
  adminClient: SupabaseClient,
  orgId: string,
  customerId: string,
  order: POSOrder,
  actorId: string | null,
): Promise<{ transactionId: string; created: boolean }> {
  const externalCode = order.invoice_code || order.pos_transaction_id;
  if (!externalCode) {
    throw new Error("Thiếu pos_transaction_id để upsert transaction.");
  }

  const { data: existingRow } = await adminClient
    .from("transactions")
    .select("id")
    .eq("org_id", orgId)
    .eq("invoice_code", externalCode)
    .is("deleted_at", null)
    .maybeSingle();

  const existed = Boolean(existingRow);

  const { data: upserted, error: upsertError } = await adminClient
    .from("transactions")
    .upsert(
      {
        org_id: orgId,
        customer_id: customerId,
        invoice_code: externalCode,
        items: order.items,
        subtotal: order.subtotal,
        total_amount: order.total_amount,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        status: order.status,
        source: "pos_sync",
        transaction_at: order.transaction_at,
        notes: order.notes ?? `POS sync (${order.pos_transaction_id})`,
        processed_by: actorId,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "org_id,invoice_code",
      },
    )
    .select("id")
    .single();

  if (upsertError || !upserted) {
    throw upsertError ?? new Error("Upsert transaction thất bại.");
  }

  return {
    transactionId: String((upserted as { id: string }).id),
    created: !existed,
  };
}

Deno.serve(async (request) => {
  const preflight = handleOptions(request);
  if (preflight) {
    return preflight;
  }

  if (request.method !== "POST") {
    return errorResponse(405, "Method không hợp lệ. Chỉ hỗ trợ POST.");
  }

  const resolved = await resolveCaller(request, {
    allowServiceRole: true,
    requiredRoles: ["super_admin", "admin"],
  });
  if (!resolved.ok) {
    return resolved.response;
  }

  const { context } = resolved;
  const bodyResult = await parseJsonBody<RequestBody>(request);
  if (bodyResult.error) {
    return errorResponse(400, bodyResult.error);
  }

  const body: RequestBody = bodyResult.data ?? {};
  const requestedOrgId = resolveOrgId(body);
  if (requestedOrgId && !isUuid(requestedOrgId)) {
    return errorResponse(400, "org_id không hợp lệ.");
  }

  const orgId = requestedOrgId ?? context.orgId;
  if (!orgId) {
    return errorResponse(400, "org_id là bắt buộc cho service role request.");
  }

  const orgAccessError = ensureOrgAccess(context, orgId);
  if (orgAccessError) {
    return orgAccessError;
  }

  const { data: settingsData, error: settingsError } = await context.adminClient
    .from("app_settings")
    .select("pos_provider, pos_api_endpoint, pos_api_key, pos_sync_interval, pos_last_sync_at, pos_sync_enabled")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (settingsError) {
    return errorResponse(400, "Không đọc được app settings để POS sync.", settingsError);
  }

  const settings = await decryptAppSettingsSecrets((settingsData ?? {}) as AppSettingsRecord & {
    pos_sync_interval?: number | null;
    pos_last_sync_at?: string | null;
    pos_sync_enabled?: boolean | null;
  });

  const now = new Date();
  const sinceRaw =
    toNullableTrimmedString(body.since) ??
    toNullableTrimmedString(settings.pos_last_sync_at) ??
    new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const sinceDate = new Date(sinceRaw);
  if (Number.isNaN(sinceDate.getTime())) {
    return errorResponse(400, "since không hợp lệ.");
  }

  const limit = Math.max(1, Math.min(2000, Math.floor(toFiniteNumber(body.limit) ?? 500)));
  const syncType = toNullableTrimmedString(body.manual_csv ?? body.manualCsv) || (Array.isArray(body.orders) && body.orders.length > 0)
    ? "manual_import"
    : "polling";
  const startedAt = new Date().toISOString();

  const { data: logData, error: logError } = await context.adminClient
    .from("pos_sync_logs")
    .insert({
      org_id: orgId,
      provider: toNullableTrimmedString(body.provider) ?? toNullableTrimmedString(settings.pos_provider),
      sync_type: syncType,
      status: "running",
      started_at: startedAt,
      records_processed: 0,
      records_created: 0,
      records_updated: 0,
      request_payload: {
        since: sinceDate.toISOString(),
        limit,
        manual: syncType === "manual_import",
      },
      created_by: context.userId,
      updated_at: startedAt,
    })
    .select("id")
    .single();

  if (logError || !logData) {
    return errorResponse(400, "Không tạo được log cho POS sync.", logError);
  }

  const logId = String((logData as { id: string }).id);

  try {
    const provider = await getPOSProvider(settings, body);
    const orders = await provider.getOrders(sinceDate, limit);

    let recordsCreated = 0;
    let recordsUpdated = 0;
    let recordsFailed = 0;
    let recordsProcessed = 0;
    const failures: Array<{ pos_transaction_id: string; reason: string }> = [];

    for (const order of orders) {
      try {
        const customerId = await upsertCustomer(context.adminClient, orgId, order, context.userId);
        const upsertResult = await upsertTransaction(
          context.adminClient,
          orgId,
          customerId,
          order,
          context.userId,
        );

        recordsProcessed += 1;
        if (upsertResult.created) {
          recordsCreated += 1;
        } else {
          recordsUpdated += 1;
        }
      } catch (error) {
        recordsProcessed += 1;
        recordsFailed += 1;
        failures.push({
          pos_transaction_id: order.pos_transaction_id,
          reason: error instanceof Error ? error.message : "Lỗi đồng bộ order POS.",
        });
      }
    }

    const finishedAt = new Date().toISOString();
    await context.adminClient
      .from("pos_sync_logs")
      .update({
        status: recordsFailed === 0 ? "success" : "failed",
        finished_at: finishedAt,
        records_processed: recordsProcessed,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        error_message: recordsFailed > 0 ? `Có ${recordsFailed} order sync thất bại.` : null,
        response_payload: {
          records_received: orders.length,
          records_created: recordsCreated,
          records_updated: recordsUpdated,
          records_failed: recordsFailed,
          failures,
        },
        updated_at: finishedAt,
      })
      .eq("id", logId)
      .eq("org_id", orgId);

    if (recordsFailed === 0) {
      await context.adminClient
        .from("app_settings")
        .update({
          pos_last_sync_at: finishedAt,
          updated_by: context.userId,
          updated_at: finishedAt,
        })
        .eq("org_id", orgId)
        .is("deleted_at", null);
    }

    return jsonResponse({
      success: recordsFailed === 0,
      org_id: orgId,
      provider: provider.name,
      since: sinceDate.toISOString(),
      until: now.toISOString(),
      records_received: orders.length,
      records_processed: recordsProcessed,
      records_created: recordsCreated,
      records_updated: recordsUpdated,
      records_failed: recordsFailed,
      log_id: logId,
      failures,
    });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    await context.adminClient
      .from("pos_sync_logs")
      .update({
        status: "failed",
        finished_at: finishedAt,
        error_message: error instanceof Error ? error.message : "Lỗi sync POS không xác định.",
        response_payload: {
          records_received: 0,
          records_created: 0,
          records_updated: 0,
          records_failed: 0,
        },
        updated_at: finishedAt,
      })
      .eq("id", logId)
      .eq("org_id", orgId);

    return errorResponse(500, "POS sync thất bại.", error);
  }
});
