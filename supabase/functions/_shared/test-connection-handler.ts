import {
  ensureOrgAccess,
  errorResponse,
  handleOptions,
  isRecord,
  isUuid,
  jsonResponse,
  parseJsonBody,
  resolveCaller,
  toNullableTrimmedString,
  toTrimmedString,
} from "./common.ts";
import {
  getEmailProvider,
  getSmsProvider,
  providerError,
  toHtmlBody,
  type AppSettingsRecord,
} from "./providers.ts";
import { decryptAppSettingsSecrets } from "./secrets.ts";
import { validateOutboundEndpoint } from "./network-security.ts";

type TestType = "email" | "sms" | "pos";

type RequestBody = {
  type?: TestType;
  config?: Record<string, unknown>;
  org_id?: string;
  orgId?: string;
  provider?: string;
  apiKey?: string;
  fromEmail?: string;
  endpoint?: string;
};

type NormalizedRequest = {
  type: TestType;
  orgId: string | null;
  config: Record<string, unknown>;
};

function normalizeBody(body: RequestBody | null): NormalizedRequest | null {
  if (!body) {
    return null;
  }

  const orgId = toNullableTrimmedString(body.org_id ?? body.orgId);
  const config = isRecord(body.config) ? body.config : {};

  const explicitType = toTrimmedString(body.type);
  if (explicitType === "email" || explicitType === "sms" || explicitType === "pos") {
    return {
      type: explicitType,
      orgId,
      config,
    };
  }

  if (toNullableTrimmedString(body.endpoint)) {
    return {
      type: "pos",
      orgId,
      config: {
        ...config,
        provider: body.provider,
        endpoint: body.endpoint,
        apiKey: body.apiKey,
      },
    };
  }

  if (toNullableTrimmedString(body.fromEmail) || toNullableTrimmedString(body.provider)) {
    return {
      type: "email",
      orgId,
      config: {
        ...config,
        provider: body.provider,
        apiKey: body.apiKey,
        fromEmail: body.fromEmail,
      },
    };
  }

  return null;
}

function resolveLatencyMs(start: number): number {
  return Math.max(0, Math.round(performance.now() - start));
}

async function pingEndpoint(endpoint: string, apiKey: string | null): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    return await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function handleTestConnection(request: Request): Promise<Response> {
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

  const normalized = normalizeBody(bodyResult.data);
  if (!normalized) {
    return errorResponse(400, "Payload test connection không hợp lệ. Cần có type và config.");
  }

  if (normalized.orgId && !isUuid(normalized.orgId)) {
    return errorResponse(400, "org_id không hợp lệ.");
  }

  const orgId = normalized.orgId ?? context.orgId;
  if (!orgId) {
    return errorResponse(400, "org_id là bắt buộc cho service role request.");
  }

  const orgAccessError = ensureOrgAccess(context, orgId);
  if (orgAccessError) {
    return orgAccessError;
  }

  const { data: settingsData } = await context.adminClient
    .from("app_settings")
    .select("email_provider, email_api_key, email_from_name, email_from_address, sms_provider, sms_api_key, pos_provider, pos_api_endpoint, pos_api_key")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const settings = await decryptAppSettingsSecrets((settingsData ?? {}) as AppSettingsRecord);

  const start = performance.now();

  if (normalized.type === "email") {
    const provider = getEmailProvider(settings, {
      provider: toNullableTrimmedString(normalized.config.provider),
      apiKey: toNullableTrimmedString(normalized.config.apiKey),
      fromEmail: toNullableTrimmedString(normalized.config.fromEmail),
      fromName: toNullableTrimmedString(normalized.config.fromName),
    });

    const testTo =
      toNullableTrimmedString(normalized.config.testTo) ??
      toNullableTrimmedString(normalized.config.email) ??
      context.userEmail ??
      toNullableTrimmedString(settings.email_from_address);

    if (!testTo) {
      return errorResponse(400, "Không xác định được email nhận test.");
    }

    try {
      await provider.send(
        testTo,
        "[NexCRM] Test email connection",
        toHtmlBody("Kết nối email provider thành công."),
      );

      return jsonResponse({
        success: true,
        message: "Kết nối email thành công.",
        latencyMs: resolveLatencyMs(start),
      });
    } catch (error) {
      return jsonResponse({
        success: false,
        message: providerError(error, "Kết nối email thất bại."),
        latencyMs: resolveLatencyMs(start),
      });
    }
  }

  if (normalized.type === "sms") {
    const provider = getSmsProvider(settings, {
      provider: toNullableTrimmedString(normalized.config.provider),
      apiKey: toNullableTrimmedString(normalized.config.apiKey),
      accountSid: toNullableTrimmedString(normalized.config.accountSid),
      authToken: toNullableTrimmedString(normalized.config.authToken),
      fromNumber: toNullableTrimmedString(normalized.config.fromNumber),
    });

    const testPhone = toNullableTrimmedString(normalized.config.testPhone ?? normalized.config.phone);
    if (!testPhone) {
      return jsonResponse({
        success: false,
        message: "Thiếu số điện thoại nhận test SMS.",
        latencyMs: resolveLatencyMs(start),
      });
    }

    try {
      await provider.send(testPhone, "NexCRM test SMS connection.");
      return jsonResponse({
        success: true,
        message: "Kết nối SMS thành công.",
        latencyMs: resolveLatencyMs(start),
      });
    } catch (error) {
      return jsonResponse({
        success: false,
        message: providerError(error, "Kết nối SMS thất bại."),
        latencyMs: resolveLatencyMs(start),
      });
    }
  }

  const endpoint =
    toNullableTrimmedString(normalized.config.endpoint) ??
    toNullableTrimmedString(normalized.config.pos_api_endpoint) ??
    toNullableTrimmedString(settings.pos_api_endpoint);
  const apiKey =
    toNullableTrimmedString(normalized.config.apiKey) ??
    toNullableTrimmedString(normalized.config.pos_api_key) ??
    toNullableTrimmedString(settings.pos_api_key);

  if (!endpoint) {
    return errorResponse(400, "Thiếu endpoint POS để kiểm tra kết nối.");
  }

  const endpointCheck = await validateOutboundEndpoint(endpoint);
  if (!endpointCheck.ok) {
    return errorResponse(400, `Endpoint POS bị chặn bởi chính sách SSRF: ${endpointCheck.message}`);
  }

  try {
    const response = await pingEndpoint(endpointCheck.url.toString(), apiKey);
    if (response.ok) {
      return jsonResponse({
        success: true,
        message: "Kết nối POS thành công.",
        latencyMs: resolveLatencyMs(start),
      });
    }

    const errorText = await response.text();
    return jsonResponse({
      success: false,
      message: errorText || `POS endpoint trả về HTTP ${response.status}.`,
      latencyMs: resolveLatencyMs(start),
    });
  } catch (error) {
    return jsonResponse({
      success: false,
      message: providerError(error, "Không thể kết nối POS endpoint."),
      latencyMs: resolveLatencyMs(start),
    });
  }
}
