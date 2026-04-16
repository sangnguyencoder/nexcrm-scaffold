import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-user-authorization, x-client-info, apikey, content-type",
};

type RequestBody =
  | {
      action: "create";
      email: string;
      password: string;
      full_name: string;
      role?: string;
      department?: string;
    }
  | {
      action: "update";
      id: string;
      email?: string;
      full_name?: string;
      role?: string;
      department?: string;
      is_active?: boolean;
    }
  | {
      action: "reset_password";
      id: string;
      password: string;
    }
  | {
      action: "delete";
      id: string;
    }
  | {
      action: "list";
      sync_missing_profiles?: boolean;
    };

type AuthUserLite = {
  id: string;
  email: string | null;
  user_metadata?: {
    full_name?: string;
    role?: string;
    org_id?: string;
    department?: string;
  } | null;
};

type ProfileRow = {
  id: string;
  org_id: string;
  email: string | null;
  full_name: string;
  role: "super_admin" | "admin" | "director" | "sales" | "cskh" | "marketing";
  department: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
};

const USER_ROLES = [
  "super_admin",
  "admin",
  "director",
  "sales",
  "cskh",
  "marketing",
] as const;

type UserRole = (typeof USER_ROLES)[number];

function normalizeRole(role: string | undefined | null, fallback: UserRole = "sales"): UserRole {
  const normalized = (role ?? "").trim().toLowerCase();
  return (USER_ROLES as readonly string[]).includes(normalized)
    ? (normalized as UserRole)
    : fallback;
}

function normalizeDepartment(department: string | undefined | null) {
  return (department ?? "").trim() || "Chưa phân bổ";
}

function extractUserOrgId(user: AuthUserLite) {
  const raw = user.user_metadata?.org_id;
  if (typeof raw !== "string" || !raw.trim()) {
    return null;
  }

  return raw.trim();
}

function readBearerToken(header: string | null) {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (!scheme || !token || scheme.toLowerCase() !== "bearer") {
    return null;
  }

  return token;
}

function isForeignKeyViolation(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message = "message" in error ? String(error.message ?? "") : "";
  const details = "details" in error ? String(error.details ?? "") : "";
  const code = "code" in error ? String(error.code ?? "") : "";
  const haystack = `${message} ${details} ${code}`.toLowerCase();

  return haystack.includes("23503") || haystack.includes("foreign key");
}

function deriveFallbackName(user: AuthUserLite) {
  const metadataName = user.user_metadata?.full_name?.trim();
  if (metadataName) {
    return metadataName;
  }

  if (user.email) {
    const [localPart] = user.email.split("@");
    const normalized = localPart?.trim();
    if (normalized) {
      return normalized;
    }
  }

  return `user-${user.id.slice(0, 8)}`;
}

