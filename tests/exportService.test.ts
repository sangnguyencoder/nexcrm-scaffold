import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildExportFileName,
  createExportService,
  getExportRowCount,
  hasExportableRows,
  type ExportRequest,
} from "@/services/exportService";
import type { ReportSnapshot } from "@/services/reportService";

function createRevenueSnapshot(): ReportSnapshot {
  return {
    tab: "revenue",
    revenueSeries: [
      {
        period: "2026-04-01",
        revenue: 1250000,
        orders: 3,
        avg: 416667,
        growth: 12,
      },
    ],
    revenueTotal: 1250000,
    revenueAvg: 416667,
    maxOrder: 700000,
    pipelineValue: 2000000,
    winRate: 50,
  };
}

function createRequest(
  overrides: Partial<ExportRequest> = {},
): ExportRequest {
  return {
    tab: "revenue",
    from: "2026-04-01",
    to: "2026-04-04",
    groupBy: "day",
    format: "xlsx",
    snapshot: createRevenueSnapshot(),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("exportService", () => {
  it("exports Excel with a sanitized filename and filtered rows", async () => {
    const jsonToSheet = vi.fn().mockReturnValue({ worksheet: true });
    const bookNew = vi.fn().mockReturnValue({ workbook: true });
    const appendSheet = vi.fn();
    const writeFile = vi.fn();
    const service = createExportService({
      loadXlsx: async () =>
        ({
          utils: {
            json_to_sheet: jsonToSheet,
            book_new: bookNew,
            book_append_sheet: appendSheet,
          },
          writeFile,
        }) as never,
    });

    const request = createRequest();
    await service.exportReport(request);

    expect(jsonToSheet).toHaveBeenCalledWith([
      {
        "Kỳ": "2026-04-01",
        "Doanh thu": "1.250.000 ₫",
        "Đơn hàng": 3,
        "Trung bình / đơn": "416.667 ₫",
        "Tăng trưởng": "12%",
      },
    ]);
    expect(appendSheet).toHaveBeenCalledWith({ workbook: true }, { worksheet: true }, "revenue");
    expect(writeFile).toHaveBeenCalledWith(
      { workbook: true },
      "bao-cao-doanh-thu-2026-04-01-den-2026-04-04.xlsx",
    );
  });

  it("exports PDF with Unicode-capable font setup", async () => {
    const pdfApi = {
      addFileToVFS: vi.fn(),
      addFont: vi.fn(),
      setFont: vi.fn(),
      setFontSize: vi.fn(),
      text: vi.fn(),
      save: vi.fn(),
    };
    const jsPdfCtor = vi.fn();
    function MockJsPdf(options: unknown) {
      jsPdfCtor(options);
      return pdfApi;
    }
    const autoTable = vi.fn();
    const service = createExportService({
      loadJsPdf: async () => MockJsPdf as never,
      loadAutoTable: async () => autoTable as never,
      loadPdfFontBinary: async () => "font-binary",
    });

    const request = createRequest({ format: "pdf" });
    await service.exportReport(request);

    expect(jsPdfCtor).toHaveBeenCalled();
    expect(pdfApi.addFileToVFS).toHaveBeenCalledWith("NotoSans-Regular.ttf", "font-binary");
    expect(pdfApi.addFont).toHaveBeenCalledWith("NotoSans-Regular.ttf", "NotoSans", "normal");
    expect(autoTable).toHaveBeenCalledOnce();
    expect(pdfApi.save).toHaveBeenCalledWith("bao-cao-doanh-thu-2026-04-01-den-2026-04-04.pdf");
  });

  it("rejects early when there is no data to export", async () => {
    const loadXlsx = vi.fn();
    const service = createExportService({
      loadXlsx: loadXlsx as never,
    });
    const snapshot = {
      ...createRevenueSnapshot(),
      revenueSeries: [],
      revenueTotal: 0,
      revenueAvg: 0,
      maxOrder: 0,
    } satisfies ReportSnapshot;

    await expect(
      service.exportReport(
        createRequest({
          snapshot,
        }),
      ),
    ).rejects.toThrow("Không có dữ liệu để xuất với bộ lọc hiện tại.");
    expect(loadXlsx).not.toHaveBeenCalled();
    expect(getExportRowCount(snapshot)).toBe(0);
    expect(hasExportableRows(snapshot)).toBe(false);
  });

  it("fails with a timeout error and logs technical details when file generation hangs", async () => {
    vi.useFakeTimers();
    const logger = { error: vi.fn() };
    const service = createExportService({
      loadXlsx: () => new Promise(() => undefined),
      logger,
      timeoutMs: 10,
    });
    const exportPromise = service.exportReport(createRequest());
    const rejection = expect(exportPromise).rejects.toThrow(
      "Xuất file bị timeout sau 1 giây. Vui lòng thử lại.",
    );

    await vi.advanceTimersByTimeAsync(10);

    await rejection;
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error.mock.calls[0]?.[1]).toMatchObject({
      operation: "export",
      stage: "xlsx",
      tab: "revenue",
      rowCount: 1,
      timeoutMs: 10,
    });
  });

  it("builds a deterministic export filename", () => {
    expect(buildExportFileName(createRequest())).toBe(
      "bao-cao-doanh-thu-2026-04-01-den-2026-04-04.xlsx",
    );
  });
});
