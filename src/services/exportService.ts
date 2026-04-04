import { formatCurrency, sanitizeFileNameSegment } from "@/lib/utils";
import {
  getClientTimeZone,
  reportLogger,
  type ReportLogger,
  withTimeout,
} from "@/services/reportDiagnostics";
import type {
  ReportGroupBy,
  ReportSnapshot,
  ReportTab,
} from "@/services/reportService";

type ExportFormat = "xlsx" | "pdf";

export type ExportRequest = {
  tab: ReportTab;
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  format: ExportFormat;
  snapshot: ReportSnapshot;
};

type ExportColumn = {
  key: string;
  label: string;
  format: (row: Record<string, unknown>) => string | number;
};

type XlsxModule = typeof import("xlsx");
type JsPdfConstructor = typeof import("jspdf")["default"];
type AutoTable = typeof import("jspdf-autotable")["default"];

type ExportServiceDependencies = {
  loadXlsx?: () => Promise<XlsxModule>;
  loadJsPdf?: () => Promise<JsPdfConstructor>;
  loadAutoTable?: () => Promise<AutoTable>;
  loadPdfFontBinary?: () => Promise<string>;
  logger?: ReportLogger;
  timeoutMs?: number;
  getTimeZone?: () => string;
};

const DEFAULT_EXPORT_TIMEOUT_MS = 20_000;
const PDF_FONT_FILENAME = "NotoSans-Regular.ttf";
const PDF_FONT_NAME = "NotoSans";
const PDF_FONT_URL = new URL("../assets/fonts/NotoSans-Regular.ttf", import.meta.url).href;

function getFileBaseName(tab: ReportTab) {
  const label =
    tab === "revenue"
      ? "bao-cao-doanh-thu"
      : tab === "customers"
        ? "bao-cao-khach-hang"
        : tab === "tickets"
          ? "bao-cao-ticket"
          : "bao-cao-marketing";

  return sanitizeFileNameSegment(label);
}

export function buildExportFileName({ tab, from, to, format }: ExportRequest) {
  return `${getFileBaseName(tab)}-${sanitizeFileNameSegment(from)}-den-${sanitizeFileNameSegment(to)}.${format}`;
}

function getExportColumns(snapshot: ReportSnapshot): ExportColumn[] {
  if (snapshot.tab === "revenue") {
    return [
      { key: "period", label: "Kỳ", format: (row) => String(row.period ?? "") },
      { key: "revenue", label: "Doanh thu", format: (row) => formatCurrency(Number(row.revenue ?? 0)) },
      { key: "orders", label: "Đơn hàng", format: (row) => Number(row.orders ?? 0) },
      { key: "avg", label: "Trung bình / đơn", format: (row) => formatCurrency(Number(row.avg ?? 0)) },
      { key: "growth", label: "Tăng trưởng", format: (row) => `${Number(row.growth ?? 0)}%` },
    ];
  }

  if (snapshot.tab === "customers") {
    return [
      { key: "type", label: "Phân loại", format: (row) => String(row.type ?? "") },
      { key: "total", label: "Số lượng", format: (row) => Number(row.total ?? 0) },
      { key: "percent", label: "Tỷ trọng", format: (row) => `${Number(row.percent ?? 0)}%` },
    ];
  }

  if (snapshot.tab === "tickets") {
    return [
      { key: "name", label: "Nhân sự", format: (row) => String(row.name ?? "") },
      { key: "assigned", label: "Assigned", format: (row) => Number(row.assigned ?? 0) },
      { key: "resolved", label: "Resolved", format: (row) => Number(row.resolved ?? 0) },
      { key: "avgResponse", label: "Phản hồi TB", format: (row) => String(row.avgResponse ?? "") },
      { key: "tasksDone", label: "Task done", format: (row) => Number(row.tasksDone ?? 0) },
      { key: "tasksOverdue", label: "Task overdue", format: (row) => Number(row.tasksOverdue ?? 0) },
    ];
  }

  return [
    { key: "name", label: "Chiến dịch", format: (row) => String(row.name ?? "") },
    { key: "channel", label: "Kênh", format: (row) => String(row.channel ?? "") },
    { key: "sent", label: "Sent", format: (row) => Number(row.sent ?? 0) },
    { key: "failed", label: "Failed", format: (row) => Number(row.failed ?? 0) },
    { key: "openRate", label: "Open rate", format: (row) => `${Number(row.openRate ?? 0)}%` },
    { key: "clickRate", label: "Click rate", format: (row) => `${Number(row.clickRate ?? 0)}%` },
    { key: "status", label: "Trạng thái", format: (row) => String(row.status ?? "") },
  ];
}

