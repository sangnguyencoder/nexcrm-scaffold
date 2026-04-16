import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export type UserRole = "super_admin" | "admin" | "director" | "sales" | "cskh" | "marketing";

export type JsonObject = Record<string, unknown>;

export type ProfileRecord = {
  id: string;
  org_id: string;
  role: UserRole;
  is_active: boolean;
  deleted_at: string | null;
  full_name: string | null;
};

export type CallerContext = {
  supabaseUrl: string;
  anonKey: string;
  serviceRoleKey: string;
  adminClient: SupabaseClient;
  userClient: SupabaseClient;
  token: string;
  isServiceRole: boolean;
  userId: string | null;
  userEmail: string | null;
  orgId: string | null;
  role: UserRole | "service_role" | null;
  profile: ProfileRecord | null;
};

export type ResolveCallerOptions = {
  allowServiceRole?: boolean;
  requiredRoles?: UserRole[];
};

export type ResolveCallerResult =
  | {
      ok: true;
      context: CallerContext;
    }
  | {
      ok: false;
      response: Response;
    };

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-user-authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`);
  }
  return value;
}

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toNullableTrimmedString(value: unknown): string | null {
  const normalized = toTrimmedString(value);
  return normalized || null;
}

export function toFiniteNumber(value: unknown): number | null {
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

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("x-user-authorization") ?? request.headers.get("Authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  return token;
}

export function isServiceRoleToken(token: string, serviceRoleKey: string): boolean {
  return token === serviceRoleKey;
}

export function createAdminClient(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createUserClient(supabaseUrl: string, anonKey: string, token: string): SupabaseClient {
  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function resolveCaller(
  request: Request,
  options: ResolveCallerOptions = {},
): Promise<ResolveCallerResult> {
  let supabaseUrl = "";
  let anonKey = "";
  let serviceRoleKey = "";
  let token: string | null = null;

  try {
    supabaseUrl = getEnv("SUPABASE_URL");
    anonKey = getEnv("SUPABASE_ANON_KEY");
    serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    token = readBearerToken(request);
  } catch (error) {
    return {
      ok: false,
      response: errorResponse(
        500,
        error instanceof Error ? error.message : "Lỗi cấu hình môi trường Supabase.",
      ),
    };
  }

  if (!token) {
    return {
      ok: false,
      response: errorResponse(401, "Thiếu hoặc sai định dạng Bearer token."),
    };
  }

  const adminClient = createAdminClient(supabaseUrl, serviceRoleKey);
  const userClient = createUserClient(supabaseUrl, anonKey, token);
  const serviceRole = isServiceRoleToken(token, serviceRoleKey);
  const allowServiceRole = options.allowServiceRole ?? false;

  if (serviceRole) {
    if (!allowServiceRole) {
      return { ok: false, response: errorResponse(403, "Service role không được phép gọi endpoint này.") };
    }

    return {
      ok: true,
      context: {
        supabaseUrl,
        anonKey,
        serviceRoleKey,
        adminClient,
        userClient,
        token,
        isServiceRole: true,
        userId: null,
        userEmail: null,
        orgId: null,
        role: "service_role",
        profile: null,
      },
    };
  }

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) {
    return { ok: false, response: errorResponse(401, "Không xác thực được người gọi.") };
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, org_id, role, is_active, deleted_at, full_name")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, response: errorResponse(403, "Không tìm thấy profile người dùng.") };
  }

  const normalized = profile as ProfileRecord;
  if (!normalized.is_active || normalized.deleted_at) {
    return { ok: false, response: errorResponse(403, "Tài khoản đã bị vô hiệu hóa.") };
  }

  const requiredRoles = options.requiredRoles ?? [];
  if (requiredRoles.length > 0 && !requiredRoles.includes(normalized.role)) {
    return { ok: false, response: errorResponse(403, "Bạn không có quyền truy cập chức năng này.") };
  }

  return {
    ok: true,
    context: {
      supabaseUrl,
      anonKey,
      serviceRoleKey,
      adminClient,
      userClient,
      token,
      isServiceRole: false,
      userId: authData.user.id,
      userEmail: authData.user.email ?? null,
      orgId: normalized.org_id,
      role: normalized.role,
      profile: normalized,
    },
  };
}

export function ensureOrgAccess(context: CallerContext, orgId: string): Response | null {
  if (!isUuid(orgId)) {
    return errorResponse(400, "org_id không hợp lệ.");
  }
  if (!context.isServiceRole && context.orgId !== orgId) {
    return errorResponse(403, "Không có quyền truy cập dữ liệu tổ chức này.");
  }
  return null;
}

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function parseJsonBody<T = JsonObject>(request: Request): Promise<{ data: T | null; error: string | null }> {
  if (request.method === "GET") {
    return { data: null, error: null };
  }

  const text = await request.text();
  if (!text.trim()) {
    return { data: null, error: null };
  }

  try {
    return { data: JSON.parse(text) as T, error: null };
  } catch {
    return { data: null, error: "Body phải là JSON hợp lệ." };
  }
}

export function jsonResponse(payload: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(payload, {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

export function errorResponse(status: number, message: string, details?: unknown): Response {
  return jsonResponse(
    {
      success: false,
      error: message,
      details: details ?? null,
    },
    status,
  );
}

export function handleOptions(request: Request): Response | null {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  return null;
}

export function applyTemplate(template: string | null | undefined, values: Record<string, unknown>): string {
  const raw = template ?? "";
  return raw.replace(/\{([a-zA-Z0-9_]+)\}/g, (matched, key) => {
    const normalized = key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(values, normalized)) {
      const value = values[normalized];
      return value === null || value === undefined ? "" : String(value);
    }
    return matched;
  });
}

export function toTemplateMap(base: Record<string, unknown>, extra: unknown): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(base)) {
    values[key.toLowerCase()] = value;
  }

  if (isRecord(extra)) {
    for (const [key, value] of Object.entries(extra)) {
      values[key.toLowerCase()] = value;
    }
  }

  return values;
}

export function normalizeErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    const message = toTrimmedString(error.message);
    if (message) {
      return message;
    }
  }

  return fallback;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timezoneOffsetHours(timezone: string): number {
  if (timezone === "Asia/Ho_Chi_Minh" || timezone === "Asia/Saigon") {
    return 7;
  }
  return 0;
}

function shiftByTimezone(date: Date, timezone: string): Date {
  const offset = timezoneOffsetHours(timezone);
  return new Date(date.getTime() + offset * 3600 * 1000);
}

function unshiftFromTimezone(date: Date, timezone: string): Date {
  const offset = timezoneOffsetHours(timezone);
  return new Date(date.getTime() - offset * 3600 * 1000);
}

export function getDayRange(timezone: string, date = new Date()): { start: Date; end: Date } {
  const zoned = shiftByTimezone(date, timezone);
  const start = new Date(zoned);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(zoned);
  end.setUTCHours(23, 59, 59, 999);
  return {
    start: unshiftFromTimezone(start, timezone),
    end: unshiftFromTimezone(end, timezone),
  };
}

export function getYearRange(timezone: string, date = new Date()): { start: Date; end: Date } {
  const zoned = shiftByTimezone(date, timezone);
  const year = zoned.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  return {
    start: unshiftFromTimezone(start, timezone),
    end: unshiftFromTimezone(end, timezone),
  };
}

export function getMonthDay(value: Date | string, timezone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const zoned = shiftByTimezone(date, timezone);
  const month = String(zoned.getUTCMonth() + 1).padStart(2, "0");
  const day = String(zoned.getUTCDate()).padStart(2, "0");
  return `${month}-${day}`;
}

export function formatDateForTemplate(date: Date, timezone: string): string {
  const zoned = shiftByTimezone(date, timezone);
  const day = String(zoned.getUTCDate()).padStart(2, "0");
  const month = String(zoned.getUTCMonth() + 1).padStart(2, "0");
  const year = zoned.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
