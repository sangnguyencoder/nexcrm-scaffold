const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "host.docker.internal",
  "gateway.docker.internal",
]);

type EndpointValidationResult =
  | { ok: true; url: URL }
  | { ok: false; message: string };

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      return null;
    }
    octets.push(value);
  }
  return octets;
}

function isPrivateIpv4(hostname: string): boolean {
  const octets = parseIpv4(hostname);
  if (!octets) {
    return false;
  }
  const [a, b] = octets;

  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;

  return false;
}

function isIpv6(hostname: string): boolean {
  return hostname.includes(":");
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (!isIpv6(normalized)) {
    return false;
  }

  if (normalized === "::1" || normalized === "::") {
    return true;
  }
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  ) {
    return true;
  }

  return false;
}

async function resolvePublicDns(hostname: string): Promise<string[]> {
  const addresses = new Set<string>();
  for (const recordType of ["A", "AAAA"] as const) {
    try {
      const records = await Deno.resolveDns(hostname, recordType);
      for (const item of records) {
        if (typeof item === "string" && item.trim()) {
          addresses.add(item.trim());
        }
      }
    } catch {
      // Ignore individual resolver errors; handled by final empty-check.
    }
  }

  return [...addresses];
}

export async function validateOutboundEndpoint(rawEndpoint: string): Promise<EndpointValidationResult> {
  const endpoint = rawEndpoint.trim();
  if (!endpoint) {
    return { ok: false, message: "Endpoint rỗng." };
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return { ok: false, message: "Endpoint không phải URL hợp lệ." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, message: "Chỉ cho phép endpoint HTTPS." };
  }

  if (url.username || url.password) {
    return { ok: false, message: "Không cho phép URL chứa username/password." };
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (!hostname) {
    return { ok: false, message: "Endpoint thiếu hostname." };
  }

  if (LOCAL_HOSTNAMES.has(hostname) || hostname.endsWith(".local")) {
    return { ok: false, message: "Endpoint nội bộ/localhost bị chặn bởi chính sách SSRF." };
  }

  if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return { ok: false, message: "Endpoint dùng private IP bị chặn bởi chính sách SSRF." };
  }

  if (!parseIpv4(hostname) && !isIpv6(hostname)) {
    const resolved = await resolvePublicDns(hostname);
    if (resolved.length === 0) {
      return { ok: false, message: "Không resolve được hostname endpoint." };
    }

    for (const resolvedAddress of resolved) {
      if (isPrivateIpv4(resolvedAddress) || isPrivateIpv6(resolvedAddress)) {
        return { ok: false, message: "Endpoint resolve tới private IP, bị chặn bởi chính sách SSRF." };
      }
    }
  }

  return { ok: true, url };
}

