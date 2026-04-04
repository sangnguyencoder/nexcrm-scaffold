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

  if (typeof window === "undefined") {
    throw createAppError({
      kind: "unknown",
      message: "Không thể khởi tạo luồng đặt lại mật khẩu trong môi trường hiện tại.",
    });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(resolvedEmail, {
    redirectTo: new URL("/login?mode=recovery", window.location.origin).toString(),
  });

  if (error) {
    throw error;
  }

  return resolvedEmail;
}
