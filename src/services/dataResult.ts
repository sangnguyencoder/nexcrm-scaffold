import { z, type ZodTypeAny } from "zod";

import { useAuthStore } from "@/store/authStore";

export type ServiceError = {
  message: string;
  code?: string;
  details?: unknown;
};

export type CursorPage = {
  nextCursor: string | null;
  hasMore: boolean;
};

export type ServiceResult<T> = T & {
  data: T | null;
  error: ServiceError | null;
  page?: CursorPage;
};

function normalizeError(error: unknown): ServiceError {
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    const maybeCode = (error as { code?: unknown }).code;
    const maybeDetails = (error as { details?: unknown }).details;
    return {
      message: typeof maybeMessage === "string" ? maybeMessage : "Lỗi dịch vụ không xác định.",
      code: typeof maybeCode === "string" ? maybeCode : undefined,
      details: maybeDetails,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: "Lỗi dịch vụ không xác định." };
}

export function withSuccess<T>(value: T, page?: CursorPage): ServiceResult<T> {
  if (Array.isArray(value)) {
    return Object.assign(value, { data: value, error: null, page }) as ServiceResult<T>;
  }

  if (value && typeof value === "object") {
    return Object.assign(value as object, {
      data: value,
      error: null,
      page,
    }) as ServiceResult<T>;
  }

  return Object.assign({ data: value, error: null, page }, value as object) as ServiceResult<T>;
}

export function withFailure<T>(error: unknown, fallback: T): ServiceResult<T> {
  const normalized = normalizeError(error);

  if (Array.isArray(fallback)) {
    return Object.assign(fallback, { data: null, error: normalized }) as ServiceResult<T>;
  }

  if (fallback && typeof fallback === "object") {
    return Object.assign(fallback as object, {
      data: null,
      error: normalized,
    }) as ServiceResult<T>;
  }

  return { data: null, error: normalized } as ServiceResult<T>;
}

export async function toResult<T>(
  handler: () => Promise<T>,
  fallback: T,
  page?: CursorPage,
): Promise<ServiceResult<T>> {
  try {
    const data = await handler();
    return withSuccess(data, page);
  } catch (error) {
    return withFailure(error, fallback);
  }
}

export function validateInput<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown,
) {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { ok: true as const, data: parsed.data };
  }

  const issues = parsed.error.issues.map((issue) => issue.message).join(", ");
  return {
    ok: false as const,
    error: {
      message: issues || "Dữ liệu đầu vào không hợp lệ.",
      details: parsed.error.format(),
    } satisfies ServiceError,
  };
}

export function requireOrgId() {
  const orgId = useAuthStore.getState().orgId;
  if (!orgId) {
    return {
      ok: false as const,
      error: {
        message: "Thiếu ngữ cảnh tổ chức. Vui lòng đăng nhập lại.",
      } satisfies ServiceError,
    };
  }

  return { ok: true as const, orgId };
}

const cursorSchema = z.object({
  createdAt: z.string().min(1),
  id: z.string().min(1),
});

export function encodeCursor(input: { createdAt: string; id: string }) {
  return btoa(JSON.stringify(input));
}

export function decodeCursor(cursor?: string | null) {
  if (!cursor) {
    return null;
  }

  try {
    const parsed = JSON.parse(atob(cursor));
    const validated = cursorSchema.safeParse(parsed);
    if (!validated.success) {
      return null;
    }

    return validated.data;
  } catch {
    return null;
  }
}
