/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAppMutation } from "@/hooks/useAppMutation";

const { toastMock } = vi.hoisted(() => ({
  toastMock: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

describe("useAppMutation", () => {
  it("captures retryable errors and retries the last variables successfully", async () => {
    let shouldFail = true;
    const mutationFn = vi.fn(async (value: string) => {
      if (shouldFail) {
        throw new Error("Failed to fetch");
      }

      return `saved:${value}`;
    });

    const { result } = renderHook(
      () =>
        useAppMutation<string, string>({
          action: "customer.save",
          errorMessage: "Không thể lưu khách hàng.",
          mutationFn,
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.mutateAsync("payload").catch(() => undefined);
    });

    await waitFor(() => expect(result.current.actionError?.kind).toBe("network"));
    expect(result.current.canRetry).toBe(true);
    expect(toastMock.error).toHaveBeenCalledWith(
      "Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng và thử lại.",
    );

    shouldFail = false;

    await act(async () => {
      await result.current.retryLast();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.actionError).toBeNull();
    expect(mutationFn).toHaveBeenCalledTimes(2);
  });

  it("times out mutations and releases loading state", async () => {
    vi.useFakeTimers();

    const { result } = renderHook(
      () =>
        useAppMutation({
          action: "ticket.save",
          errorMessage: "Không thể cập nhật ticket.",
          timeoutMs: 20,
          mutationFn: () => new Promise(() => undefined),
        }),
      { wrapper: createWrapper() },
    );

    let pendingPromise: Promise<unknown> | undefined;

    act(() => {
      pendingPromise = result.current.mutateAsync(undefined).catch(() => undefined);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
      await pendingPromise;
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.actionError?.kind).toBe("timeout");
    expect(toastMock.error).toHaveBeenCalledWith("Yêu cầu đang mất quá lâu để hoàn tất. Vui lòng thử lại.");
  });
});
