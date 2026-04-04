import { describe, expect, it } from "vitest";

import { getAuthErrorState } from "@/features/auth/auth-errors";
import {
  isLikelyEmailIdentifier,
  isValidLoginIdentifier,
  loginSchema,
  normalizeLoginIdentifier,
  passwordRecoverySchema,
} from "@/features/auth/login-validation";

describe("login validation helpers", () => {
  it("accepts both work email and internal username", () => {
    expect(isLikelyEmailIdentifier("admin@nexcrm.vn")).toBe(true);
    expect(isValidLoginIdentifier("admin@nexcrm.vn")).toBe(true);
    expect(isValidLoginIdentifier("nguyen.van.a")).toBe(true);
  });

  it("rejects malformed identifiers and trims input", () => {
    expect(normalizeLoginIdentifier("  admin@nexcrm.vn  ")).toBe("admin@nexcrm.vn");
    expect(isValidLoginIdentifier("bad identifier")).toBe(false);
    expect(
      loginSchema.safeParse({
        identifier: "bad identifier",
        password: "123456",
        rememberMe: true,
      }).success,
    ).toBe(false);
  });

  it("validates password recovery confirmation", () => {
    expect(
      passwordRecoverySchema.safeParse({
        password: "new-password",
        confirmPassword: "other-password",
      }).success,
    ).toBe(false);
  });
});

describe("auth error mapping", () => {
  it("maps invalid credentials to a safe inline password message", () => {
    expect(getAuthErrorState(new Error("Invalid login credentials"))).toMatchObject({
      field: "password",
      message: "Email hoặc username, mật khẩu không chính xác.",
    });
  });

  it("maps locked account and network errors clearly", () => {
    expect(getAuthErrorState(new Error("Tài khoản đang bị khóa"))).toMatchObject({
      field: "identifier",
      message: "Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.",
    });

    expect(getAuthErrorState(new Error("Failed to fetch"))).toMatchObject({
      message: "Không thể kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.",
    });
  });

  it("surfaces OAuth configuration problems separately", () => {
    expect(getAuthErrorState(new Error("Provider is not enabled"), "oauth")).toMatchObject({
      message: "Đăng nhập Google chưa được cấu hình trên môi trường này.",
    });
  });
});
