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
  type ServiceRequestOptions,
  runBestEffort,
  toUser,
  withAbortSignal,
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
  full_name?: string;
  role?: User["role"];
  department?: string;
  avatar_url?: string | null;
  is_active?: boolean;
  has_profile?: boolean;
};

type ManageProfileUserMutationResponse = {
  user: ManagedAuthUser;
};

type ManageProfileUserListResponse = {
  users: ManagedAuthUser[];
};

type ManageProfileUserDeleteResponse = {
  outcome: "deleted" | "deactivated";
  user: ManagedAuthUser;
};

type ProfileDirectoryRow = {
  id: string;
  full_name: string;
  role: User["role"];
  department: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
};

const PRIVILEGED_ROLES: User["role"][] = ["super_admin", "admin", "director"];

function isPrivilegedRole(role: User["role"] | null | undefined) {
  if (!role) {
    return false;
  }

  return PRIVILEGED_ROLES.includes(role);
}

function toManagedUser(managed: ManagedAuthUser): User {
  const role = managed.role ?? "sales";
  const fullName = managed.full_name?.trim() || managed.email || `user-${managed.id.slice(0, 8)}`;

  if (managed.email) {
    cacheProfileEmail(managed.id, managed.email);
  }

  return {
    id: managed.id,
    full_name: fullName,
    email: managed.email || getCachedProfileEmail(managed.id, ""),
    role,
    department: managed.department ?? "",
    is_active: managed.is_active ?? true,
    avatar_url: managed.avatar_url ?? getDefaultAvatarUrl(role),
    has_profile: managed.has_profile ?? true,
  };
}

async function fetchProfileRow(id: string, options: ServiceRequestOptions = {}) {
  const { data, error } = await withAbortSignal(
    supabase
      .from("profiles")
      .select("*")
      .eq("id", id),
    options.signal,
  ).single();

  if (error) {
    throw error;
  }

  return data;
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

function isPermissionDenied(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String(error.message ?? "") : "";
  const details = "details" in error ? String(error.details ?? "") : "";
  const code = "code" in error ? String(error.code ?? "") : "";
  const haystack = `${message} ${details} ${code}`.toLowerCase();

  return (
    haystack.includes("403") ||
    haystack.includes("forbidden") ||
    haystack.includes("không đủ quyền")
  );
}

async function readFunctionHttpErrorBody(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return { status: null, bodyText: "" };
  }

  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) {
    return { status: null, bodyText: "" };
  }

  let bodyText = "";
  try {
    bodyText = await context.clone().text();
  } catch {
    bodyText = "";
  }

  return {
    status: context.status,
    bodyText,
  };
}

function parseJsonSafely<T>(raw: string): T | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function isLegacyJwtVerificationError(error: unknown) {
  const name = typeof error === "object" && error !== null && "name" in error
    ? String(error.name ?? "")
    : "";
  if (name !== "FunctionsHttpError") {
    return false;
  }

  const { status, bodyText } = await readFunctionHttpErrorBody(error);
  const message = typeof error === "object" && error !== null && "message" in error
    ? String(error.message ?? "")
    : "";
  const haystack = `${bodyText} ${message}`.toLowerCase();

  return status === 401 && haystack.includes("invalid jwt");
}

async function invokeProfileAdminActionWithDelegatedAuthHeader<T>(
  payload: Record<string, unknown>,
) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw sessionError ?? new Error("Phiên đăng nhập không hợp lệ để thực thi thao tác quản trị.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/manage-profile-user`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "x-user-authorization": `Bearer ${sessionData.session.access_token}`,
    },
    body: JSON.stringify(payload),
  });

  const bodyText = await response.text();
  const parsedBody = parseJsonSafely<Record<string, unknown>>(bodyText);

  if (!response.ok) {
    const errorMessage =
      (parsedBody && typeof parsedBody.error === "string" && parsedBody.error) ||
      (parsedBody && typeof parsedBody.message === "string" && parsedBody.message) ||
      bodyText ||
      "Không thể gọi API quản trị người dùng.";
    throw new Error(errorMessage);
  }

  return (parsedBody ?? {}) as T;
}

async function invokeProfileAdminAction<T>(
  payload: Record<string, unknown>,
  options: { allowUnavailableFallback?: boolean } = {},
) {
  const { data, error } = await supabase.functions.invoke("manage-profile-user", {
    body: payload,
  });

  if (!error) {
    return data as T;
  }

  const originalError = error;
  const shouldRetryWithDelegatedAuth =
    (await isLegacyJwtVerificationError(originalError)) || isEdgeFunctionUnavailable(originalError);

  if (shouldRetryWithDelegatedAuth) {
    try {
      return await invokeProfileAdminActionWithDelegatedAuthHeader<T>(payload);
    } catch (delegatedError) {
      if (
        options.allowUnavailableFallback !== false &&
        (isEdgeFunctionUnavailable(originalError) || isEdgeFunctionUnavailable(delegatedError))
      ) {
        console.warn(
          "Supabase Edge Function manage-profile-user chưa sẵn sàng. Tạm fallback sang dữ liệu profiles.",
        );
        return null;
      }

      throw delegatedError;
    }
  }

  if (options.allowUnavailableFallback !== false && isEdgeFunctionUnavailable(originalError)) {
    console.warn(
      "Supabase Edge Function manage-profile-user chưa được deploy. Hệ thống đang fallback sang dữ liệu profiles.",
    );
    return null;
  }

  throw originalError;
}

