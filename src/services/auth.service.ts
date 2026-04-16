import type { Session, User } from "@supabase/supabase-js";

import {
  isLikelyEmailIdentifier,
  normalizeLoginIdentifier,
} from "@/features/auth/login-validation";
import {
  clearSupabaseStoredSession,
  setSupabaseSessionPersistence,
  supabase,
} from "@/services/supabase";
import type { Database } from "@/types/supabase.generated";

export type AuthProfile = Database["public"]["Tables"]["profiles"]["Row"];

type SignInResult = {
  session: Session;
  user: User;
  profile: AuthProfile | null;
};

type CurrentSessionResult = {
  session: Session;
  profile: AuthProfile | null;
};

export async function resolveLoginIdentifier(identifier: string) {
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
    return null;
  }

  return typeof data === "string" && data.trim() ? data.trim().toLowerCase() : null;
}

export async function getProfileByUserId(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as AuthProfile | null;
}

export async function signIn(identifier: string, password: string, rememberMe = true): Promise<SignInResult> {
  setSupabaseSessionPersistence(rememberMe);

  const resolvedEmail =
    (await resolveLoginIdentifier(identifier)) ??
    normalizeLoginIdentifier(identifier).toLowerCase();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: resolvedEmail,
    password,
  });

  if (error) {
    throw error;
  }

  const session = data.session;
  const user = data.user;
  if (!session || !user) {
    throw new Error("Đăng nhập không thành công do thiếu session.");
  }

  const profile = await getProfileByUserId(user.id);
  return { session, user, profile };
}

export async function signInWithGoogle(nextPath = "/dashboard", rememberMe = true) {
  setSupabaseSessionPersistence(rememberMe);

  if (typeof window === "undefined") {
    throw new Error("Không thể khởi tạo đăng nhập Google trong môi trường hiện tại.");
  }

  const redirectUrl = new URL("/login", window.location.origin);
  if (nextPath.startsWith("/")) {
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

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  clearSupabaseStoredSession();

  try {
    const { useAuthStore } = await import("@/store/authStore");
    useAuthStore.getState().clearAuth();
  } catch {
    // ignore optional circular import during teardown
  }

  try {
    const legacy = await import("@/stores/authStore");
    legacy.useAuthStore.getState().clearAuth();
  } catch {
    // ignore optional legacy bridge import
  }

  if (error) {
    throw error;
  }
}

export async function resetPassword(identifier: string) {
  const normalized = normalizeLoginIdentifier(identifier);
  const email =
    (await resolveLoginIdentifier(normalized)) ??
    (isLikelyEmailIdentifier(normalized) ? normalized.toLowerCase() : null);

  if (!email) {
    throw new Error("Nhập email công việc hợp lệ để nhận liên kết đặt lại mật khẩu.");
  }

  if (typeof window === "undefined") {
    throw new Error("Không thể gửi email đặt lại mật khẩu trong môi trường hiện tại.");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: new URL("/login?mode=recovery", window.location.origin).toString(),
  });

  if (error) {
    throw error;
  }

  return email;
}

export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) {
    throw error;
  }

  return data.user;
}

export async function getCurrentSession(): Promise<CurrentSessionResult | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw error;
  }

  const session = data.session;
  if (!session?.user) {
    return null;
  }

  const profile = await getProfileByUserId(session.user.id);
  return {
    session,
    profile,
  };
}
