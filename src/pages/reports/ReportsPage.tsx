import { Download, FileText } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { PageErrorState } from "@/components/shared/page-error-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

  const reportQuery = useReportSnapshot({
    tab: activeTab,
    from,
    to,
    groupBy,
  });

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

  if (reportQuery.isLoading) {
    return <PageLoader panels={3} />;
  }

  if (reportQuery.error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Báo Cáo"
          // subtitle="KPI và bảng tóm tắt đang không tải được. Bạn có thể thử lại ngay từ đây."
        />
        <PageErrorState
          title="Không thể tải báo cáo"
          description={getAppErrorMessage(
            reportQuery.error,
            "Dữ liệu báo cáo chưa đồng bộ được. Vui lòng kiểm tra bộ lọc ngày và thử lại.",
          )}
          onRetry={() => void reportQuery.refetch()}
        />
      </div>
    );
  }

  const snapshot = reportQuery.data;
  if (!snapshot) {
    return <PageLoader panels={2} />;
  }

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
        <Input
          type="date"
          value={from}
          onChange={(event) => updateParams({ from: event.target.value })}
          className="w-[148px]"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => updateParams({ to: event.target.value })}
          className="w-[148px]"
        />
        <Select
          value={groupBy}
          onChange={(event) => updateParams({ groupBy: event.target.value })}
          className="w-[146px]"
        >
          <option value="day">Theo ngày</option>
          <option value="week">Theo tuần</option>
          <option value="month">Theo tháng</option>
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleExport("xlsx")}
            disabled={Boolean(exportingFormat)}
          >
            <Download className="size-4" />
            {exportingFormat === "xlsx" ? "Đang xuất..." : "Xuất Excel"}
          </Button>
          <Button
            size="sm"
            onClick={() => void handleExport("pdf")}
            disabled={Boolean(exportingFormat)}
          >
            <FileText className="size-4" />
            {exportingFormat === "pdf" ? "Đang xuất..." : "Xuất PDF"}
          </Button>
        </div>
      </StickyFilterBar>

      <Suspense fallback={<PageLoader panels={2} />}>
        <ReportContent snapshot={snapshot} />
      </Suspense>
    </Tabs>
  );
}