async function createAuthUser(payload: ProfileCreateInput) {
  const managed = await invokeProfileAdminAction<ManageProfileUserMutationResponse>(
    {
      action: "create",
      email: payload.email,
      password: payload.password,
      full_name: payload.full_name,
      role: payload.role,
      department: payload.department,
    },
    { allowUnavailableFallback: false },
  );

  if (!managed?.user?.id) {
    throw new Error("Không nhận được phản hồi hợp lệ từ API quản trị người dùng.");
  }

  return managed.user;
}

async function syncAuthUser(id: string, payload: ProfileUpdateInput) {
  if (!payload.email && !payload.full_name && !payload.role && !payload.department) {
    return null;
  }

  const managed = await invokeProfileAdminAction<ManageProfileUserMutationResponse>(
    {
      action: "update",
      id,
      email: payload.email,
      full_name: payload.full_name,
      role: payload.role,
      department: payload.department,
    },
    { allowUnavailableFallback: false },
  );

  if (managed?.user?.id) {
    if (managed.user.email) {
      cacheProfileEmail(id, managed.user.email);
    }
    return managed.user;
  }

  if (payload.email) {
    cacheProfileEmail(id, payload.email);
  }

  return payload.email ? { id, email: payload.email } : null;
}

async function resetAuthUserPassword(id: string, password: string) {
  const managed = await invokeProfileAdminAction<ManageProfileUserMutationResponse>(
    {
      action: "reset_password",
      id,
      password,
    },
    { allowUnavailableFallback: false },
  );

  if (!managed?.user?.id) {
    throw new Error("Không nhận được phản hồi hợp lệ khi đặt lại mật khẩu người dùng.");
  }

  if (managed.user.email) {
    cacheProfileEmail(id, managed.user.email);
  }

  return managed.user;
}

async function deleteAuthUser(id: string) {
  const managed = await invokeProfileAdminAction<ManageProfileUserDeleteResponse>(
    {
      action: "delete",
      id,
    },
    { allowUnavailableFallback: false },
  );

  if (!managed?.user?.id || !managed.outcome) {
    throw new Error("Không nhận được phản hồi hợp lệ khi xử lý vòng đời tài khoản.");
  }

  if (managed.user.email) {
    cacheProfileEmail(id, managed.user.email);
  }

  return managed;
}

