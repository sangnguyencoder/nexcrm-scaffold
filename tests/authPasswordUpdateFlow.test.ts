import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUpdateUser = vi.fn();
const mockGetUser = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: mockUpdateUser,
      getUser: mockGetUser,
      resetPasswordForEmail: mockResetPasswordForEmail,
    },
    rpc: mockRpc,
  },
  setSupabaseSessionPersistence: vi.fn(),
}));

vi.mock("@/services/shared", () => ({
  createAppError: ({
    kind,
    message,
    technicalMessage,
    retryable,
    originalError,
  }: {
    kind: string;
    message: string;
    technicalMessage?: string;
    retryable?: boolean;
    originalError?: unknown;
  }) => {
    const error = new Error(message) as Error & {
      appKind?: string;
      retryable?: boolean;
      technicalMessage?: string;
      originalError?: unknown;
    };
    error.appKind = kind;
    error.retryable = retryable ?? false;
    error.technicalMessage = technicalMessage ?? message;
    error.originalError = originalError;
    return error;
  },
  ensureSupabaseConfigured: vi.fn(),
  getAppErrorDetails: (error: unknown, fallback = "Đã có lỗi xảy ra.") => {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message ?? fallback)
          : fallback;
    const technicalMessage =
      typeof error === "object" && error !== null && "details" in error
        ? `${message} ${(error as { details?: unknown }).details ?? ""}`.trim()
        : message;

    return {
      kind: "unknown",
      message,
      technicalMessage,
      retryable: false,
    };
  },
  isMissingRpcFunctionError: vi.fn(() => false),
}));

describe("updateCurrentUserPassword", () => {
  beforeEach(() => {
    vi.resetModules();
    mockUpdateUser.mockReset();
    mockGetUser.mockReset();
    mockResetPasswordForEmail.mockReset();
    mockRpc.mockReset();
  });

  it("retries when Supabase auth token lock race happens and then succeeds", async () => {
    mockUpdateUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: "lock:sb-demo", details: "stole it" },
      })
      .mockResolvedValueOnce({
        data: { user: { id: "u-1", email: "admin@nexcrm.vn" } },
        error: null,
      });

    const { updateCurrentUserPassword } = await import("@/services/authService");

    await expect(updateCurrentUserPassword("new-pass-123")).resolves.toMatchObject({
      id: "u-1",
      email: "admin@nexcrm.vn",
    });
    expect(mockUpdateUser).toHaveBeenCalledTimes(2);
  });

  it("falls back to getUser when updateUser succeeds but does not return user payload", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u-2", email: "owner@nexcrm.vn" } },
      error: null,
    });

    const { updateCurrentUserPassword } = await import("@/services/authService");

    await expect(updateCurrentUserPassword("new-pass-456")).resolves.toMatchObject({
      id: "u-2",
      email: "owner@nexcrm.vn",
    });
    expect(mockUpdateUser).toHaveBeenCalledTimes(1);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it("fails instead of reporting false success when lock race never resolves", async () => {
    mockUpdateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "lock:sb-demo", details: "stole it" },
    });

    const { updateCurrentUserPassword } = await import("@/services/authService");

    await expect(updateCurrentUserPassword("new-pass-789")).rejects.toMatchObject({
      message: expect.stringContaining("lock:sb-demo"),
    });
    expect(mockUpdateUser).toHaveBeenCalledTimes(3);
  });
});
