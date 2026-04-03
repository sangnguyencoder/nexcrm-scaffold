import { createClient } from "@supabase/supabase-js";

import { supabase, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import { getDefaultAvatarUrl } from "@/lib/utils";
import type { User } from "@/types";

import {
  cacheProfileEmail,
  createAuditLog,
  ensureSupabaseConfigured,
  getCachedProfileEmail,
  getCurrentAuthUser,
  type ProfileRow,
  toUser,
  withLatency,
} from "@/services/shared";

export type ProfileCreateInput = {
  email: string;
  full_name: string;
  role: User["role"];
  department: string;
  password: string;
};

export type ProfileUpdateInput = Partial<
  Pick<ProfileCreateInput, "email" | "full_name" | "role" | "department">
>;

type ManagedAuthUser = {
  id: string;
  email: string;
};

type ManageProfileUserResponse = {
  user: ManagedAuthUser;
};

async function fetchProfileRow(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function createSignupClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: `nexcrm-signup-${crypto.randomUUID()}`,
    },
  });
}

function isEdgeFunctionUnavailable(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String(error.message ?? "") : "";
  const name = "name" in error ? String(error.name ?? "") : "";
  const details = "details" in error ? String(error.details ?? "") : "";
  const haystack = `${name} ${message} ${details}`.toLowerCase();

  return (
    haystack.includes("edge function") ||
    haystack.includes("failed to send a request") ||
    haystack.includes("404") ||
    haystack.includes("not found")
  );
}

async function invokeProfileAdminAction<T>(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("manage-profile-user", {
    body: payload,
  });

  if (error) {
    if (isEdgeFunctionUnavailable(error)) {
      console.warn(
        "Supabase Edge Function manage-profile-user chưa được deploy. Hệ thống đang fallback sang flow cũ ở frontend.",
      );
      return null;
    }

    throw error;
  }

  return data as T;
}

async function createAuthUser(payload: ProfileCreateInput) {
  const managed = await invokeProfileAdminAction<ManageProfileUserResponse>({
    action: "create",
    email: payload.email,
    password: payload.password,
    full_name: payload.full_name,
  });

  if (managed?.user?.id) {
    return managed.user;
  }

  const signupClient = createSignupClient();
  const { data: signUpData, error: signUpError } = await signupClient.auth.signUp({
    email: payload.email,
    password: payload.password,
    options: {
      data: {
        full_name: payload.full_name,
      },
    },
  });

  if (signUpError) {
    throw signUpError;
  }

  const authUserId = signUpData.user?.id;
  if (!authUserId) {
    throw new Error("Supabase không trả về user id sau khi tạo tài khoản.");
  }

  return {
    id: authUserId,
    email: signUpData.user?.email ?? payload.email,
  };
}

async function syncAuthUser(id: string, payload: ProfileUpdateInput) {
  if (!payload.email && !payload.full_name) {
    return null;
  }

  const managed = await invokeProfileAdminAction<ManageProfileUserResponse>({
    action: "update",
    id,
    email: payload.email,
    full_name: payload.full_name,
  });

  if (managed?.user?.email) {
    cacheProfileEmail(id, managed.user.email);
    return managed.user;
  }

  if (payload.email) {
    cacheProfileEmail(id, payload.email);
  }

  return payload.email ? { id, email: payload.email } : null;
}

export const profileService = {
  getAll() {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          throw error;
        }

        return ((data ?? []) as ProfileRow[]).map((profile) =>
          toUser(profile, getCachedProfileEmail(profile.id, "")),
        );
      })(),
    );
  },

  getById(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const row = await fetchProfileRow(id);
        return toUser(row, getCachedProfileEmail(id, ""));
      })(),
    );
  },

  create(payload: ProfileCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const authUser = await createAuthUser(payload);
        const currentUser = await getCurrentAuthUser();
        const { data, error } = await supabase
          .from("profiles")
          .insert({
            id: authUser.id,
            full_name: payload.full_name,
            role: payload.role,
            department: payload.department,
            avatar_url: getDefaultAvatarUrl(payload.role),
            is_active: true,
          })
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        cacheProfileEmail(authUser.id, authUser.email || payload.email);
        await createAuditLog({
          action: "create",
          entityType: "user",
          entityId: authUser.id,
          newData: {
            message: `Tạo thành viên ${payload.full_name}`,
            role: payload.role,
          },
          userId: currentUser?.id ?? null,
        });

        return toUser(data, authUser.email || payload.email);
      })(),
    );
  },

  update(id: string, payload: ProfileUpdateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchProfileRow(id);
        const currentUser = await getCurrentAuthUser();
        const authUser = await syncAuthUser(id, payload);
        const { data, error } = await supabase
          .from("profiles")
          .update({
            full_name: payload.full_name ?? previous.full_name,
            role: payload.role ?? previous.role,
            department: payload.department ?? previous.department,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "update",
          entityType: "user",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: {
            message: `Cập nhật thành viên ${data.full_name}`,
            role: data.role,
            department: data.department,
            email: authUser?.email ?? payload.email ?? getCachedProfileEmail(id, ""),
          },
          userId: currentUser?.id ?? null,
        });

        return toUser(data, authUser?.email ?? payload.email ?? getCachedProfileEmail(id, ""));
      })(),
    );
  },

  toggleActive(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchProfileRow(id);
        const currentUser = await getCurrentAuthUser();
        const { data, error } = await supabase
          .from("profiles")
          .update({
            is_active: !(previous.is_active ?? true),
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .select("*")
          .single();

        if (error) {
          throw error;
        }

        await createAuditLog({
          action: "update",
          entityType: "user",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: {
            message: `Cập nhật trạng thái thành viên ${data.full_name}`,
            is_active: data.is_active,
          },
          userId: currentUser?.id ?? null,
        });

        return toUser(data, getCachedProfileEmail(id, ""));
      })(),
    );
  },

  delete(id: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const currentUser = await getCurrentAuthUser();
        if (currentUser?.id === id) {
          throw new Error("Không thể xóa tài khoản đang đăng nhập.");
        }

        const previous = await fetchProfileRow(id);
        const { error } = await supabase.from("profiles").delete().eq("id", id);

        if (error) {
          const { data, error: fallbackError } = await supabase
            .from("profiles")
            .update({
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", id)
            .select("*")
            .single();

          if (fallbackError) {
            throw error;
          }

          await createAuditLog({
            action: "update",
            entityType: "user",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Vô hiệu hóa thành viên ${previous.full_name} vì còn liên kết dữ liệu`,
              is_active: false,
            },
            userId: currentUser?.id ?? null,
          });

          return { softDeleted: true, user: toUser(data, getCachedProfileEmail(id, "")) };
        }

        await createAuditLog({
          action: "delete",
          entityType: "user",
          entityId: id,
          oldData: previous as unknown as Record<string, unknown>,
          newData: {
            message: `Xóa thành viên ${previous.full_name}`,
          },
          userId: currentUser?.id ?? null,
        });

        return { softDeleted: false, user: toUser(previous, getCachedProfileEmail(id, "")) };
      })(),
    );
  },
};
