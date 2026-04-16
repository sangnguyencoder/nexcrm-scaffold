import {
  applyTemplate,
  ensureOrgAccess,
  errorResponse,
  formatDateForTemplate,
  handleOptions,
  isRecord,
  isUuid,
  jsonResponse,
  parseJsonBody,
  resolveCaller,
  sleep,
  toNullableTrimmedString,
  toTemplateMap,
  toTrimmedString,
} from "../_shared/common.ts";
import {
  getEmailProvider,
  getSmsProvider,
  providerError,
  toHtmlBody,
  type AppSettingsRecord,
} from "../_shared/providers.ts";
import { decryptAppSettingsSecrets } from "../_shared/secrets.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const BATCH_SIZE = 50;

type RequestBody = {
  campaign_id?: string;
  campaignId?: string;
  org_id?: string;
  orgId?: string;
};

type CampaignRow = {
  id: string;
  org_id: string;
  name: string;
  channel: "email" | "sms" | "both";
  subject: string | null;
  content: string | null;
  status: string;
  recipient_count: number;
};

type CampaignRecipientRow = {
  id: string;
  org_id: string;
  customer_id: string;
  channel: "email" | "sms";
  recipient_email: string | null;
  recipient_phone: string | null;
  personalized_payload: Record<string, unknown> | null;
};

type CustomerLite = {
  id: string;
  full_name: string;
  customer_code: string | null;
  email: string | null;
  phone: string | null;
};

function resolveCampaignId(body: RequestBody | null): string {
  return toTrimmedString(body?.campaign_id ?? body?.campaignId);
}

function resolveOrgId(body: RequestBody | null): string | null {
  return toNullableTrimmedString(body?.org_id ?? body?.orgId);
}

async function ensureRateLimit(adminClient: SupabaseClient, orgId: string, actorId: string | null) {
  const { data, error } = await adminClient.rpc("acquire_campaign_send_rate_limit", {
    p_org_id: orgId,
    p_actor_id: actorId,
    p_action: "send_campaign",
  });

  if (error) {
    throw error;
  }

  return data === true;
}

