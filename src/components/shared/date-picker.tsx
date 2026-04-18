import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
const PANEL_WIDTH = 280;
const PANEL_OFFSET = 8;
const VIEWPORT_MARGIN = 12;

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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0, width: PANEL_WIDTH });
  const selectedDate = parseDateValue(value);
  const today = startOfDay(new Date());
  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    const base = selectedDate ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const minDate = parseDateValue(min);
  const maxDate = parseDateValue(max);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePanelPosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 360;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(PANEL_WIDTH, viewportWidth - VIEWPORT_MARGIN * 2);
      const maxLeft = Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN);
      const left = Math.min(Math.max(triggerRect.left, VIEWPORT_MARGIN), maxLeft);

      const belowTop = triggerRect.bottom + PANEL_OFFSET;
      const aboveTop = triggerRect.top - panelHeight - PANEL_OFFSET;
      let top = belowTop;

      if (belowTop + panelHeight > viewportHeight - VIEWPORT_MARGIN && aboveTop >= VIEWPORT_MARGIN) {
        top = aboveTop;
      }

      if (top + panelHeight > viewportHeight - VIEWPORT_MARGIN) {
        top = Math.max(VIEWPORT_MARGIN, viewportHeight - panelHeight - VIEWPORT_MARGIN);
      }

      setPanelStyle({ top, left, width });
    };

    updatePanelPosition();
    const frameId = window.requestAnimationFrame(updatePanelPosition);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const target = event.target instanceof Node ? event.target : null;
      const inTrigger =
        path.includes(containerRef.current as EventTarget) ||
        (target ? containerRef.current?.contains(target) : false);
      const inPanel =
        path.includes(panelRef.current as EventTarget) ||
        (target ? panelRef.current?.contains(target) : false);
      if (!inTrigger && !inPanel) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
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
    <div ref={containerRef} className={cn("min-w-[188px]", className)}>
      <button
        ref={triggerRef}
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
          "inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border/80 bg-card px-3.5 text-left text-sm font-medium text-foreground shadow-xs transition-colors hover:border-primary/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60",
          !value && "text-muted-foreground",
        )}
      >
        <span className="truncate">{selectedDate ? DATE_DISPLAY_FORMATTER.format(selectedDate) : placeholder}</span>
        <span className="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <CalendarDays className="size-4" />
        </span>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={panelRef}
              style={{
                top: panelStyle.top,
                left: panelStyle.left,
                width: panelStyle.width,
              }}
              className="fixed z-[120] overflow-hidden rounded-2xl border border-border/80 bg-popover p-3 shadow-soft pointer-events-auto"
            >
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

          <div className="grid grid-cols-7 gap-0 px-1 pb-1.5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="py-1 text-center text-[11px] font-semibold text-muted-foreground">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0 px-1">
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
                    "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs tabular-nums transition-colors",
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
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Xóa
            </button>
            <button
              type="button"
              onClick={() => selectDate(today)}
              className="text-xs font-semibold text-primary transition-colors hover:text-primary/85"
            >
              Hôm nay
            </button>
          </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
