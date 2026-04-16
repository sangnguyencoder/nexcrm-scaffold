import { describe, expect, it } from "vitest";

import { toUser, type ProfileRow } from "@/services/shared";

describe("profile email mapping", () => {
  it("prefers email from profiles row when available", () => {
    const row: ProfileRow = {
      id: "user-1",
      email: "ADMIN@NEXCRM.VN",
      full_name: "Admin",
      role: "admin",
      department: "IT",
      avatar_url: null,
      is_active: true,
      last_login_at: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    };

    const mapped = toUser(row, "");
    expect(mapped.email).toBe("admin@nexcrm.vn");
  });

  it("falls back to provided email when profiles row has no email", () => {
    const row: ProfileRow = {
      id: "user-2",
      email: null,
      full_name: "Director",
      role: "director",
      department: "OPS",
      avatar_url: null,
      is_active: true,
      last_login_at: null,
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T00:00:00.000Z",
    };

    const mapped = toUser(row, "director@nexcrm.vn");
    expect(mapped.email).toBe("director@nexcrm.vn");
  });
});
