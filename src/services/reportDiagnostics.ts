import type { ReportGroupBy, ReportTab } from "@/services/reportService";

export type ReportOperationContext = {
  operation: "query" | "export";
  stage: string;
  tab: ReportTab;
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  rowCount?: number;
  format?: "xlsx" | "pdf";
  timeoutMs?: number;
  timeZone?: string;
  durationMs?: number;
};

export type ReportLogger = {
  error: (message: string, meta: ReportOperationContext & { error: unknown }) => void;
};

export function getClientTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export const reportLogger: ReportLogger = {
  error(message, meta) {
    console.error(`[report-${meta.operation}] ${message}`, meta);
  },
};

export function createTimeoutError(label: string, timeoutMs: number) {
  return new Error(`${label} sau ${Math.max(1, Math.ceil(timeoutMs / 1000))} giây. Vui lòng thử lại.`);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = globalThis.setTimeout(() => reject(createTimeoutError(label, timeoutMs)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      globalThis.clearTimeout(timer);
    }
  }
}
