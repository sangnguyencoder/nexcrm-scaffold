import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn, formatDateInputValue } from "@/lib/utils";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DATE_DISPLAY_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const MONTH_DISPLAY_FORMATTER = new Intl.DateTimeFormat("vi-VN", {
  month: "long",
  year: "numeric",
});

function parseDateValue(value?: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  disabled,
  min,
  max,
}: {
  value?: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedDate = parseDateValue(value);
  const today = startOfDay(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const monthLabel = useMemo(() => {
    const label = MONTH_DISPLAY_FORMATTER.format(displayMonth);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [displayMonth]);

  const gridDays = useMemo(() => {
    const monthStart = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(gridStart.getDate() - gridStart.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });
  }, [displayMonth]);

  const isDateDisabled = (date: Date) => {
    if (minDate && startOfDay(date).getTime() < startOfDay(minDate).getTime()) {
      return true;
    }
    if (maxDate && startOfDay(date).getTime() > startOfDay(maxDate).getTime()) {
      return true;
    }
    return false;
  };

  const selectDate = (date: Date) => {
    if (isDateDisabled(date)) {
      return;
    }
    onChange(formatDateInputValue(date));
    setOpen(false);
  };

  const goToPreviousMonth = () =>
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  const goToNextMonth = () =>
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));

  return (
    <div ref={containerRef} className={cn("relative min-w-[160px]", className)}>
      <button
        type="button"
        onClick={() =>
          setOpen((current) => {
            const next = !current;
            if (next && selectedDate) {
              setDisplayMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
            }
            return next;
          })
        }
        disabled={disabled}
        className={cn(
          "inline-flex h-11 w-full items-center justify-between gap-2 rounded-full border border-border/80 bg-card px-4 text-left text-base font-medium text-foreground shadow-xs transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[13px]",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{selectedDate ? DATE_DISPLAY_FORMATTER.format(selectedDate) : placeholder}</span>
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <CalendarDays className="size-4" />
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[320px] overflow-hidden rounded-2xl border border-border/80 bg-popover p-3 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-2 px-1">
            <div className="text-sm font-semibold text-foreground">{monthLabel}</div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToPreviousMonth}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Tháng trước"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={goToNextMonth}
                className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Tháng sau"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 px-1 pb-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1 text-center text-xs font-semibold text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 px-1">
            {gridDays.map((date) => {
              const outsideCurrentMonth = date.getMonth() !== displayMonth.getMonth();
              const selected = selectedDate ? isSameDate(date, selectedDate) : false;
              const isToday = isSameDate(date, today);
              const disabledDate = isDateDisabled(date);

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={disabledDate}
                  onClick={() => selectDate(date)}
                  className={cn(
                    "inline-flex size-9 items-center justify-center rounded-lg text-sm tabular-nums transition-colors",
                    outsideCurrentMonth ? "text-muted-foreground/65" : "text-foreground",
                    isToday && !selected && "border border-primary/40 text-primary",
                    selected && "bg-primary font-semibold text-primary-foreground shadow-xs",
                    !selected && !disabledDate && "hover:bg-muted",
                    disabledDate && "cursor-not-allowed opacity-35",
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-border/70 px-1 pt-3">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="text-sm font-semibold text-primary transition-colors hover:text-primary/85"
            >
              Hôm nay
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
