import {
  applyTemplate,
  ensureOrgAccess,
  errorResponse,
  formatDateForTemplate,
  getDayRange,
  getMonthDay,
  getYearRange,
  handleOptions,
  isRecord,
  isUuid,
  jsonResponse,
  parseJsonBody,
  resolveCaller,
  toFiniteNumber,
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

type RequestBody = {
  org_id?: string;
  orgId?: string;
  rule_id?: string;
  ruleId?: string;
  manual?: boolean;
};

type AutomationRuleRow = {
  id: string;
  org_id: string;
  name: string;
  trigger_type: "birthday" | "inactive_days" | "after_purchase" | "new_customer";
  trigger_config: Record<string, unknown> | null;
  action_type: "send_email" | "send_sms";
  template_subject: string | null;
  template_content: string;
  is_active: boolean;
};

type CustomerCandidate = {
  id: string;
  full_name: string;
  customer_code: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth: string | null;
  customer_type: string | null;
  last_order_at: string | null;
  created_at: string;
};

type RuleExecutionSummary = {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ customer_id: string; reason: string }>;
};

const MAX_RULES_PER_RUN = 200;
const MAX_CUSTOMERS_PER_RULE = 500;

function resolveOrgId(body: RequestBody | null): string | null {
  return toNullableTrimmedString(body?.org_id ?? body?.orgId);
}

function resolveRuleId(body: RequestBody | null): string | null {
  return toNullableTrimmedString(body?.rule_id ?? body?.ruleId);
}

function resolveManual(body: RequestBody | null): boolean {
  return Boolean(body?.manual);
}

