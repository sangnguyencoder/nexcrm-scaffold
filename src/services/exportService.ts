import { formatCurrency } from "@/lib/utils";
import type {
  CustomersReportSnapshot,
  MarketingReportSnapshot,
  ReportGroupBy,
  ReportSnapshot,
  ReportTab,
  RevenueReportSnapshot,
  TicketsReportSnapshot,
} from "@/services/reportService";

type ExportFormat = "xlsx" | "pdf";

type ExportRequest = {
  tab: ReportTab;
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  format: ExportFormat;
  snapshot: ReportSnapshot;
};

function getFileName({ tab, from, to, format }: ExportRequest) {
  return `nexcrm-${tab}-${from}-to-${to}.${format}`;
}

function getExportRows(snapshot: ReportSnapshot) {
  if (snapshot.tab === "revenue") {
    return getRevenueRows(snapshot);
  }

  if (snapshot.tab === "customers") {
    return getCustomerRows(snapshot);
  }

  if (snapshot.tab === "tickets") {
    return getTicketRows(snapshot);
  }

  return getMarketingRows(snapshot);
}

function getRevenueRows(snapshot: RevenueReportSnapshot) {
  return snapshot.revenueSeries.map((row) => ({
    period: row.period,
    revenue: formatCurrency(row.revenue),
    orders: row.orders,
    average_order: formatCurrency(row.avg),
    growth_percent: `${row.growth}%`,
  }));
}

function getCustomerRows(snapshot: CustomersReportSnapshot) {
  return snapshot.customerTypeRows.map((row) => ({
    customer_type: row.type,
    total: row.total,
    percent: `${row.percent}%`,
  }));
}

function getTicketRows(snapshot: TicketsReportSnapshot) {
  return snapshot.staffPerformance.map((row) => ({
    staff: row.name,
    assigned_tickets: row.assigned,
    resolved_tickets: row.resolved,
    average_response: row.avgResponse,
    tasks_done: row.tasksDone,
    tasks_overdue: row.tasksOverdue,
  }));
}

function getMarketingRows(snapshot: MarketingReportSnapshot) {
  return snapshot.campaignPerformance.map((campaign) => ({
    campaign: campaign.name,
    channel: campaign.channel,
    sent: campaign.sent,
    failed: campaign.failed,
    open_rate: `${campaign.openRate}%`,
    click_rate: `${campaign.clickRate}%`,
    status: campaign.status,
  }));
}

function getPdfTitle(request: ExportRequest) {
  const label =
    request.tab === "revenue"
      ? "Bao cao doanh thu"
      : request.tab === "customers"
        ? "Bao cao khach hang"
        : request.tab === "tickets"
          ? "Bao cao ticket"
          : "Bao cao marketing";

  return `${label} (${request.from} - ${request.to})`;
}

export const exportService = {
  async exportReport(request: ExportRequest) {
    const rows = getExportRows(request.snapshot);

    if (!rows.length) {
      throw new Error("Khong co du lieu de xuat trong khoang thoi gian da chon.");
    }

    if (request.format === "xlsx") {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, request.tab);
      XLSX.writeFile(workbook, getFileName(request));
      return;
    }

    const [{ default: JsPdf }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const headers = Object.keys(rows[0]);
    const body = rows.map((row) => headers.map((header) => String(row[header as keyof typeof row] ?? "")));
    const doc = new JsPdf({
      orientation: headers.length > 4 ? "landscape" : "portrait",
      unit: "pt",
      format: "a4",
    });

    doc.setFontSize(14);
    doc.text(getPdfTitle(request), 40, 40);
    doc.setFontSize(10);
    doc.text(`Group by: ${request.groupBy}`, 40, 58);

    autoTable(doc, {
      startY: 72,
      head: [headers],
      body,
      styles: {
        fontSize: 9,
      },
      headStyles: {
        fillColor: [37, 99, 235],
      },
      margin: { left: 30, right: 30 },
    });

    doc.save(getFileName(request));
  },
};
