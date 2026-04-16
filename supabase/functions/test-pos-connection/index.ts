import {
  errorResponse,
  handleOptions,
  parseJsonBody,
} from "../_shared/common.ts";
import { handleTestConnection } from "../_shared/test-connection-handler.ts";

Deno.serve(async (request) => {
  const preflight = handleOptions(request);
  if (preflight) {
    return preflight;
  }

  if (request.method !== "POST") {
    return errorResponse(405, "Method không hợp lệ. Chỉ hỗ trợ POST.");
  }

  const parsed = await parseJsonBody<Record<string, unknown>>(request);
  if (parsed.error) {
    return errorResponse(400, parsed.error);
  }

  const body = parsed.data ?? {};
  const bridgedPayload = {
    type: "pos",
    orgId: body.orgId ?? body.org_id ?? null,
    config: {
      provider: body.provider ?? null,
      endpoint: body.endpoint ?? body.pos_api_endpoint ?? null,
      apiKey: body.apiKey ?? body.pos_api_key ?? null,
    },
  };

  const bridgedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(bridgedPayload),
  });

  return handleTestConnection(bridgedRequest);
});
