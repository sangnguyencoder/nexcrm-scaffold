import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFunctionsInvoke = vi.fn();
const mockFrom = vi.fn();
const mockCreateClient = vi.fn();
const mockGetCurrentAuthUser = vi.fn();

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
    from: mockFrom,
  },
}));

vi.mock("@/lib/utils", () => ({
  getDefaultAvatarUrl: vi.fn((role: string) => `/avatar-${role}.svg`),
}));

vi.mock("@/services/shared", () => ({
  cacheProfileEmail: vi.fn(),
  createAuditLog: vi.fn(() => Promise.resolve()),
  ensureSupabaseConfigured: vi.fn(),
  getCachedProfileEmail: vi.fn((_id: string, fallback = "") => fallback),
  getCurrentAuthUser: (...args: unknown[]) => mockGetCurrentAuthUser(...args),
  runBestEffort: vi.fn(async (_label: string, action: () => Promise<unknown>) => action()),
  toUser: vi.fn(
    (
      profile: {
        id: string;
        full_name: string;
        role: string;
        department?: string | null;
        avatar_url?: string | null;
        is_active?: boolean | null;
      },
      email = "",
    ) => ({
      id: profile.id,
      full_name: profile.full_name,
      email,
      role: profile.role,
      department: profile.department ?? "",
      is_active: profile.is_active ?? true,
      avatar_url: profile.avatar_url ?? null,
      has_profile: true,
    }),
  ),
  withAbortSignal: vi.fn((query: unknown) => query),
  withLatency: vi.fn((promise: Promise<unknown>) => promise),
}));

function createSelectBuilder({
  rows,
}: {
  rows: unknown[];
}) {
  const builder = {
    eq: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: rows, error: null })),
    single: vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: rows[0] ?? null, error: null })),
    select: vi.fn(() => builder),
  };

  return builder;
}

describe("profileService.getAll visibility", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFunctionsInvoke.mockReset();
    mockFrom.mockReset();
    mockCreateClient.mockReset();
    mockGetCurrentAuthUser.mockReset();
  });

  it("keeps full email visibility for privileged roles", async () => {
    mockGetCurrentAuthUser.mockResolvedValue({
      id: "admin-id",
      email: "admin@nexcrm.vn",
    });

    mockFunctionsInvoke.mockResolvedValue({
      data: {
        users: [
          {
            id: "admin-id",
            email: "admin@nexcrm.vn",
            full_name: "Admin",
            role: "admin",
            department: "IT",
            is_active: true,
          },
          {
            id: "sales-id",
            email: "sales@nexcrm.vn",
            full_name: "Sales One",
            role: "sales",
            department: "Sales",
            is_active: true,
          },
        ],
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return createSelectBuilder({
          rows: [
            {
              id: "admin-id",
              email: "admin@nexcrm.vn",
              full_name: "Admin",
              role: "admin",
              department: "IT",
              avatar_url: null,
              is_active: true,
            },
          ],
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { profileService } = await import("@/services/profileService");
    const users = await profileService.getAll();

    expect(users).toHaveLength(2);
    expect(users[0]?.email).toBe("admin@nexcrm.vn");
    expect(users[1]?.email).toBe("sales@nexcrm.vn");
  });

  it("masks colleague emails for non-privileged roles", async () => {
    mockGetCurrentAuthUser.mockResolvedValue({
      id: "sales-id",
      email: "sales@nexcrm.vn",
    });

    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: {
        message: "Không đủ quyền để xem danh sách tài khoản người dùng.",
      },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return createSelectBuilder({
          rows: [
            {
              id: "sales-id",
              email: "sales@nexcrm.vn",
              full_name: "Sales One",
              role: "sales",
              department: "Sales",
              avatar_url: null,
              is_active: true,
            },
          ],
        });
      }

      if (table === "profiles_directory") {
        return createSelectBuilder({
          rows: [
            {
              id: "sales-id",
              full_name: "Sales One",
              role: "sales",
              department: "Sales",
              avatar_url: null,
              is_active: true,
            },
            {
              id: "marketing-id",
              full_name: "Marketing One",
              role: "marketing",
              department: "Marketing",
              avatar_url: null,
              is_active: true,
            },
          ],
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { profileService } = await import("@/services/profileService");
    const users = await profileService.getAll();

    expect(users).toHaveLength(2);
    expect(users.find((item) => item.id === "sales-id")?.email).toBe("sales@nexcrm.vn");
    expect(users.find((item) => item.id === "marketing-id")?.email).toBe("");
  });

  it("treats director as privileged for email visibility", async () => {
    mockGetCurrentAuthUser.mockResolvedValue({
      id: "director-id",
      email: "director@nexcrm.vn",
    });

    mockFunctionsInvoke.mockResolvedValue({
      data: {
        users: [
          {
            id: "director-id",
            email: "director@nexcrm.vn",
            full_name: "Director",
            role: "director",
            department: "Board",
            is_active: true,
          },
          {
            id: "cskh-id",
            email: "cskh@nexcrm.vn",
            full_name: "CSKH One",
            role: "cskh",
            department: "CSKH",
            is_active: true,
          },
        ],
      },
      error: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return createSelectBuilder({
          rows: [
            {
              id: "director-id",
              email: "director@nexcrm.vn",
              full_name: "Director",
              role: "director",
              department: "Board",
              avatar_url: null,
              is_active: true,
            },
          ],
        });
      }

      throw new Error(`Unexpected table ${table}`);
    });

    const { profileService } = await import("@/services/profileService");
    const users = await profileService.getAll();

    expect(users).toHaveLength(2);
    expect(users.find((item) => item.id === "director-id")?.email).toBe("director@nexcrm.vn");
    expect(users.find((item) => item.id === "cskh-id")?.email).toBe("cskh@nexcrm.vn");
  });
});