function buildTemplateMap(customer: CustomerLite | null, extra: unknown, timezone: string): Record<string, unknown> {
  return toTemplateMap(
    {
      name: customer?.full_name ?? "",
      customer_code: customer?.customer_code ?? "",
      date: formatDateForTemplate(new Date(), timezone),
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
    },
    extra,
  );
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
    requiredRoles: ["super_admin", "admin", "marketing"],
  });
  if (!resolved.ok) {
    return resolved.response;
  }

  const { context } = resolved;
  const bodyResult = await parseJsonBody<RequestBody>(request);
  if (bodyResult.error) {
    return errorResponse(400, bodyResult.error);
  }

  const campaignId = resolveCampaignId(bodyResult.data);
  if (!campaignId || !isUuid(campaignId)) {
    return errorResponse(400, "campaign_id phải là UUID hợp lệ.");
  }

  const requestedOrgId = resolveOrgId(bodyResult.data);
  if (requestedOrgId && !isUuid(requestedOrgId)) {
    return errorResponse(400, "org_id phải là UUID hợp lệ.");
  }

  const { data: campaignData, error: campaignError } = await context.adminClient
    .from("campaigns")
    .select("id, org_id, name, channel, subject, content, status, recipient_count")
    .eq("id", campaignId)
    .is("deleted_at", null)
    .maybeSingle();

  if (campaignError) {
    return errorResponse(400, "Không đọc được campaign.", campaignError);
  }
  if (!campaignData) {
    return errorResponse(404, "Campaign không tồn tại hoặc đã bị xóa mềm.");
  }

  const campaign = campaignData as CampaignRow;
  if (requestedOrgId && requestedOrgId !== campaign.org_id) {
    return errorResponse(400, "campaign_id không thuộc org_id được chỉ định.");
  }

  const orgAccessError = ensureOrgAccess(context, campaign.org_id);
  if (orgAccessError) {
    return orgAccessError;
  }

  let rateAllowed = false;
  try {
    rateAllowed = await ensureRateLimit(context.adminClient, campaign.org_id, context.userId);
  } catch (error) {
    return errorResponse(500, "Không kiểm tra được rate limit campaign.", error);
  }

  if (!rateAllowed) {
    return errorResponse(429, "Vượt giới hạn gửi chiến dịch: tối đa 1 campaign cho mỗi tổ chức trong 1 phút.");
  }

  const nowIso = new Date().toISOString();
  const { error: lockError } = await context.adminClient
    .from("campaigns")
    .update({
      status: "sending",
      updated_at: nowIso,
    })
    .eq("id", campaign.id)
    .eq("org_id", campaign.org_id)
    .is("deleted_at", null);

  if (lockError) {
    return errorResponse(400, "Không thể chuyển campaign sang trạng thái sending.", lockError);
  }

  const { data: settingsData, error: settingsError } = await context.adminClient
    .from("app_settings")
    .select("email_provider, email_api_key, email_from_name, email_from_address, sms_provider, sms_api_key, timezone")
    .eq("org_id", campaign.org_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (settingsError) {
    return errorResponse(400, "Không đọc được app settings của tổ chức.", settingsError);
  }

  const settings = await decryptAppSettingsSecrets((settingsData ?? {}) as AppSettingsRecord);
  const timezone = toNullableTrimmedString(settings.timezone) ?? "Asia/Ho_Chi_Minh";
  const emailProvider = getEmailProvider(settings);
  const smsProvider = getSmsProvider(settings);

  const errors: Array<{ recipient_id: string; reason: string; recipient: string | null; channel: string }> = [];
  let sentCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  let batchCount = 0;

  while (true) {
    const { data: recipientData, error: recipientError } = await context.adminClient
      .from("campaign_recipients")
      .select("id, org_id, customer_id, channel, recipient_email, recipient_phone, personalized_payload")
      .eq("org_id", campaign.org_id)
      .eq("campaign_id", campaign.id)
      .is("deleted_at", null)
      .in("status", ["pending", "queued"])
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (recipientError) {
      await context.adminClient
        .from("campaigns")
        .update({
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)
        .eq("org_id", campaign.org_id);
      return errorResponse(400, "Không đọc được danh sách recipients của campaign.", recipientError);
    }

    const recipients = (recipientData ?? []) as CampaignRecipientRow[];
    if (recipients.length === 0) {
      break;
    }

    batchCount += 1;

    const customerIds = Array.from(new Set(recipients.map((item) => item.customer_id)));
    const { data: customerData, error: customerError } = await context.adminClient
      .from("customers")
      .select("id, full_name, customer_code, email, phone")
      .eq("org_id", campaign.org_id)
      .in("id", customerIds);

    if (customerError) {
      await context.adminClient
        .from("campaigns")
        .update({
          status: "draft",
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id)
        .eq("org_id", campaign.org_id);
      return errorResponse(400, "Không đọc được hồ sơ khách hàng cho recipients.", customerError);
    }

    const customerMap = new Map(
      ((customerData ?? []) as CustomerLite[]).map((customer) => [customer.id, customer]),
    );

    for (const recipient of recipients) {
      const customer = customerMap.get(recipient.customer_id) ?? null;
      const values = buildTemplateMap(customer, recipient.personalized_payload, timezone);
      const subject = applyTemplate(campaign.subject ?? campaign.name ?? "NexCRM Campaign", values);
      const content = applyTemplate(campaign.content ?? "", values);
      const emailTo = toNullableTrimmedString(recipient.recipient_email) ?? toNullableTrimmedString(customer?.email);
      const phoneTo = toNullableTrimmedString(recipient.recipient_phone) ?? toNullableTrimmedString(customer?.phone);
      const now = new Date().toISOString();

      let provider = "";
      let providerMessageId: string | null = null;
      let status: "sent" | "failed" = "failed";
      let errorMessage: string | null = null;

      try {
        if (recipient.channel === "email") {
          if (!emailTo) {
            throw new Error("Recipient thiếu email để gửi chiến dịch.");
          }

          const result = await emailProvider.send(emailTo, subject, toHtmlBody(content));
          provider = result.provider;
          providerMessageId = result.messageId;
          status = "sent";
        } else if (recipient.channel === "sms") {
          if (!phoneTo) {
            throw new Error("Recipient thiếu số điện thoại để gửi chiến dịch.");
          }

          const result = await smsProvider.send(phoneTo, content);
          provider = result.provider;
          providerMessageId = result.messageId;
          status = "sent";
        } else {
          throw new Error(`Channel '${recipient.channel}' không hợp lệ.`);
        }
      } catch (error) {
        status = "failed";
        errorMessage = providerError(error, "Gửi tin nhắn chiến dịch thất bại.");
      }

      try {
        await context.adminClient.from("outbound_messages").insert({
          org_id: campaign.org_id,
          customer_id: recipient.customer_id,
          campaign_id: campaign.id,
          channel: recipient.channel,
          recipient_email: emailTo,
          recipient_phone: phoneTo,
          subject,
          content,
          status,
          sent_at: status === "sent" ? now : null,
          error_message: errorMessage,
          provider: provider || null,
          provider_message_id: providerMessageId,
          updated_at: now,
        });
      } catch {
        // Best-effort logging: giữ luồng xử lý campaign tiếp tục.
      }

      const recipientPatch =
        status === "sent"
          ? {
              status: "sent",
              delivered_at: now,
              failed_at: null,
              error_message: null,
              updated_at: now,
            }
          : {
              status: "failed",
              failed_at: now,
              error_message: errorMessage ?? "Gửi thất bại.",
              updated_at: now,
            };

      await context.adminClient
        .from("campaign_recipients")
        .update(recipientPatch)
        .eq("id", recipient.id)
        .eq("org_id", campaign.org_id);

      processedCount += 1;

      if (status === "sent") {
        sentCount += 1;
      } else {
        failedCount += 1;
        errors.push({
          recipient_id: recipient.id,
          reason: errorMessage ?? "Gửi chiến dịch thất bại.",
          recipient: emailTo ?? phoneTo,
          channel: recipient.channel,
        });
      }
    }

    // Giữ ổn định trong trường hợp campaign có số lượng recipient lớn.
    if (recipients.length === BATCH_SIZE) {
      await sleep(30);
    }
  }

  const finalizedAt = new Date().toISOString();
  const deliveryStatus = failedCount > 0 ? "sent_with_errors" : "sent";
  const { error: finalizeError } = await context.adminClient
    .from("campaigns")
    .update({
      status: deliveryStatus,
      sent_count: sentCount,
      failed_count: failedCount,
      recipient_count: processedCount,
      sent_at: finalizedAt,
      updated_at: finalizedAt,
    })
    .eq("id", campaign.id)
    .eq("org_id", campaign.org_id)
    .is("deleted_at", null);

  if (finalizeError) {
    return errorResponse(400, "Không thể cập nhật trạng thái cuối của campaign.", finalizeError);
  }

  return jsonResponse({
    success: failedCount === 0,
    campaign_id: campaign.id,
    org_id: campaign.org_id,
    batch_size: BATCH_SIZE,
    processed_batches: batchCount,
    processed_count: processedCount,
    sent_count: sentCount,
    failed_count: failedCount,
    delivery_status: deliveryStatus,
    errors,
  });
});
