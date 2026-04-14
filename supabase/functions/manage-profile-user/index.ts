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
    }
  | {
      action: "update";
      id: string;
      email?: string;
      full_name?: string;
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
  } | null;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role: "super_admin" | "admin" | "director" | "sales" | "cskh" | "marketing";
  department: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
};

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
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError || !actorProfile) {
      return Response.json({ error: "Không đủ quyền để quản lý tài khoản người dùng." }, { status: 403, headers: corsHeaders });
    }

    const isManager = ["super_admin", "admin"].includes(actorProfile.role);
    const canListUsers = isManager || actorProfile.role === "director";

    if (body.action === "list") {
      if (!canListUsers) {
        return Response.json({ error: "Không đủ quyền để xem danh sách tài khoản người dùng." }, { status: 403, headers: corsHeaders });
      }

      const syncMissingProfiles = body.sync_missing_profiles !== false;
      const authUsers = await listAllAuthUsers(adminClient);

      if (syncMissingProfiles) {
        const authUserIds = new Set(authUsers.map((user) => user.id));
        const { data: existingProfiles, error: existingProfilesError } = await adminClient
          .from("profiles")
          .select("id")
          .in("id", Array.from(authUserIds));

        if (existingProfilesError) {
          return Response.json({ error: existingProfilesError.message }, { status: 400, headers: corsHeaders });
        }

        const existingIds = new Set((existingProfiles ?? []).map((item) => String(item.id)));
        const missingProfiles = authUsers
          .filter((user) => !existingIds.has(user.id))
          .map((user) => ({
            id: user.id,
            full_name: deriveFallbackName(user),
            role: "sales",
            department: "Chưa phân bổ",
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
        }
      }

      const { data: profiles, error: profilesError } = await adminClient
        .from("profiles")
        .select("id,full_name,role,department,avatar_url,is_active");

      if (profilesError) {
        return Response.json({ error: profilesError.message }, { status: 400, headers: corsHeaders });
      }

      const profileMap = new Map(
        ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]),
      );

      const users = authUsers
        .map((authUser) => {
          const profile = profileMap.get(authUser.id);
          const fullName = profile?.full_name?.trim() || deriveFallbackName(authUser);

          return {
            id: authUser.id,
            email: authUser.email ?? "",
            full_name: fullName,
            role: profile?.role ?? "sales",
            department: profile?.department ?? "",
            avatar_url: profile?.avatar_url ?? null,
            is_active: profile?.is_active ?? true,
            has_profile: Boolean(profile),
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

      const { data, error } = await adminClient.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.full_name,
        },
      });

      if (error || !data.user) {
        return Response.json({ error: error?.message ?? "Không tạo được user." }, { status: 400, headers: corsHeaders });
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

    if (body.action === "update") {
      const updatePayload: {
        email?: string;
        user_metadata?: {
          full_name?: string;
        };
      } = {};

      if (body.email) {
        updatePayload.email = body.email;
      }

      if (body.full_name) {
        updatePayload.user_metadata = {
          full_name: body.full_name,
        };
      }

      const { data, error } = await adminClient.auth.admin.updateUserById(body.id, updatePayload);

      if (error || !data.user) {
        return Response.json({ error: error?.message ?? "Không cập nhật được user." }, { status: 400, headers: corsHeaders });
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

    if (body.action === "reset_password") {
      if (!body.password || body.password.length < 6) {
        return Response.json({ error: "Mật khẩu tối thiểu 6 ký tự." }, { status: 400, headers: corsHeaders });
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
