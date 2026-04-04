import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getAppErrorDetails,
  runAsyncAction,
} from "@/services/shared";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("shared async action helpers", () => {
  it("classifies timeout, network, and validation errors distinctly", () => {
    expect(getAppErrorDetails(new Error("request timeout"))).toMatchObject({
      kind: "timeout",
      retryable: true,
    });
    expect(getAppErrorDetails(new Error("Failed to fetch"))).toMatchObject({
      kind: "network",
      retryable: true,
    });
    expect(getAppErrorDetails(new Error("Vui lòng nhập họ tên"))).toMatchObject({
      kind: "validation",
      retryable: false,
    });
  });

  it("rejects long-running actions with a timeout and logs technical context", async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const promise = runAsyncAction(
      {
        scope: "test",
        action: "slow-save",
        timeoutMs: 25,
        timeoutMessage: "Lưu thay đổi đang mất quá lâu.",
      },
      () => new Promise(() => undefined),
    );
    const rejection = expect(promise).rejects.toMatchObject({
      appKind: "timeout",
      message: "Lưu thay đổi đang mất quá lâu.",
    });

    await vi.advanceTimersByTimeAsync(25);
    await rejection;

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy.mock.calls[0]?.[0]).toContain("[async-action:test.slow-save]");
  });
});
