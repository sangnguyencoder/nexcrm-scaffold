import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { CustomerType, DealStage, TaskStatus, TicketPriority, UserRole } from "@/types";

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 0,
});
const decimalPercentFormatter = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const relativeTimeFormatter = new Intl.RelativeTimeFormat("vi", { numeric: "auto" });

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `${currencyFormatter.format(amount)} ₫`;
}

type CompactFormatOptions = {
  locale?: "vi" | "en";
  maximumFractionDigits?: number;
};

function formatCompactUnit(
  value: number,
  divisor: number,
  suffix: string,
  locale: "vi" | "en",
  maximumFractionDigits: number,
) {
  const scaledValue = value / divisor;
  const fractionDigits =
    Math.abs(scaledValue) >= 100
      ? 0
      : Math.abs(scaledValue) >= 10
        ? Math.min(maximumFractionDigits, 1)
        : maximumFractionDigits;
  const formatter = new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });

  return `${formatter.format(scaledValue)}${locale === "vi" ? " " : ""}${suffix}`;
}

export function formatNumberCompact(
  value: number,
  {
    locale = "vi",
    maximumFractionDigits = 1,
  }: CompactFormatOptions = {},
): string {
  const absValue = Math.abs(value);

  if (absValue >= 1_000_000_000) {
    return formatCompactUnit(
      value,
      1_000_000_000,
      locale === "vi" ? "tỷ" : "B",
      locale,
      maximumFractionDigits,
    );
  }

  if (absValue >= 1_000_000) {
    return formatCompactUnit(
      value,
      1_000_000,
      locale === "vi" ? "triệu" : "M",
      locale,
      maximumFractionDigits,
    );
  }

  if (absValue >= 1_000) {
    return formatCompactUnit(
      value,
      1_000,
      locale === "vi" ? "nghìn" : "K",
      locale,
      maximumFractionDigits,
    );
  }

  return new Intl.NumberFormat(locale === "vi" ? "vi-VN" : "en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompactNumber(value: number): string {
  return formatNumberCompact(value);
}

export function formatCurrencyCompact(
  amount: number,
  options?: CompactFormatOptions,
): string {
  if (Math.abs(amount) < 1_000_000) {
    return formatCurrency(amount);
  }

  return `${formatNumberCompact(amount, options)} ₫`;
}

export function formatPercent(value: number): string {
  return percentFormatter.format(value);
}

export function formatPercentValue(
  value: number | null | undefined,
  {
    alreadyPercent = false,
  }: {
    alreadyPercent?: boolean;
  } = {},
): string {
  const numericValue = Number.isFinite(value) ? Number(value) : 0;
  const normalizedValue = alreadyPercent ? numericValue : numericValue * 100;

  return `${decimalPercentFormatter.format(normalizedValue)}%`;
}

export function formatDate(date: string): string {
  return dateFormatter.format(new Date(date));
}

export function formatDateTime(date: string): string {
  return dateTimeFormatter.format(new Date(date));
}

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function timeAgo(date: string): string {
  const diff = new Date(date).getTime() - Date.now();
  const divisions = [
    { amount: 60, unit: "second" as const },
    { amount: 60, unit: "minute" as const },
    { amount: 24, unit: "hour" as const },
    { amount: 7, unit: "day" as const },
    { amount: 4.34524, unit: "week" as const },
    { amount: 12, unit: "month" as const },
    { amount: Number.POSITIVE_INFINITY, unit: "year" as const },
  ];

  let duration = diff / 1000;

  for (const division of divisions) {
    if (Math.abs(duration) < division.amount) {
      if (division.unit === "second" && Math.abs(Math.round(duration)) < 10) {
        return "Vừa xong";
      }

      return relativeTimeFormatter.format(Math.round(duration), division.unit);
    }

    duration /= division.amount;
  }

  return "Vừa xong";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function getCustomerTypeColor(type: CustomerType): string {
  const map: Record<CustomerType, string> = {
    vip: "bg-warning/10 text-warning border-warning/20",
    loyal: "bg-success/10 text-success border-success/20",
    potential: "bg-primary/10 text-primary border-primary/20",
    new: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
    inactive: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return map[type];
}

export function getRoleBadgeColor(role: UserRole): string {
  const map: Record<UserRole, string> = {
    super_admin: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/25 dark:text-indigo-300",
    admin: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
    director: "bg-cyan-500/15 text-cyan-700 ring-cyan-500/25 dark:text-cyan-300",
    sales: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    cskh: "bg-amber-500/15 text-amber-700 ring-amber-500/25 dark:text-amber-300",
    marketing: "bg-sky-500/15 text-sky-700 ring-sky-500/25 dark:text-sky-300",
  };

  return map[role];
}

export function getPriorityColor(priority: TicketPriority): string {
  const map: Record<TicketPriority, string> = {
    urgent: "bg-destructive/10 text-destructive border-destructive/20",
    high: "bg-warning/10 text-warning border-warning/20",
    medium: "bg-primary/10 text-primary border-primary/20",
    low: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
  };

  return map[priority];
}

export function formatTicketPriority(priority: TicketPriority): string {
  const map: Record<TicketPriority, string> = {
    urgent: "Khẩn cấp",
    high: "Cao",
    medium: "Trung bình",
    low: "Thấp",
  };

  return map[priority];
}

export function formatCustomerType(type: CustomerType): string {
  const map: Record<CustomerType, string> = {
    vip: "VIP",
    loyal: "Thân thiết",
    potential: "Tiềm năng",
    new: "Mới",
    inactive: "Không hoạt động",
  };

  return map[type];
}

export function formatRole(role: UserRole): string {
  const map: Record<UserRole, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    director: "Giám đốc",
    sales: "Kinh doanh",
    cskh: "CSKH",
    marketing: "Marketing",
  };

  return map[role];
}

export function formatTicketStatus(status: string): string {
  const map: Record<string, string> = {
    open: "Mở",
    in_progress: "Đang xử lý",
    pending: "Chờ",
    resolved: "Đã giải quyết",
    closed: "Đóng",
    processing: "Đang xử lý",
    completed: "Hoàn tất",
    cancelled: "Đã hủy",
    paid: "Đã thanh toán",
    partial: "Thanh toán một phần",
    refunded: "Hoàn tiền",
  };

  return map[status] ?? status;
}

export function getStatusBadgeColor(status: string): string {
  const map: Record<string, string> = {
    open: "bg-primary/10 text-primary border-primary/20",
    in_progress: "bg-primary/10 text-primary border-primary/20",
    pending: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
    resolved: "bg-success/10 text-success border-success/20",
    closed: "bg-success/10 text-success border-success/20",
    draft: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
    scheduled: "bg-warning/10 text-warning border-warning/20",
    sending: "bg-warning/10 text-warning border-warning/20",
    sent: "bg-success/10 text-success border-success/20",
    sent_with_errors: "bg-warning/10 text-warning border-warning/20",
    cancelled: "bg-destructive/10 text-destructive border-destructive/20",
    processing: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-success/10 text-success border-success/20",
    paid: "bg-success/10 text-success border-success/20",
    partial: "bg-warning/10 text-warning border-warning/20",
    refunded: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
    failed: "bg-destructive/10 text-destructive border-destructive/20",
    duplicate: "bg-primary/10 text-primary border-primary/20",
  };

  return map[status] ?? "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]";
}

export function formatPaymentMethod(method: string): string {
  const map: Record<string, string> = {
    cash: "Tiền mặt",
    card: "Thẻ",
    transfer: "Chuyển khoản",
    qr: "QR",
    other: "Khác",
  };

  return map[method] ?? method;
}

export function formatDealStage(stage: DealStage): string {
  const map: Record<DealStage, string> = {
    lead: "Tiếp cận",
    qualified: "Đủ điều kiện",
    proposal: "Đề xuất",
    negotiation: "Đàm phán",
    won: "Thành công",
    lost: "Thất bại",
  };

  return map[stage];
}

export function getDealStageColor(stage: DealStage): string {
  const map: Record<DealStage, string> = {
    lead: "bg-[rgb(var(--text-muted-rgb)/0.08)] text-muted-foreground border-[rgb(var(--text-muted-rgb)/0.15)]",
    qualified: "bg-primary/10 text-primary border-primary/20",
    proposal: "bg-warning/10 text-warning border-warning/20",
    negotiation: "bg-warning/10 text-warning border-warning/20",
    won: "bg-success/10 text-success border-success/20",
    lost: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return map[stage];
}

export function formatTaskStatus(status: TaskStatus): string {
  const map: Record<TaskStatus, string> = {
    todo: "Cần làm",
    in_progress: "Đang làm",
    done: "Hoàn thành",
    overdue: "Quá hạn",
  };

  return map[status];
}

export function toSlug(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function uniqueId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function sanitizeFileNameSegment(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getDefaultAvatarUrl(role?: UserRole | null) {
  const map: Record<UserRole, string> = {
    super_admin: "/avatars/default-super-admin.svg",
    admin: "/avatars/default-admin.svg",
    director: "/avatars/default-director.svg",
    sales: "/avatars/default-sales.svg",
    cskh: "/avatars/default-cskh.svg",
    marketing: "/avatars/default-marketing.svg",
  };

  return role ? map[role] : "/avatars/default-admin.svg";
}

export function getDefaultLogoUrl() {
  return "/branding/demo-company-logo.svg";
}

export function isValidAssetUrl(value?: string | null) {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("/")) {
    return true;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveLogoUrl(value?: string | null) {
  return isValidAssetUrl(value) ? value!.trim() : getDefaultLogoUrl();
}

export async function copyTextToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  return false;
}
