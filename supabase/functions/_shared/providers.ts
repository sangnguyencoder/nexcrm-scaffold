import {
  normalizeErrorMessage,
  toNullableTrimmedString,
  toTrimmedString,
  type JsonObject,
} from "./common.ts";
import sanitizeHtml from "https://esm.sh/sanitize-html@2.17.0";

export type AppSettingsRecord = {
  email_provider?: string | null;
  email_api_key?: string | null;
  email_from_name?: string | null;
  email_from_address?: string | null;
  sms_provider?: string | null;
  sms_api_key?: string | null;
  pos_provider?: string | null;
  pos_api_endpoint?: string | null;
  pos_api_key?: string | null;
  timezone?: string | null;
};

export type MessageResult = {
  provider: string;
  messageId: string | null;
};

export interface EmailProvider {
  send(to: string, subject: string, html: string): Promise<MessageResult>;
}

export interface SmsProvider {
  send(to: string, content: string): Promise<MessageResult>;
}

class ResendProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  async send(to: string, subject: string, html: string): Promise<MessageResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Resend gửi thất bại.");
    }

    const payload = (await response.json().catch(() => ({}))) as JsonObject;
    const messageId = toNullableTrimmedString(payload.id ?? payload.message_id);

    return {
      provider: "resend",
      messageId,
    };
  }
}

class SendGridProvider implements EmailProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fromEmail: string,
    private readonly fromName: string,
  ) {}

  async send(to: string, subject: string, html: string): Promise<MessageResult> {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: {
          email: this.fromEmail,
          name: this.fromName,
        },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "SendGrid gửi thất bại.");
    }

    const messageId = toNullableTrimmedString(response.headers.get("x-message-id"));
    return {
      provider: "sendgrid",
      messageId,
    };
  }
}

class UnsupportedEmailProvider implements EmailProvider {
  constructor(private readonly reason: string) {}

  async send(): Promise<MessageResult> {
    throw new Error(this.reason);
  }
}

class TwilioProvider implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly fromNumber: string,
  ) {}

  async send(to: string, content: string): Promise<MessageResult> {
    const auth = btoa(`${this.accountSid}:${this.authToken}`);
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;

    const params = new URLSearchParams({
      To: to,
      From: this.fromNumber,
      Body: content,
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Twilio gửi SMS thất bại.");
    }

    const payload = (await response.json().catch(() => ({}))) as JsonObject;
    const messageId = toNullableTrimmedString(payload.sid);

    return {
      provider: "twilio",
      messageId,
    };
  }
}

class UnsupportedSmsProvider implements SmsProvider {
  constructor(private readonly reason: string) {}

  async send(): Promise<MessageResult> {
    throw new Error(this.reason);
  }
}

export type EmailProviderOverrides = {
  provider?: string | null;
  apiKey?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
};

export function getEmailProvider(
  settings: AppSettingsRecord | null | undefined,
  overrides: EmailProviderOverrides = {},
): EmailProvider {
  const provider = toTrimmedString(overrides.provider ?? settings?.email_provider).toLowerCase() || "resend";
  const apiKey =
    toNullableTrimmedString(overrides.apiKey) ??
    toNullableTrimmedString(settings?.email_api_key) ??
    toNullableTrimmedString(Deno.env.get(provider === "sendgrid" ? "SENDGRID_API_KEY" : "RESEND_API_KEY"));

  const fromEmail =
    toNullableTrimmedString(overrides.fromEmail) ??
    toNullableTrimmedString(settings?.email_from_address) ??
    toNullableTrimmedString(Deno.env.get("RESEND_FROM_EMAIL")) ??
    "onboarding@resend.dev";
  const fromName =
    toNullableTrimmedString(overrides.fromName) ??
    toNullableTrimmedString(settings?.email_from_name) ??
    "NexCRM";

  if (!apiKey) {
    return new UnsupportedEmailProvider("Thiếu API key cho email provider.");
  }

  if (provider === "resend") {
    return new ResendProvider(apiKey, fromEmail, fromName);
  }

  if (provider === "sendgrid") {
    return new SendGridProvider(apiKey, fromEmail, fromName);
  }

  if (provider === "smtp") {
    return new UnsupportedEmailProvider("SMTP provider chưa được triển khai trong Edge Function.");
  }

  return new UnsupportedEmailProvider(`Email provider '${provider}' không được hỗ trợ.`);
}

export type SmsProviderOverrides = {
  provider?: string | null;
  apiKey?: string | null;
  accountSid?: string | null;
  authToken?: string | null;
  fromNumber?: string | null;
};

function parseTwilioKey(raw: string | null): { accountSid: string | null; authToken: string | null } {
  if (!raw) {
    return { accountSid: null, authToken: null };
  }

  const value = raw.trim();
  if (!value) {
    return { accountSid: null, authToken: null };
  }

  const parts = value.split(":", 2);
  if (parts.length === 2) {
    return {
      accountSid: toNullableTrimmedString(parts[0]),
      authToken: toNullableTrimmedString(parts[1]),
    };
  }

  return {
    accountSid: null,
    authToken: value,
  };
}

export function getSmsProvider(
  settings: AppSettingsRecord | null | undefined,
  overrides: SmsProviderOverrides = {},
): SmsProvider {
  const provider = toTrimmedString(overrides.provider ?? settings?.sms_provider).toLowerCase() || "twilio";
  const rawKey =
    toNullableTrimmedString(overrides.apiKey) ??
    toNullableTrimmedString(settings?.sms_api_key) ??
    toNullableTrimmedString(Deno.env.get("TWILIO_AUTH_TOKEN"));
  const parsed = parseTwilioKey(rawKey);

  const accountSid =
    toNullableTrimmedString(overrides.accountSid) ??
    parsed.accountSid ??
    toNullableTrimmedString(Deno.env.get("TWILIO_ACCOUNT_SID"));
  const authToken =
    toNullableTrimmedString(overrides.authToken) ??
    parsed.authToken ??
    toNullableTrimmedString(Deno.env.get("TWILIO_AUTH_TOKEN"));
  const fromNumber =
    toNullableTrimmedString(overrides.fromNumber) ??
    toNullableTrimmedString(Deno.env.get("TWILIO_FROM_NUMBER"));

  if (provider !== "twilio") {
    return new UnsupportedSmsProvider(`SMS provider '${provider}' chưa được hỗ trợ trong Edge Function.`);
  }

  if (!accountSid || !authToken || !fromNumber) {
    return new UnsupportedSmsProvider("Thiếu cấu hình Twilio (account SID, auth token hoặc from number).");
  }

  return new TwilioProvider(accountSid, authToken, fromNumber);
}

export function toHtmlBody(content: string): string {
  const sanitized = sanitizeHtml(content, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });
  const withBreaks = sanitized.replaceAll(/\r?\n/g, "<br />");
  return `<div style="font-family:DM Sans,Arial,sans-serif;line-height:1.6">${withBreaks}</div>`;
}

export function providerError(error: unknown, fallback: string): string {
  return normalizeErrorMessage(error, fallback);
}