async function listAllAuthUsers(
  adminClient: ReturnType<typeof createClient>,
) {
  const users: AuthUserLite[] = [];
  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const batch = (data.users ?? []) as AuthUserLite[];
    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function getProfileInOrg(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  orgId: string,
) {
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, org_id, email, full_name, role, department, avatar_url, is_active")
    .eq("id", userId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ProfileRow | null;
}

async function countActiveSuperAdminsInOrg(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
) {
  const { count, error } = await adminClient
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = request.headers.get("Authorization");
    const delegatedAuthHeader = request.headers.get("x-user-authorization");
    const callerToken = readBearerToken(delegatedAuthHeader ?? authHeader);

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return Response.json(
        { error: "Thiếu SUPABASE_URL, SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!callerToken) {
      return Response.json({ error: "Thiếu hoặc sai định dạng Bearer token." }, { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${callerToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const [{ data: authData, error: authError }, body] = await Promise.all([
      userClient.auth.getUser(),
      request.json() as Promise<RequestBody>,
    ]);

    if (authError || !authData.user) {
      return Response.json({ error: "Không xác thực được người gọi." }, { status: 401, headers: corsHeaders });
    }

    const { data: actorProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("role, org_id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || !actorProfile) {
      return Response.json({ error: "Không đủ quyền để quản lý tài khoản người dùng." }, { status: 403, headers: corsHeaders });
    }

    const actorOrgId = typeof actorProfile.org_id === "string" ? actorProfile.org_id : "";
    if (!actorOrgId) {
      return Response.json({ error: "Không xác định được tổ chức của tài khoản quản trị." }, { status: 400, headers: corsHeaders });
    }

    const isManager = ["super_admin", "admin"].includes(actorProfile.role);
    const canListUsers = isManager || actorProfile.role === "director";

    if (body.action === "list") {
      if (!canListUsers) {
        return Response.json({ error: "Không đủ quyền để xem danh sách tài khoản người dùng." }, { status: 403, headers: corsHeaders });
      }

      const syncMissingProfiles = isManager && body.sync_missing_profiles !== false;
      const authUsers = await listAllAuthUsers(adminClient);
      const orgAuthUsers = authUsers.filter((user) => {
        const userOrgFromMetadata = extractUserOrgId(user);
        return userOrgFromMetadata === actorOrgId;
      });

      const loadProfiles = async () => adminClient
        .from("profiles")
        .select("id,org_id,email,full_name,role,department,avatar_url,is_active")
        .eq("org_id", actorOrgId)
        .is("deleted_at", null);

      const { data: profilesBeforeSync, error: profilesBeforeSyncError } = await loadProfiles();

      if (profilesBeforeSyncError) {
        return Response.json({ error: profilesBeforeSyncError.message }, { status: 400, headers: corsHeaders });
      }

      let profiles = (profilesBeforeSync ?? []) as ProfileRow[];
      const profileMap = new Map(
        profiles.map((profile) => [profile.id, profile]),
      );

      if (syncMissingProfiles) {
        const missingProfiles = orgAuthUsers
          .filter((user) => !profileMap.has(user.id))
          .map((user) => ({
            id: user.id,
            org_id: actorOrgId,
            email: user.email ? user.email.toLowerCase() : null,
            full_name: deriveFallbackName(user),
            role: normalizeRole(user.user_metadata?.role),
            department: normalizeDepartment(user.user_metadata?.department),
            avatar_url: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

        if (missingProfiles.length) {
          const { error: syncError } = await adminClient
            .from("profiles")
            .upsert(missingProfiles, { onConflict: "id", ignoreDuplicates: true });

          if (syncError) {
            return Response.json({ error: syncError.message }, { status: 400, headers: corsHeaders });
          }

          const { data: profilesAfterSync, error: profilesAfterSyncError } = await loadProfiles();
          if (profilesAfterSyncError) {
            return Response.json({ error: profilesAfterSyncError.message }, { status: 400, headers: corsHeaders });
          }

          profiles = (profilesAfterSync ?? []) as ProfileRow[];
        }
      }

      const authUserMap = new Map(orgAuthUsers.map((authUser) => [authUser.id, authUser]));
      const users = profiles
        .map((profile) => {
          const authUser = authUserMap.get(profile.id);
          const fullName = profile.full_name?.trim() || deriveFallbackName(authUser ?? { id: profile.id, email: profile.email });
          const email = (authUser?.email ?? profile.email ?? "").toLowerCase();

          return {
            id: profile.id,
            email,
            full_name: fullName,
            role: profile.role,
            department: profile.department ?? "",
            avatar_url: profile.avatar_url ?? null,
            is_active: profile.is_active ?? true,
            has_profile: true,
          };
        })
        .sort((left, right) => left.full_name.localeCompare(right.full_name, "vi"));

      return Response.json({ users }, { headers: corsHeaders });
    }

    if (!isManager) {
      return Response.json({ error: "Không đủ quyền để quản lý tài khoản người dùng." }, { status: 403, headers: corsHeaders });
    }

    if (body.action === "create") {
      if (!body.password || body.password.length < 6) {
        return Response.json({ error: "Mật khẩu tối thiểu 6 ký tự." }, { status: 400, headers: corsHeaders });
      }

      const role = normalizeRole(body.role);
      const department = normalizeDepartment(body.department);
      const normalizedEmail = body.email.trim().toLowerCase();

      const { data, error } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.full_name,
          org_id: actorOrgId,
          role,
          department,
          allow_org_autocreate: false,
        },
      });

      if (error || !data.user) {
        return Response.json({ error: error?.message ?? "Không tạo được user." }, { status: 400, headers: corsHeaders });
      }

      const { data: syncedProfile, error: profileSyncError } = await adminClient
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            org_id: actorOrgId,
            email: normalizedEmail,
            full_name: body.full_name,
            role,
            department,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        )
        .select("id,email,full_name,role,department,avatar_url,is_active")
        .maybeSingle();

      if (profileSyncError) {
        return Response.json({ error: profileSyncError.message }, { status: 400, headers: corsHeaders });
      }

      return Response.json(
        {
          user: {
            id: data.user.id,
            email: data.user.email?.toLowerCase() ?? normalizedEmail,
            full_name: syncedProfile?.full_name ?? body.full_name,
            role: normalizeRole(syncedProfile?.role ?? role),
            department: syncedProfile?.department ?? department,
            avatar_url: syncedProfile?.avatar_url ?? null,
            is_active: syncedProfile?.is_active ?? true,
            has_profile: true,
          },
        },
        { headers: corsHeaders },
      );
    }

    if (body.action === "update") {
      const targetProfile = await getProfileInOrg(adminClient, body.id, actorOrgId);
      if (!targetProfile) {
        return Response.json({ error: "Không tìm thấy thành viên trong tổ chức hiện tại." }, { status: 404, headers: corsHeaders });
      }

      const targetRole = normalizeRole(targetProfile.role);
      const nextRole = normalizeRole(body.role, targetRole);
      const nextDepartment = normalizeDepartment(body.department ?? targetProfile.department);
      const nextIsActive = typeof body.is_active === "boolean" ? body.is_active : (targetProfile.is_active ?? true);

      if (body.id === authData.user.id && targetRole === "super_admin" && nextRole !== "super_admin") {
        return Response.json(
          { error: "Super Admin không thể tự hạ quyền của chính mình." },
          { status: 400, headers: corsHeaders },
        );
      }

      if (body.id === authData.user.id && nextIsActive === false) {
        return Response.json(
          { error: "Không thể tự vô hiệu hóa tài khoản đang đăng nhập." },
          { status: 400, headers: corsHeaders },
        );
      }

      if (targetRole === "super_admin" && (nextRole !== "super_admin" || nextIsActive === false)) {
        const activeSuperAdmins = await countActiveSuperAdminsInOrg(adminClient, actorOrgId);
        if (activeSuperAdmins <= 1) {
          return Response.json(
            { error: "Không thể hạ quyền hoặc vô hiệu hóa Super Admin cuối cùng của tổ chức." },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      const updatePayload: {
        email?: string;
        user_metadata?: {
          full_name?: string;
          role?: string;
          department?: string;
        };
      } = {};

      if (body.email) {
        updatePayload.email = body.email.trim().toLowerCase();
      }

      if (body.full_name || body.role || body.department) {
        updatePayload.user_metadata = {
          full_name: body.full_name ?? targetProfile.full_name,
          role: nextRole,
          department: nextDepartment,
        };
      }

      let updatedAuthEmail: string | null = targetProfile.email;
      if (Object.keys(updatePayload).length > 0) {
        const { data, error } = await adminClient.auth.admin.updateUserById(body.id, updatePayload);
        if (error || !data.user) {
          return Response.json({ error: error?.message ?? "Không cập nhật được user." }, { status: 400, headers: corsHeaders });
        }

        updatedAuthEmail = data.user.email?.toLowerCase() ?? targetProfile.email;
      }

      const profilePatch = {
        email: body.email ? body.email.trim().toLowerCase() : updatedAuthEmail,
        full_name: body.full_name ?? targetProfile.full_name,
        role: nextRole,
        department: nextDepartment,
        is_active: nextIsActive,
        updated_at: new Date().toISOString(),
      };

      const { data: updatedProfile, error: profileUpdateError } = await adminClient
        .from("profiles")
        .update(profilePatch)
        .eq("id", body.id)
        .eq("org_id", actorOrgId)
        .is("deleted_at", null)
        .select("id,email,full_name,role,department,avatar_url,is_active")
        .maybeSingle();

      if (profileUpdateError || !updatedProfile) {
        return Response.json({ error: profileUpdateError?.message ?? "Không cập nhật được profile." }, { status: 400, headers: corsHeaders });
      }

      return Response.json(
        {
          user: {
            id: updatedProfile.id,
            email: updatedProfile.email?.toLowerCase() ?? "",
            full_name: updatedProfile.full_name,
            role: normalizeRole(updatedProfile.role),
            department: updatedProfile.department ?? "",
            avatar_url: updatedProfile.avatar_url ?? null,
            is_active: updatedProfile.is_active ?? true,
            has_profile: true,
          },
        },
        { headers: corsHeaders },
      );
    }

    if (body.action === "reset_password") {
      if (!body.password || body.password.length < 6) {
        return Response.json({ error: "Mật khẩu tối thiểu 6 ký tự." }, { status: 400, headers: corsHeaders });
      }

      const targetProfile = await getProfileInOrg(adminClient, body.id, actorOrgId);
      if (!targetProfile) {
        return Response.json({ error: "Không tìm thấy thành viên trong tổ chức hiện tại." }, { status: 404, headers: corsHeaders });
      }

      const { data, error } = await adminClient.auth.admin.updateUserById(body.id, {
        password: body.password,
      });

      if (error || !data.user) {
        return Response.json({ error: error?.message ?? "Không đặt lại được mật khẩu user." }, { status: 400, headers: corsHeaders });
      }

      return Response.json(
        {
          user: {
            id: data.user.id,
            email: data.user.email,
          },
        },
        { headers: corsHeaders },
      );
    }

    if (body.action === "delete") {
      if (body.id === authData.user.id) {
        return Response.json({ error: "Không thể tự xóa tài khoản đang đăng nhập." }, { status: 400, headers: corsHeaders });
      }

      const targetProfile = await getProfileInOrg(adminClient, body.id, actorOrgId);
      if (!targetProfile) {
        return Response.json({ error: "Không tìm thấy thành viên trong tổ chức hiện tại." }, { status: 404, headers: corsHeaders });
      }

      if (normalizeRole(targetProfile.role) === "super_admin") {
        const activeSuperAdmins = await countActiveSuperAdminsInOrg(adminClient, actorOrgId);
        if (activeSuperAdmins <= 1) {
          return Response.json(
            { error: "Không thể xóa Super Admin cuối cùng của tổ chức." },
            { status: 400, headers: corsHeaders },
          );
        }
      }

      const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(body.id);
      if (targetAuthError || !targetAuth.user) {
        return Response.json({ error: targetAuthError?.message ?? "Không tìm thấy tài khoản cần xóa." }, { status: 404, headers: corsHeaders });
      }

      const targetEmail = targetAuth.user.email ?? "";
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(body.id);

      if (!deleteError) {
        return Response.json(
          {
            outcome: "deleted",
            user: {
              id: body.id,
              email: targetEmail,
            },
          },
          { headers: corsHeaders },
        );
      }

      if (!isForeignKeyViolation(deleteError)) {
        return Response.json({ error: deleteError.message }, { status: 400, headers: corsHeaders });
      }

      const { data: deactivatedProfile, error: deactivateError } = await adminClient
        .from("profiles")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", body.id)
        .eq("org_id", actorOrgId)
        .is("deleted_at", null)
        .select("id,full_name,role,department,avatar_url,is_active")
        .maybeSingle();

      if (deactivateError || !deactivatedProfile) {
        return Response.json(
          { error: deactivateError?.message ?? "Không thể vô hiệu hóa tài khoản sau khi xóa thất bại." },
          { status: 400, headers: corsHeaders },
        );
      }

      return Response.json(
        {
          outcome: "deactivated",
          user: {
            id: deactivatedProfile.id,
            email: targetEmail,
            full_name: deactivatedProfile.full_name,
            role: deactivatedProfile.role,
            department: deactivatedProfile.department ?? "",
            avatar_url: deactivatedProfile.avatar_url,
            is_active: deactivatedProfile.is_active ?? false,
            has_profile: true,
          },
        },
        { headers: corsHeaders },
      );
    }

    return Response.json({ error: "Action không hợp lệ." }, { status: 400, headers: corsHeaders });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Lỗi không xác định.",
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
