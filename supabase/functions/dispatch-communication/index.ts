const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Channel = "email" | "sms";

type EmailSettings = {
  provider: "resend" | null;
  enabled: boolean;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
};

type SmsSettings = {
  provider: "twilio" | null;
  enabled: boolean;
  sender_id?: string;
  from_number?: string;
};

type DispatchMessage = {
  customerId?: string | null;
  recipient: string;
  subject: string;
  content: string;
};

type RequestBody = {
  channel: Channel;
  settings: EmailSettings | SmsSettings;
  messages: DispatchMessage[];
};

type DispatchResult = {
  recipient: string;
  provider: string;
  status: "sent" | "delivered" | "failed";
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
};

function simulateStatus(channel: Channel, recipient: string): DispatchResult {
  const seed = [...recipient].reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
  const sentAt = new Date().toISOString();

  if (seed % 11 === 0) {
    return {
      recipient,
      provider: "simulation",
      status: "failed",
      error_message: "Provider chưa được cấu hình đầy đủ.",
      sent_at: null,
      opened_at: null,
      clicked_at: null,
    };
  }

  return {
    recipient,
    provider: "simulation",
    status: channel === "sms" && seed % 3 === 0 ? "delivered" : "sent",
    error_message: null,
    sent_at: sentAt,
    opened_at: null,
    clicked_at: null,
  };
}

async function sendEmail(
  settings: EmailSettings,
  messages: DispatchMessage[],
): Promise<DispatchResult[]> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!settings.enabled || settings.provider !== "resend" || !apiKey) {
    return messages.map((message) => simulateStatus("email", message.recipient));
  }

  const fromEmail = settings.from_email?.trim() || "onboarding@resend.dev";
  const fromName = settings.from_name?.trim() || "NexCRM";

  return Promise.all(
    messages.map(async (message) => {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${fromName} <${fromEmail}>`,
            to: [message.recipient],
            subject: message.subject,
            html: `<div style="font-family:Inter,Arial,sans-serif;line-height:1.6">${message.content.replaceAll("\n", "<br />")}</div>`,
            reply_to: settings.reply_to?.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return {
            recipient: message.recipient,
            provider: "resend",
            status: "failed" as const,
            error_message: errorText || "Resend trả về lỗi.",
            sent_at: null,
            opened_at: null,
            clicked_at: null,
          };
        }

        return {
          recipient: message.recipient,
          provider: "resend",
          status: "sent" as const,
          error_message: null,
          sent_at: new Date().toISOString(),
          opened_at: null,
          clicked_at: null,
        };
      } catch (error) {
        return {
          recipient: message.recipient,
          provider: "resend",
          status: "failed" as const,
          error_message: error instanceof Error ? error.message : "Không gửi được email.",
          sent_at: null,
          opened_at: null,
          clicked_at: null,
        };
      }
    }),
  );
}

async function sendSms(
  settings: SmsSettings,
  messages: DispatchMessage[],
): Promise<DispatchResult[]> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const envFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");
  const fromNumber = settings.from_number?.trim() || envFromNumber || "";

  if (!settings.enabled || settings.provider !== "twilio" || !accountSid || !authToken || !fromNumber) {
    return messages.map((message) => simulateStatus("sms", message.recipient));
  }

  const auth = btoa(`${accountSid}:${authToken}`);
  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

  return Promise.all(
    messages.map(async (message) => {
      try {
        const params = new URLSearchParams({
          To: message.recipient,
          From: fromNumber,
          Body: message.content,
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
          return {
            recipient: message.recipient,
            provider: "twilio",
            status: "failed" as const,
            error_message: errorText || "Twilio trả về lỗi.",
            sent_at: null,
            opened_at: null,
            clicked_at: null,
          };
        }

        return {
          recipient: message.recipient,
          provider: "twilio",
          status: "delivered" as const,
          error_message: null,
          sent_at: new Date().toISOString(),
          opened_at: null,
          clicked_at: null,
        };
      } catch (error) {
        return {
          recipient: message.recipient,
          provider: "twilio",
          status: "failed" as const,
          error_message: error instanceof Error ? error.message : "Không gửi được SMS.",
          sent_at: null,
          opened_at: null,
          clicked_at: null,
        };
      }
    }),
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as RequestBody;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!body.channel || !["email", "sms"].includes(body.channel) || !messages.length) {
      return Response.json(
        { error: "Payload gửi outbound không hợp lệ." },
        { status: 400, headers: corsHeaders },
      );
    }

    const results =
      body.channel === "email"
        ? await sendEmail(body.settings as EmailSettings, messages)
        : await sendSms(body.settings as SmsSettings, messages);

    return Response.json({ results }, { headers: corsHeaders });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Lỗi không xác định khi gửi outbound.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
