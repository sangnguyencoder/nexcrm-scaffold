import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFunctionsInvoke = vi.fn();
const mockGetSession = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/lib/supabase", () => ({
  supabaseUrl: "https://demo.supabase.co",
  supabaseAnonKey: "anon-key",
  supabase: {
    functions: {
      invoke: mockFunctionsInvoke,
    },
    auth: {
      getSession: mockGetSession,
    },
    from: mockFrom,
  },
}));

vi.mock("@/lib/utils", () => ({
  getDefaultAvatarUrl: vi.fn(() => null),
}));

vi.mock("@/services/shared", () => ({
  cacheProfileEmail: vi.fn(),
  createAuditLog: vi.fn(() => Promise.resolve()),
  ensureSupabaseConfigured: vi.fn(),
  getCachedProfileEmail: vi.fn((_id: string, fallback = "") => fallback),
  getCurrentAuthUser: vi.fn(() =>
    Promise.resolve({
      id: "admin-id",
      full_name: "Admin",
      email: "admin@nexcrm.vn",
      role: "admin",
      department: "IT",
      is_active: true,
      avatar_url: null,
    })),
  runBestEffort: vi.fn(async (_label: string, action: () => Promise<unknown>) => action()),
  toUser: vi.fn((profile: { id: string; full_name: string; role: string; department?: string }) => ({
    id: profile.id,
    full_name: profile.full_name,
    email: "",
    role: profile.role,
    department: profile.department ?? "",
    is_active: true,
    avatar_url: null,
  })),
  withAbortSignal: vi.fn((query: unknown) => query),
  withLatency: vi.fn((promise: Promise<unknown>) => promise),
}));

function createProfilesQueryBuilder() {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() =>
      Promise.resolve({
        data: {
          id: "user-1",
          email: "user-1@nexcrm.vn",
          full_name: "User One",
          role: "sales",
          department: "Sales",
          avatar_url: null,
          is_active: true,
          last_login_at: null,
          created_at: "2026-04-01T00:00:00.000Z",
          updated_at: "2026-04-01T00:00:00.000Z",
        },
        error: null,
      }),
    ),
  };
  return builder;
}

describe("profileService.resetPassword", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFunctionsInvoke.mockReset();
    mockGetSession.mockReset();
    mockFrom.mockReset();
    mockCreateClient.mockReset();

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return createProfilesQueryBuilder();
      }

      throw new Error(`Unexpected table: ${table}`);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses delegated auth header fallback when function invoke returns legacy invalid jwt", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "invalid jwt",
        context: new Response('{"error":"invalid jwt"}', { status: 401 }),
      },
    });

    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: "session-token" } },
      error: null,
    });

    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            user: {
              id: "user-1",
              email: "user-1@nexcrm.vn",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { profileService } = await import("@/services/profileService");

    await expect(profileService.resetPassword("user-1", "12345678")).resolves.toMatchObject({
      id: "user-1",
      email: "user-1@nexcrm.vn",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws clear error when both invoke and delegated call are unavailable", async () => {
    mockFunctionsInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: "FunctionsFetchError",
        message: "Failed to send a request to the Edge Function",
        details: "not found",
      },
    });

    mockGetSession.mockResolvedValueOnce({
      data: { session: { access_token: "session-token" } },
      error: null,
    });

    const fetchMock = vi.fn(() => Promise.reject(new Error("fetch failed")));
    vi.stubGlobal("fetch", fetchMock);

    const { profileService } = await import("@/services/profileService");

    await expect(profileService.resetPassword("user-1", "12345678")).rejects.toMatchObject({
      message: expect.stringContaining("fetch failed"),
    });
  });
});