export const profileService = {
  getAll(options: ServiceRequestOptions = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const authUser = await getCurrentAuthUser();
        const currentUserId = authUser?.id ?? null;
        const currentUserEmail = (authUser?.email ?? getCachedProfileEmail(currentUserId ?? "", ""))
          .trim()
          .toLowerCase();

        let currentProfileRole: User["role"] | null = null;
        if (currentUserId) {
          try {
            const ownProfile = (await fetchProfileRow(currentUserId, options)) as ProfileRow;
            currentProfileRole = ownProfile.role;
          } catch {
            currentProfileRole = null;
          }
        }

        let managed: ManageProfileUserListResponse | null = null;
        try {
          managed = await invokeProfileAdminAction<ManageProfileUserListResponse>({
            action: "list",
            sync_missing_profiles: true,
          });
        } catch (error) {
          if (!isPermissionDenied(error)) {
            throw error;
          }
        }

        if (managed?.users?.length) {
          return managed.users.map(toManagedUser);
        }

        if (isPrivilegedRole(currentProfileRole)) {
          const { data, error } = await withAbortSignal(
            supabase.from("profiles").select("*"),
            options.signal,
          ).order("created_at", { ascending: true });

          if (error) {
            throw error;
          }

          return ((data ?? []) as ProfileRow[]).map((profile) => toUser(profile));
        }

        const { data, error } = await withAbortSignal(
          supabase.from("profiles_directory").select("*"),
          options.signal,
        ).order("created_at", { ascending: true });

        if (error) {
          throw error;
        }

        return ((data ?? []) as ProfileDirectoryRow[]).map((profile) => {
          const role = profile.role ?? "sales";
          const canViewEmail = profile.id === currentUserId;
          const normalizedEmail = canViewEmail
            ? currentUserEmail || getCachedProfileEmail(profile.id, "")
            : "";

          if (normalizedEmail) {
            cacheProfileEmail(profile.id, normalizedEmail);
          }

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: normalizedEmail,
            role,
            department: profile.department ?? "",
            is_active: profile.is_active ?? true,
            avatar_url: profile.avatar_url ?? getDefaultAvatarUrl(role),
            has_profile: true,
          };
        });
      })(),
    );
  },

  getById(id: string, options: ServiceRequestOptions = {}) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const row = await fetchProfileRow(id, options);
        return toUser(row);
      })(),
    );
  },

  create(payload: ProfileCreateInput) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const authUser = await createAuthUser(payload);
        const currentUser = await getCurrentAuthUser();
        const normalizedEmail = (authUser.email || payload.email || "").trim().toLowerCase();
        let savedUser = toManagedUser({
          ...authUser,
          email: normalizedEmail,
          full_name: authUser.full_name ?? payload.full_name,
          role: authUser.role ?? payload.role,
          department: authUser.department ?? payload.department,
          avatar_url: authUser.avatar_url ?? getDefaultAvatarUrl(authUser.role ?? payload.role),
          is_active: authUser.is_active ?? true,
          has_profile: authUser.has_profile ?? true,
        });

        if (!authUser.role || !authUser.department || authUser.has_profile === false) {
          const { data, error } = await supabase
            .from("profiles")
            .update({
              email: normalizedEmail || null,
              full_name: payload.full_name,
              role: payload.role,
              department: payload.department,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", authUser.id)
            .select("*")
            .maybeSingle();

          if (error) {
            throw error;
          }

          if (data) {
            savedUser = toUser(data, normalizedEmail);
          }
        }

        void runBestEffort("profile.create.audit", () =>
          createAuditLog({
            action: "create",
            entityType: "user",
            entityId: authUser.id,
            newData: {
              message: `Tạo thành viên ${payload.full_name}`,
              role: savedUser.role,
              department: savedUser.department,
              email: savedUser.email,
            },
            userId: currentUser?.id ?? null,
          }),
        );

        return savedUser;
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
        const normalizedEmail = (
          authUser?.email ??
          payload.email ??
          previous.email ??
          getCachedProfileEmail(id, "")
        )
          .trim()
          .toLowerCase();
        let savedUser: User;

        if (authUser?.id) {
          savedUser = toManagedUser({
            ...authUser,
            email: authUser.email ?? normalizedEmail,
            full_name: authUser.full_name ?? payload.full_name ?? previous.full_name,
            role: authUser.role ?? payload.role ?? previous.role,
            department: authUser.department ?? payload.department ?? previous.department ?? "",
            avatar_url: authUser.avatar_url ?? previous.avatar_url ?? getDefaultAvatarUrl(authUser.role ?? payload.role ?? previous.role),
            is_active: authUser.is_active ?? previous.is_active ?? true,
            has_profile: authUser.has_profile ?? true,
          });
        } else {
          const { data, error } = await supabase
            .from("profiles")
            .update({
              email: normalizedEmail || null,
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

          savedUser = toUser(data, normalizedEmail);
        }

        void runBestEffort("profile.update.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "user",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Cập nhật thành viên ${savedUser.full_name}`,
              role: savedUser.role,
              department: savedUser.department,
              email: savedUser.email,
            },
            userId: currentUser?.id ?? null,
          }),
        );

        return savedUser;
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

        void runBestEffort("profile.toggleActive.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "user",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Cập nhật trạng thái thành viên ${data.full_name}`,
              is_active: data.is_active,
            },
            userId: currentUser?.id ?? null,
          }),
        );

        return toUser(data, getCachedProfileEmail(id, ""));
      })(),
    );
  },

  resetPassword(id: string, password: string) {
    return withLatency(
      (async () => {
        ensureSupabaseConfigured();
        const previous = await fetchProfileRow(id);
        const currentUser = await getCurrentAuthUser();
        const authUser = await resetAuthUserPassword(id, password);

        void runBestEffort("profile.resetPassword.audit", () =>
          createAuditLog({
            action: "update",
            entityType: "user",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Đặt lại mật khẩu cho thành viên ${previous.full_name}`,
            },
            userId: currentUser?.id ?? null,
          }),
        );

        return {
          id: authUser.id,
          email: authUser.email ?? getCachedProfileEmail(id, ""),
        };
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
        const lifecycleResult = await deleteAuthUser(id);
        const cachedEmail = lifecycleResult.user.email ?? getCachedProfileEmail(id, "");

        if (lifecycleResult.outcome === "deactivated") {
          void runBestEffort("profile.delete.soft.audit", () =>
            createAuditLog({
              action: "update",
              entityType: "user",
              entityId: id,
              oldData: previous as unknown as Record<string, unknown>,
              newData: {
                message: `Vô hiệu hóa thành viên ${previous.full_name} do còn liên kết dữ liệu`,
                is_active: false,
              },
              userId: currentUser?.id ?? null,
            }),
          );

          return {
            outcome: "deactivated" as const,
            user: toManagedUser(lifecycleResult.user),
          };
        }

        void runBestEffort("profile.delete.audit", () =>
          createAuditLog({
            action: "delete",
            entityType: "user",
            entityId: id,
            oldData: previous as unknown as Record<string, unknown>,
            newData: {
              message: `Xóa thành viên ${previous.full_name}`,
            },
            userId: currentUser?.id ?? null,
          }),
        );

        return {
          outcome: "deleted" as const,
          user: toUser(previous, cachedEmail),
        };
      })(),
    );
  },
};
