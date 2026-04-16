import { beforeEach, describe, expect, it, vi } from "vitest";

const mockResetPasswordForEmail = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
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
    return {
      kind: "unknown",
      message,
      technicalMessage: message,
      retryable: false,
    };
  },
  isMissingRpcFunctionError: vi.fn(() => false),
}));

describe("requestPasswordReset flow", () => {
  beforeEach(() => {
    vi.resetModules();
    mockResetPasswordForEmail.mockReset();
    mockRpc.mockReset();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockRpc.mockResolvedValue({ data: null, error: null });

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        location: {
          origin: "http://localhost:5173",
        },
      },
    });
  });

  it("sends only one request when the user triggers reset repeatedly while request is pending", async () => {
    let resolveRequest: ((value: { error: null }) => void) | null = null;
    const pendingRequest = new Promise<{ error: null }>((resolve) => {
      resolveRequest = resolve;
    });
    mockResetPasswordForEmail.mockReturnValueOnce(pendingRequest);

    const { requestPasswordReset } = await import("@/services/authService");

    const firstCall = requestPasswordReset("admin@nexcrm.vn");
    const secondCall = requestPasswordReset("admin@nexcrm.vn");

    await Promise.resolve();

    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);

    resolveRequest?.({ error: null });

    await expect(firstCall).resolves.toBe("admin@nexcrm.vn");
    await expect(secondCall).resolves.toBe("admin@nexcrm.vn");
  });

  it("blocks immediate resend with a validation error before calling Supabase again", async () => {
    const { requestPasswordReset } = await import("@/services/authService");

    await expect(requestPasswordReset("admin@nexcrm.vn")).resolves.toBe("admin@nexcrm.vn");
    await expect(requestPasswordReset("admin@nexcrm.vn")).rejects.toMatchObject({
      appKind: "validation",
      message: expect.stringContaining("Yêu cầu đặt lại mật khẩu vừa được gửi"),
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);
  });
});
