import { dealService as dataLayerDealService } from "@/services/data-layer";
import type { Deal } from "@/types";

import type { DealFilters, ServiceRequestOptions } from "@/services/shared";

type DataLayerResult<T> = {
  data: T | null;
  error: { message?: string } | null;
  page?: { nextCursor: string | null; hasMore: boolean };
};

export type DealCreateInput = {
  title: string;
  customer_id: string;
  owner_id?: string;
  stage?: Deal["stage"];
  value?: number;
  probability?: number;
  expected_close_at?: string | null;
  description?: string;
};

export type DealUpdateInput = Partial<DealCreateInput>;

function unwrap<T>(result: DataLayerResult<T>, fallbackMessage: string): T {
  if (result.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  if (result.data == null) {
    throw new Error(fallbackMessage);
  }
  return result.data;
}

function mapDeal(row: Record<string, unknown>): Deal {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    customer_id: row.customer_id ? String(row.customer_id) : "",
    owner_id: row.assigned_to ? String(row.assigned_to) : "",
    stage:
      row.stage === "lead" ||
      row.stage === "qualified" ||
      row.stage === "proposal" ||
      row.stage === "negotiation" ||
      row.stage === "won" ||
      row.stage === "lost"
        ? row.stage
        : "lead",
    value: Number(row.value ?? 0),
    probability: Number(row.probability ?? 0),
    expected_close_at:
      (row.expected_close_date ? String(row.expected_close_date) : null) ??
      (row.expected_close_at ? String(row.expected_close_at) : null),
    description: row.description ? String(row.description) : "",
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

async function collectDeals(filters: DealFilters = {}) {
  const rows: Deal[] = [];
  let cursor: string | null = null;
  const maxIterations = 8;
  const pageLimit = 100;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const result = await dataLayerDealService.getList({
      stage:
        filters.stage &&
        filters.stage !== "all" &&
        (filters.stage === "lead" ||
          filters.stage === "qualified" ||
          filters.stage === "proposal" ||
          filters.stage === "negotiation" ||
          filters.stage === "won" ||
          filters.stage === "lost")
          ? filters.stage
          : undefined,
      assignedTo: filters.ownerId && filters.ownerId !== "all" ? filters.ownerId : undefined,
      customerId: filters.customerId || undefined,
      search: filters.search || undefined,
      limit: pageLimit,
      cursor,
    });

    const pageRows = unwrap(
      result as DataLayerResult<Array<Record<string, unknown>>>,
      "Không thể tải danh sách cơ hội.",
    ).map(mapDeal);
    rows.push(...pageRows);

    if (!result.page?.hasMore || !result.page.nextCursor) {
      break;
    }
    cursor = result.page.nextCursor;
  }

  return rows;
}

export const dealService = {
  async getList(filters: DealFilters = {}, options: ServiceRequestOptions = {}) {
    void options;
    return collectDeals(filters);
  },

  async getById(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerDealService.getById(id);
    return mapDeal(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không tìm thấy cơ hội."),
    );
  },

  async create(payload: DealCreateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerDealService.create({
      customer_id: payload.customer_id || null,
      title: payload.title,
      description: payload.description || "",
      stage: payload.stage || "lead",
      value: payload.value ?? 0,
      probability: payload.probability ?? 0,
      expected_close_date: payload.expected_close_at || null,
      assigned_to: payload.owner_id || null,
    });
    return mapDeal(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể tạo cơ hội."),
    );
  },

  async update(id: string, payload: DealUpdateInput, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerDealService.update(id, {
      customer_id: payload.customer_id ?? undefined,
      title: payload.title,
      description: payload.description,
      stage: payload.stage,
      value: payload.value,
      probability: payload.probability,
      expected_close_date: payload.expected_close_at ?? undefined,
      assigned_to: payload.owner_id ?? undefined,
    });
    return mapDeal(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể cập nhật cơ hội."),
    );
  },

  async updateStage(id: string, stage: Deal["stage"], options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerDealService.updateStage(id, stage);
    return mapDeal(
      unwrap(result as DataLayerResult<Record<string, unknown>>, "Không thể cập nhật giai đoạn cơ hội."),
    );
  },

  async delete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerDealService.softDelete(id);
    unwrap(result as DataLayerResult<{ id: string; deleted_at: string }>, "Không thể xóa cơ hội.");
  },

  async softDelete(id: string, options: ServiceRequestOptions = {}) {
    void options;
    const result = await dataLayerDealService.softDelete(id);
    return unwrap(
      result as DataLayerResult<{ id: string; deleted_at: string }>,
      "Không thể xóa mềm cơ hội.",
    );
  },
};
