const ENCRYPTION_PREFIX = "enc:v1";

function getClientEncryptionKey(): string | null {
  const raw = import.meta.env.VITE_APP_SETTINGS_ENCRYPTION_KEY;
  if (typeof raw !== "string") {
    return null;
  }
  const normalized = raw.trim();
  return normalized || null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
}

export async function encryptSecretValue(value: string | null | undefined): Promise<string | null> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return null;
  }
  if (normalized.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalized;
  }

  const secret = getClientEncryptionKey();
  if (!secret) {
    throw new Error(
      "Thiếu VITE_APP_SETTINGS_ENCRYPTION_KEY. Từ chối lưu plaintext API key vào app_settings.",
    );
  }

  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(normalized),
  );

  return `${ENCRYPTION_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(cipher))}`;
}

export async function encryptAppSettingsSecrets<T extends Record<string, unknown>>(payload: T): Promise<T> {
  const next = { ...payload } as Record<string, unknown>;
  next.email_api_key = await encryptSecretValue(next.email_api_key as string | null | undefined);
  next.sms_api_key = await encryptSecretValue(next.sms_api_key as string | null | undefined);
  next.pos_api_key = await encryptSecretValue(next.pos_api_key as string | null | undefined);
  return next as T;
}
