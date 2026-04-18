import { AlertTriangle, Download, FileText, RefreshCw } from "lucide-react";
import { Suspense, lazy, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { DatePicker } from "@/components/shared/date-picker";
import { FilterSelect } from "@/components/shared/filter-select";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportSnapshot } from "@/hooks/useNexcrmQueries";
import { formatDateInputValue } from "@/lib/utils";
import { exportService, hasExportableRows } from "@/services/exportService";
import { getAppErrorMessage } from "@/services/shared";
import type { ReportGroupBy, ReportTab } from "@/services/reportService";

const ReportContent = lazy(() =>
  import("@/pages/reports/ReportPanels").then((module) => ({
    default: module.ReportContent,
  })),
);

function toInputDate(date: Date) {
  return formatDateInputValue(date);
}

function getDefaultFromDate() {
  const now = new Date();
  return toInputDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function getDefaultToDate() {
  return toInputDate(new Date());
}

function getPreviousRange(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return { from, to };
  }

  const days = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const previousTo = new Date(fromDate);
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - (days - 1));

  return {
    from: toInputDate(previousFrom),
    to: toInputDate(previousTo),
  };
}

function getRangeValidation(from: string, to: string) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);

  if (!from || !to || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return {
      valid: false,
      message: "Khoảng thời gian chưa hợp lệ. Vui lòng chọn lại ngày bắt đầu và kết thúc.",
    };
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return {
      valid: false,
      message: "Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.",
    };
  }

  return { valid: true, message: "" };
}

function isReportTab(value: string | null): value is ReportTab {
  return value === "revenue" || value === "customers" || value === "tickets" || value === "marketing";
}

function isGroupBy(value: string | null): value is ReportGroupBy {
  return value === "day" || value === "week" || value === "month";
}

export function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [exportingFormat, setExportingFormat] = useState<"xlsx" | "pdf" | null>(null);
  const tabParam = searchParams.get("tab");
  const groupByParam = searchParams.get("groupBy");
  const activeTab: ReportTab = isReportTab(tabParam) ? tabParam : "revenue";
  const from = searchParams.get("from") || getDefaultFromDate();
  const to = searchParams.get("to") || getDefaultToDate();
  const groupBy: ReportGroupBy = isGroupBy(groupByParam) ? groupByParam : "day";
  const rangeValidation = useMemo(() => getRangeValidation(from, to), [from, to]);
  const canRunReportQuery = rangeValidation.valid;

  const updateParams = (updates: Partial<Record<"tab" | "from" | "to" | "groupBy", string>>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const reportQuery = useReportSnapshot(
    {
      tab: activeTab,
      from,
      to,
      groupBy,
    },
    canRunReportQuery,
  );
  const previousRange = useMemo(() => getPreviousRange(from, to), [from, to]);
  const previousReportQuery = useReportSnapshot(
    {
      tab: activeTab,
      from: previousRange.from,
      to: previousRange.to,
      groupBy,
    },
    canRunReportQuery,
  );

  const handleExport = async (format: "xlsx" | "pdf") => {
    if (!reportQuery.data) {
      return;
    }

    if (!hasExportableRows(reportQuery.data)) {
      toast.warning("Không có dữ liệu để xuất với bộ lọc hiện tại.");
      return;
    }

    setExportingFormat(format);
    try {
      await exportService.exportReport({
        tab: activeTab,
        from,
        to,
        groupBy,
        format,
        snapshot: reportQuery.data,
      });
      toast.success(format === "xlsx" ? "Đã xuất Excel thành công." : "Đã xuất PDF thành công.");
    } catch (error) {
      toast.error(
        getAppErrorMessage(error, "Không thể xuất báo cáo. Vui lòng thử lại hoặc kiểm tra bộ lọc."),
      );
    } finally {
      setExportingFormat(null);
    }
  };

  if (canRunReportQuery && reportQuery.isLoading && !reportQuery.data) {
    return <PageLoader panels={3} />;
  }
  const snapshot = reportQuery.data;

  return (
    <Tabs value={activeTab} onValueChange={(value) => updateParams({ tab: value })} className="space-y-4">
      <PageHeader
        title="Báo Cáo"
        // subtitle="Giữ KPI, bảng tóm tắt và export trong cùng một layout thao tác nhanh."
      />

      <StickyFilterBar className="top-[80px]">
        <TabsList className="h-9">
          <TabsTrigger value="revenue">Doanh thu</TabsTrigger>
          <TabsTrigger value="customers">Khách hàng</TabsTrigger>
          <TabsTrigger value="tickets">Ticket</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
        </TabsList>
        <DatePicker value={from} onChange={(nextValue) => updateParams({ from: nextValue })} className="w-[190px]" />
        <DatePicker value={to} onChange={(nextValue) => updateParams({ to: nextValue })} className="w-[190px]" />
        <FilterSelect
          value={groupBy}
          onValueChange={(nextValue) => updateParams({ groupBy: nextValue })}
          options={[
            { value: "day", label: "Theo ngày" },
            { value: "week", label: "Theo tuần" },
            { value: "month", label: "Theo tháng" },
          ]}
          className="w-[180px]"
        />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport("xlsx")}
            disabled={Boolean(exportingFormat) || !canRunReportQuery || !snapshot}
          >
            <Download className="size-4" />
            {exportingFormat === "xlsx" ? "Đang xuất..." : "Xuất Excel"}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleExport("pdf")}
            disabled={Boolean(exportingFormat) || !canRunReportQuery || !snapshot}
          >
            <FileText className="size-4" />
            {exportingFormat === "pdf" ? "Đang xuất..." : "Xuất PDF"}
          </Button>
        </div>
      </StickyFilterBar>
      {!canRunReportQuery ? (
        <div className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{rangeValidation.message}</span>
          </div>
        </div>
      ) : null}

      {canRunReportQuery && reportQuery.error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {getAppErrorMessage(
                reportQuery.error,
                "Không thể tải báo cáo với khoảng thời gian hiện tại. Vui lòng thử lại.",
              )}
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void reportQuery.refetch()}>
            <RefreshCw className="size-4" />
            Thử lại
          </Button>
        </div>
      ) : null}

      {canRunReportQuery && snapshot ? (
        <Suspense fallback={<PageLoader panels={2} />}>
          <ReportContent snapshot={snapshot} previousSnapshot={previousReportQuery.data ?? null} />
        </Suspense>
      ) : null}
    </Tabs>
  );
}