function getSnapshotRows(snapshot: ReportSnapshot): Record<string, unknown>[] {
  if (snapshot.tab === "revenue") {
    return snapshot.revenueSeries;
  }

  if (snapshot.tab === "customers") {
    return snapshot.customerTypeRows;
  }

  if (snapshot.tab === "tickets") {
    return snapshot.staffPerformance;
  }

  return snapshot.campaignPerformance;
}

export function getExportRowCount(snapshot: ReportSnapshot) {
  return getSnapshotRows(snapshot).length;
}

export function hasExportableRows(snapshot: ReportSnapshot) {
  return getExportRowCount(snapshot) > 0;
}

function buildExportTable(snapshot: ReportSnapshot) {
  const columns = getExportColumns(snapshot);
  const rows = getSnapshotRows(snapshot);

  return {
    columns,
    records: rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column.label, column.format(row)])),
    ),
    body: rows.map((row) => columns.map((column) => String(column.format(row)))),
  };
}

function getPdfTitle(request: ExportRequest) {
  const label =
    request.tab === "revenue"
      ? "Báo cáo doanh thu"
      : request.tab === "customers"
        ? "Báo cáo khách hàng"
        : request.tab === "tickets"
          ? "Báo cáo ticket"
          : "Báo cáo marketing";

  return `${label} (${request.from} - ${request.to})`;
}

function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return binary;
}

async function loadDefaultPdfFontBinary() {
  const response = await fetch(PDF_FONT_URL);
  if (!response.ok) {
    throw new Error("Không thể tải font Unicode cho file PDF.");
  }

  return arrayBufferToBinaryString(await response.arrayBuffer());
}

export function createExportService({
  loadXlsx = () => import("xlsx"),
  loadJsPdf = async () => (await import("jspdf")).default,
  loadAutoTable = async () => (await import("jspdf-autotable")).default,
  loadPdfFontBinary = loadDefaultPdfFontBinary,
  logger = reportLogger,
  timeoutMs = DEFAULT_EXPORT_TIMEOUT_MS,
  getTimeZone = getClientTimeZone,
}: ExportServiceDependencies = {}) {
  return {
    async exportReport(request: ExportRequest) {
      const startedAt = Date.now();
      const rowCount = getExportRowCount(request.snapshot);
      const timeZone = getTimeZone();

      if (!rowCount) {
        throw new Error("Không có dữ liệu để xuất với bộ lọc hiện tại.");
      }

      try {
        const table = buildExportTable(request.snapshot);

        await withTimeout(
          (async () => {
            if (request.format === "xlsx") {
              const XLSX = await loadXlsx();
              const worksheet = XLSX.utils.json_to_sheet(table.records);
              const workbook = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(workbook, worksheet, request.tab);
              XLSX.writeFile(workbook, buildExportFileName(request));
              return;
            }

            const [JsPdf, autoTable, fontBinary] = await Promise.all([
              loadJsPdf(),
              loadAutoTable(),
              loadPdfFontBinary(),
            ]);
            const doc = new JsPdf({
              orientation: table.columns.length > 4 ? "landscape" : "portrait",
              unit: "pt",
              format: "a4",
            });

            doc.addFileToVFS(PDF_FONT_FILENAME, fontBinary);
            doc.addFont(PDF_FONT_FILENAME, PDF_FONT_NAME, "normal");
            doc.setFont(PDF_FONT_NAME, "normal");
            doc.setFontSize(14);
            doc.text(getPdfTitle(request), 40, 40);
            doc.setFontSize(10);
            doc.text(`Nhóm theo: ${request.groupBy}`, 40, 58);
            doc.text(`Múi giờ: ${timeZone}`, 40, 74);

            autoTable(doc, {
              startY: 92,
              head: [table.columns.map((column) => column.label)],
              body: table.body,
              styles: {
                font: PDF_FONT_NAME,
                fontStyle: "normal",
                fontSize: 9,
                cellPadding: 6,
                overflow: "linebreak",
              },
              headStyles: {
                font: PDF_FONT_NAME,
                fontStyle: "normal",
                fillColor: [37, 99, 235],
                textColor: [255, 255, 255],
              },
              margin: { left: 30, right: 30, bottom: 24 },
            });

            doc.save(buildExportFileName(request));
          })(),
          timeoutMs,
          "Xuất file bị timeout",
        );
      } catch (error) {
        logger.error("report export failed", {
          operation: "export",
          stage: request.format,
          tab: request.tab,
          from: request.from,
          to: request.to,
          groupBy: request.groupBy,
          format: request.format,
          rowCount,
          timeoutMs,
          timeZone,
          durationMs: Date.now() - startedAt,
          error,
        });
        throw error;
      }
    },
  };
}

export const exportService = createExportService();