function resolveTriggerDays(config: Record<string, unknown> | null, fallback: number): number {
  const parsed = toFiniteNumber(config?.days);
  if (!parsed || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

async function selectCandidatesForRule(
  adminClient: SupabaseClient,
  orgId: string,
  rule: AutomationRuleRow,
  timezone: string,
): Promise<CustomerCandidate[]> {
  if (rule.trigger_type === "birthday") {
    const today = getMonthDay(new Date(), timezone);
    const { data, error } = await adminClient
      .from("customers")
      .select("id, full_name, customer_code, email, phone, date_of_birth, customer_type, last_order_at, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .not("date_of_birth", "is", null)
      .limit(MAX_CUSTOMERS_PER_RULE);

    if (error) {
      throw error;
    }

    return ((data ?? []) as CustomerCandidate[]).filter((customer) => getMonthDay(customer.date_of_birth ?? "", timezone) === today);
  }

  if (rule.trigger_type === "inactive_days") {
    const days = resolveTriggerDays(rule.trigger_config, 30);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await adminClient
      .from("customers")
      .select("id, full_name, customer_code, email, phone, date_of_birth, customer_type, last_order_at, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .neq("customer_type", "inactive")
      .lt("last_order_at", cutoff)
      .limit(MAX_CUSTOMERS_PER_RULE);

    if (error) {
      throw error;
    }

    return (data ?? []) as CustomerCandidate[];
  }

  if (rule.trigger_type === "after_purchase") {
    const days = resolveTriggerDays(rule.trigger_config, 3);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: transactions, error: transactionError } = await adminClient
      .from("transactions")
      .select("customer_id")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .eq("status", "completed")
      .gte("transaction_at", cutoff)
      .limit(5000);

    if (transactionError) {
      throw transactionError;
    }

    const customerIds = Array.from(
      new Set((transactions ?? []).map((row) => String((row as { customer_id: string }).customer_id))),
    );
    if (customerIds.length === 0) {
      return [];
    }

    const { data: customers, error: customerError } = await adminClient
      .from("customers")
      .select("id, full_name, customer_code, email, phone, date_of_birth, customer_type, last_order_at, created_at")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .in("id", customerIds.slice(0, MAX_CUSTOMERS_PER_RULE));

    if (customerError) {
      throw customerError;
    }

    return (customers ?? []) as CustomerCandidate[];
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await adminClient
    .from("customers")
    .select("id, full_name, customer_code, email, phone, date_of_birth, customer_type, last_order_at, created_at")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .gte("created_at", since)
    .limit(MAX_CUSTOMERS_PER_RULE);

  if (error) {
    throw error;
  }

  return (data ?? []) as CustomerCandidate[];
}

async function loadIdempotencySets(
  adminClient: SupabaseClient,
  orgId: string,
  rule: AutomationRuleRow,
  timezone: string,
): Promise<{ daySet: Set<string>; yearSet: Set<string> }> {
  const dayRange = getDayRange(timezone, new Date());
  const { data: todayRows, error: todayError } = await adminClient
    .from("outbound_messages")
    .select("customer_id")
    .eq("org_id", orgId)
    .eq("automation_rule_id", rule.id)
    .is("deleted_at", null)
    .gte("created_at", dayRange.start.toISOString())
    .lte("created_at", dayRange.end.toISOString());

  if (todayError) {
    throw todayError;
  }

  const daySet = new Set(
    (todayRows ?? [])
      .map((row) => toNullableTrimmedString((row as { customer_id?: string | null }).customer_id))
      .filter((value): value is string => Boolean(value)),
  );

  if (rule.trigger_type !== "birthday") {
    return { daySet, yearSet: new Set<string>() };
  }

  const yearRange = getYearRange(timezone, new Date());
  const { data: yearRows, error: yearError } = await adminClient
    .from("outbound_messages")
    .select("customer_id")
    .eq("org_id", orgId)
    .eq("automation_rule_id", rule.id)
    .is("deleted_at", null)
    .gte("created_at", yearRange.start.toISOString())
    .lte("created_at", yearRange.end.toISOString());

  if (yearError) {
    throw yearError;
  }

  const yearSet = new Set(
    (yearRows ?? [])
      .map((row) => toNullableTrimmedString((row as { customer_id?: string | null }).customer_id))
      .filter((value): value is string => Boolean(value)),
  );

  return { daySet, yearSet };
}

async function runRule(
  adminClient: SupabaseClient,
  rule: AutomationRuleRow,
  settings: AppSettingsRecord,
): Promise<RuleExecutionSummary> {
  const timezone = toNullableTrimmedString(settings.timezone) ?? "Asia/Ho_Chi_Minh";
  const candidates = await selectCandidatesForRule(adminClient, rule.org_id, rule, timezone);
  const { daySet, yearSet } = await loadIdempotencySets(adminClient, rule.org_id, rule, timezone);

  const channel = rule.action_type === "send_sms" ? "sms" : "email";
  const emailProvider = getEmailProvider(settings);
  const smsProvider = getSmsProvider(settings);

  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ customer_id: string; reason: string }> = [];

  for (const customer of candidates) {
    if (daySet.has(customer.id)) {
      skipped += 1;
      continue;
    }
    if (rule.trigger_type === "birthday" && yearSet.has(customer.id)) {
      skipped += 1;
      continue;
    }

    const values = toTemplateMap(
      {
        name: customer.full_name,
        customer_code: customer.customer_code ?? "",
        phone: customer.phone ?? "",
        email: customer.email ?? "",
        date: formatDateForTemplate(new Date(), timezone),
      },
      rule.trigger_config,
    );
    const subject = applyTemplate(rule.template_subject ?? `Automation - ${rule.name}`, values);
    const content = applyTemplate(rule.template_content, values);

    const recipientEmail = toNullableTrimmedString(customer.email);
    const recipientPhone = toNullableTrimmedString(customer.phone);
    const now = new Date().toISOString();

    let status: "sent" | "failed" = "failed";
    let provider = "";
    let providerMessageId: string | null = null;
    let failureReason: string | null = null;

    try {
      if (channel === "email") {
        if (!recipientEmail) {
          throw new Error("Khách hàng không có email.");
        }
        const result = await emailProvider.send(recipientEmail, subject, toHtmlBody(content));
        status = "sent";
        provider = result.provider;
        providerMessageId = result.messageId;
      } else {
        if (!recipientPhone) {
          throw new Error("Khách hàng không có số điện thoại.");
        }
        const result = await smsProvider.send(recipientPhone, content);
        status = "sent";
        provider = result.provider;
        providerMessageId = result.messageId;
      }
    } catch (error) {
      status = "failed";
      failureReason = providerError(error, "Không gửi được tin nhắn automation.");
    }

    await adminClient.from("outbound_messages").insert({
      org_id: rule.org_id,
      customer_id: customer.id,
      automation_rule_id: rule.id,
      channel,
      recipient_email: recipientEmail,
      recipient_phone: recipientPhone,
      subject,
      content,
      status,
      sent_at: status === "sent" ? now : null,
      error_message: failureReason,
      provider: provider || null,
      provider_message_id: providerMessageId,
      updated_at: now,
    });

    processed += 1;

    if (status === "sent") {
      sent += 1;
    } else {
      failed += 1;
      errors.push({
        customer_id: customer.id,
        reason: failureReason ?? "Lỗi gửi automation.",
      });
    }
  }

  await adminClient
    .from("automation_rules")
    .update({
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", rule.id)
    .eq("org_id", rule.org_id)
    .is("deleted_at", null);

  return {
    processed,
    sent,
    failed,
    skipped,
    errors,
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

  const requestedOrgId = resolveOrgId(bodyResult.data);
  const requestedRuleId = resolveRuleId(bodyResult.data);
  const manual = resolveManual(bodyResult.data);

  if (requestedOrgId && !isUuid(requestedOrgId)) {
    return errorResponse(400, "org_id không hợp lệ.");
  }
  if (requestedRuleId && !isUuid(requestedRuleId)) {
    return errorResponse(400, "rule_id không hợp lệ.");
  }

  if (!context.isServiceRole && requestedOrgId) {
    const accessError = ensureOrgAccess(context, requestedOrgId);
    if (accessError) {
      return accessError;
    }
  }

  let targetOrgIds: string[] = [];

  if (!context.isServiceRole) {
    targetOrgIds = [context.orgId as string];
  } else if (requestedOrgId) {
    targetOrgIds = [requestedOrgId];
  } else if (requestedRuleId) {
    const { data: ruleOrgRow, error: ruleOrgError } = await context.adminClient
      .from("automation_rules")
      .select("org_id")
      .eq("id", requestedRuleId)
      .is("deleted_at", null)
      .maybeSingle();

    if (ruleOrgError) {
      return errorResponse(400, "Không đọc được thông tin tổ chức của automation rule.", ruleOrgError);
    }
    if (!ruleOrgRow) {
      return errorResponse(404, "Automation rule không tồn tại.");
    }
    targetOrgIds = [String((ruleOrgRow as { org_id: string }).org_id)];
  } else {
    const { data, error } = await context.adminClient
      .from("automation_rules")
      .select("org_id")
      .eq("is_active", true)
      .is("deleted_at", null)
      .limit(5000);

    if (error) {
      return errorResponse(400, "Không đọc được danh sách tổ chức có automation.", error);
    }

    targetOrgIds = Array.from(
      new Set(
        (data ?? [])
          .map((row) => toNullableTrimmedString((row as { org_id?: string | null }).org_id))
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  if (targetOrgIds.length === 0) {
    return jsonResponse({
      success: true,
      processed: 0,
      processed_rules: 0,
      sent_count: 0,
      failed_count: 0,
      message: "Không có automation rules nào cần xử lý.",
      manual,
    });
  }

  const allRuleErrors: Array<{ org_id: string; rule_id: string; reason: string }> = [];
  let totalProcessed = 0;
  let totalSent = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let processedRules = 0;

  for (const orgId of targetOrgIds) {
    const { data: settingsData } = await context.adminClient
      .from("app_settings")
      .select("email_provider, email_api_key, email_from_name, email_from_address, sms_provider, sms_api_key, timezone")
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
  const settings = await decryptAppSettingsSecrets((settingsData ?? {}) as AppSettingsRecord);

    let ruleQuery = context.adminClient
      .from("automation_rules")
      .select(
        "id, org_id, name, trigger_type, trigger_config, action_type, template_subject, template_content, is_active",
      )
      .eq("org_id", orgId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("updated_at", { ascending: true })
      .limit(MAX_RULES_PER_RUN);

    if (requestedRuleId) {
      ruleQuery = ruleQuery.eq("id", requestedRuleId);
    }

    const { data: rulesData, error: rulesError } = await ruleQuery;
    if (rulesError) {
      allRuleErrors.push({
        org_id: orgId,
        rule_id: requestedRuleId ?? "unknown",
        reason: providerError(rulesError, "Không đọc được automation rules."),
      });
      continue;
    }

    const rules = (rulesData ?? []) as AutomationRuleRow[];
    for (const rule of rules) {
      try {
        const summary = await runRule(context.adminClient, rule, settings);
        totalProcessed += summary.processed;
        totalSent += summary.sent;
        totalFailed += summary.failed;
        totalSkipped += summary.skipped;
        processedRules += 1;
        for (const item of summary.errors) {
          allRuleErrors.push({
            org_id: orgId,
            rule_id: rule.id,
            reason: `[customer:${item.customer_id}] ${item.reason}`,
          });
        }
      } catch (error) {
        allRuleErrors.push({
          org_id: orgId,
          rule_id: rule.id,
          reason: providerError(error, "Không chạy được automation rule."),
        });
      }
    }
  }

  const success = totalFailed === 0;
  const message = success
    ? "Automation run hoàn tất."
    : "Automation run hoàn tất nhưng có bản ghi gửi thất bại.";

  const statusCode = allRuleErrors.some((item) => !item.reason.startsWith("[customer:")) ? 207 : 200;

  return jsonResponse(
    {
      success,
      manual,
      processed: totalProcessed,
      processed_rules: processedRules,
      sent_count: totalSent,
      failed_count: totalFailed,
      skipped_count: totalSkipped,
      errors: allRuleErrors,
      message,
    },
    statusCode,
  );
});
