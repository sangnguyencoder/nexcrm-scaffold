import { supabase, setSupabaseSessionPersistence } from "@/lib/supabase";
import {
  isLikelyEmailIdentifier,
  normalizeLoginIdentifier,
} from "@/features/auth/login-validation";
import {
  createAppError,
  ensureSupabaseConfigured,
  isMissingRpcFunctionError,
} from "@/services/shared";

const PASSWORD_RESET_CLIENT_COOLDOWN_MS = 15_000;
const passwordResetInFlight = new Map<string, Promise<string>>();
const passwordResetLastSentAt = new Map<string, number>();

export async function resolveLoginIdentifier(identifier: string) {
  ensureSupabaseConfigured();

  const normalized = normalizeLoginIdentifier(identifier).toLowerCase();

  if (!normalized) {
    return null;
  }

  if (isLikelyEmailIdentifier(normalized)) {
    return normalized;
  }

  const { data, error } = await supabase.rpc("resolve_login_identifier", {
    input_identifier: normalized,
  });

  if (error) {
    if (isMissingRpcFunctionError(error)) {
      return null;
    }

    throw error;
  }

  return typeof data === "string" && data.trim() ? data.trim().toLowerCase() : null;
}

export async function signInWithGoogle(nextPath = "/dashboard", rememberMe = true) {
  ensureSupabaseConfigured();
  setSupabaseSessionPersistence(rememberMe);

  if (typeof window === "undefined") {
    throw createAppError({
      kind: "unknown",
      message: "Không thể khởi tạo đăng nhập Google trong môi trường hiện tại.",
    });
  }

  const redirectUrl = new URL("/login", window.location.origin);
  if (nextPath && nextPath.startsWith("/")) {
    redirectUrl.searchParams.set("next", nextPath);
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectUrl.toString(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });

  if (error) {
    throw error;
  }
}

export async function requestPasswordReset(identifier: string) {
  ensureSupabaseConfigured();

  const normalized = normalizeLoginIdentifier(identifier);
  const resolvedEmail =
    (await resolveLoginIdentifier(normalized)) ??
    (isLikelyEmailIdentifier(normalized) ? normalized.toLowerCase() : null);

  if (!resolvedEmail) {
    throw createAppError({
      kind: "validation",
      message: "Nhập email công việc hợp lệ để nhận liên kết đặt lại mật khẩu.",
    });
  }

  const previousSentAt = passwordResetLastSentAt.get(resolvedEmail);
  if (previousSentAt) {
    const elapsedMs = Date.now() - previousSentAt;
    if (elapsedMs < PASSWORD_RESET_CLIENT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((PASSWORD_RESET_CLIENT_COOLDOWN_MS - elapsedMs) / 1000);
      throw createAppError({
        kind: "validation",
        message: `Yêu cầu đặt lại mật khẩu vừa được gửi. Vui lòng chờ khoảng ${waitSeconds}s rồi thử lại.`,
      });
    }
  }

  const inFlightRequest = passwordResetInFlight.get(resolvedEmail);
  if (inFlightRequest) {
    return inFlightRequest;
  }

  if (typeof window === "undefined") {
    throw createAppError({
      kind: "unknown",
      message: "Không thể khởi tạo luồng đặt lại mật khẩu trong môi trường hiện tại.",
    });
  }

  const request = (async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
      redirectTo: new URL("/login?mode=recovery", window.location.origin).toString(),
    });

    if (error) {
      throw error;
    }

    passwordResetLastSentAt.set(resolvedEmail, Date.now());
    return resolvedEmail;
  })();

  passwordResetInFlight.set(resolvedEmail, request);

  try {
    return await request;
  } finally {
    passwordResetInFlight.delete(resolvedEmail);
  }
}
