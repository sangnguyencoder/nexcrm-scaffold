import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import type { CustomerType, DealStage, TaskStatus, TicketPriority, UserRole } from "@/types";

const currencyFormatter = new Intl.NumberFormat("vi-VN");
const percentFormatter = new Intl.NumberFormat("vi-VN", {
  style: "percent",
  maximumFractionDigits: 0,
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
    vip: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
    loyal:
      "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    potential:
      "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
    new: "bg-slate-500/15 text-slate-600 ring-slate-500/25 dark:text-slate-300",
    inactive: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
  };

  return map[type];
}

export function getRoleBadgeColor(role: UserRole): string {
  const map: Record<UserRole, string> = {
    super_admin:
      "bg-violet-600/15 text-violet-700 ring-violet-600/25 dark:text-violet-300",
    admin: "bg-violet-500/15 text-violet-600 ring-violet-500/25 dark:text-violet-300",
    director: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
    sales: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    cskh: "bg-orange-500/15 text-orange-600 ring-orange-500/25 dark:text-orange-300",
    marketing: "bg-pink-500/15 text-pink-600 ring-pink-500/25 dark:text-pink-300",
  };

  return map[role];
}

export function getPriorityColor(priority: TicketPriority): string {
  const map: Record<TicketPriority, string> = {
    urgent: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
    high: "bg-orange-500/15 text-orange-600 ring-orange-500/25 dark:text-orange-300",
    medium: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
    low: "bg-slate-500/15 text-slate-600 ring-slate-500/25 dark:text-slate-300",
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
    lead: "bg-slate-500/15 text-slate-600 ring-slate-500/25 dark:text-slate-300",
    qualified: "bg-blue-500/15 text-blue-600 ring-blue-500/25 dark:text-blue-300",
    proposal: "bg-amber-500/15 text-amber-600 ring-amber-500/25 dark:text-amber-300",
    negotiation: "bg-orange-500/15 text-orange-600 ring-orange-500/25 dark:text-orange-300",
    won: "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300",
    lost: "bg-rose-500/15 text-rose-600 ring-rose-500/25 dark:text-rose-300",
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
