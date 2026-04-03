import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    };

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = request.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return Response.json(
        { error: "Thiếu SUPABASE_URL, SUPABASE_ANON_KEY hoặc SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500, headers: corsHeaders },
      );
    }

    if (!authHeader) {
      return Response.json({ error: "Thiếu Authorization header." }, { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
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

    if (profileError || !actorProfile || !["super_admin", "admin"].includes(actorProfile.role)) {
      return Response.json({ error: "Không đủ quyền để quản lý tài khoản người dùng." }, { status: 403, headers: corsHeaders });
    }

    if (body.action === "create") {
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
