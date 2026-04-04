import { afterEach, describe, expect, it, vi } from "vitest";

import { createReportService, type ReportRequest } from "@/services/reportService";

type QueryPayload = {
  data: unknown[] | null;
  error: unknown | null;
};

type QueryBehavior = QueryPayload | Promise<QueryPayload>;

function createQueryBuilder(behavior: QueryBehavior) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => behavior),
  };

  return builder;
}

function createClient(
  resolvers: Record<string, QueryBehavior>,
) {
  return {
    from(table: string) {
      return createQueryBuilder(
        resolvers[table] ?? Promise.resolve({ data: [], error: null }),
      );
    },
  };
}

function createRequest(
  overrides: Partial<ReportRequest> = {},
): ReportRequest {
  return {
    tab: "revenue",
    from: "2026-04-01",
    to: "2026-04-04",
    groupBy: "day",
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("reportService", () => {
  it("surfaces backend failures with structured logging", async () => {
    const logger = { error: vi.fn() };
    const service = createReportService({
      client: createClient({
        transactions: Promise.resolve({
          data: null,
          error: new Error("db down"),
        }),
        deals: Promise.resolve({
          data: [],
          error: null,
        }),
      }),
      logger,
      ensureConfigured: () => undefined,
    });

    await expect(service.getSnapshot(createRequest())).rejects.toThrow("db down");
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error.mock.calls[0]?.[0]).toBe("report query failed");
    expect(logger.error.mock.calls[0]?.[1]).toMatchObject({
      operation: "query",
      stage: "transactions",
      tab: "revenue",
      from: "2026-04-01",
      to: "2026-04-04",
      groupBy: "day",
    });
  });

  it("times out hung report queries instead of leaving the UI pending forever", async () => {
    vi.useFakeTimers();
    const logger = { error: vi.fn() };
    const service = createReportService({
      client: createClient({
        transactions: new Promise(() => undefined),
        deals: Promise.resolve({
          data: [],
          error: null,
        }),
      }),
      logger,
      timeoutMs: 10,
      ensureConfigured: () => undefined,
    });

    const queryPromise = service.getSnapshot(createRequest());
    const rejection = expect(queryPromise).rejects.toThrow(
      "Tải dữ liệu báo cáo bị timeout sau 1 giây. Vui lòng thử lại.",
    );
    await vi.advanceTimersByTimeAsync(10);

    await rejection;
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error.mock.calls[0]?.[1]).toMatchObject({
      operation: "query",
      stage: "transactions",
      timeoutMs: 10,
    });
  });
});
