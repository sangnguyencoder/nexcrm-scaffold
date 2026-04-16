const ENCRYPTION_PREFIX = "enc:v1";

type SettingsWithSecrets = {
  email_api_key?: string | null;
  sms_api_key?: string | null;
  pos_api_key?: string | null;
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function getEncryptionSecret(): string | null {
  const secret = Deno.env.get("APP_SETTINGS_ENCRYPTION_KEY")?.trim();
  return secret || null;
}

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const encoded = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return crypto.subtle.importKey(
    "raw",
    hash,
    {
      name: "AES-GCM",
    },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecretValue(value: string): Promise<string> {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalized;
  }

  const secret = getEncryptionSecret();
  if (!secret) {
    throw new Error("Thiếu APP_SETTINGS_ENCRYPTION_KEY. Từ chối lưu plaintext secret.");
  }

  const key = await deriveAesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = new TextEncoder().encode(normalized);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    payload,
  );

  return `${ENCRYPTION_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptSecretValue(value: string): Promise<string> {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  if (!normalized.startsWith(`${ENCRYPTION_PREFIX}:`)) {
    return normalized;
  }

  const secret = getEncryptionSecret();
  if (!secret) {
    throw new Error("Thiếu APP_SETTINGS_ENCRYPTION_KEY để giải mã cấu hình bảo mật.");
  }

  const parts = normalized.split(":");
  if (parts.length !== 4) {
    throw new Error("Định dạng secret mã hóa không hợp lệ.");
  }

  const iv = fromBase64(parts[2]);
  const cipherBytes = fromBase64(parts[3]);
  const key = await deriveAesKey(secret);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    cipherBytes,
  );

  return new TextDecoder().decode(decrypted);
}

export async function maybeDecryptSecret(value: string | null | undefined): Promise<string | null> {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) {
    return null;
  }
  return decryptSecretValue(normalized);
}

export async function decryptAppSettingsSecrets<T extends SettingsWithSecrets>(settings: T): Promise<T> {
  return {
    ...settings,
    email_api_key: await maybeDecryptSecret(settings.email_api_key),
    sms_api_key: await maybeDecryptSecret(settings.sms_api_key),
    pos_api_key: await maybeDecryptSecret(settings.pos_api_key),
  };
}
