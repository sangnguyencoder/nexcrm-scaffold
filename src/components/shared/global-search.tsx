import { ArrowRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import {
  useCampaignsQuery,
  useCustomersQuery,
  useTicketsQuery,
} from "@/hooks/useNexcrmQueries";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { timeAgo, toSlug } from "@/lib/utils";

type SearchItem = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
};

const SEARCH_GROUPS = ["Khách hàng", "Ticket", "Chiến dịch"] as const;

function QuickHint({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/35 px-3 py-2 text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 180);
  const keyword = toSlug(debouncedQuery.trim());
  const searchEnabled = open && keyword.length >= 2;
  const { data: customers = [] } = useCustomersQuery(
    {
      search: debouncedQuery || undefined,
    },
    searchEnabled,
  );
  const { data: tickets = [] } = useTicketsQuery(
    {
      search: debouncedQuery || undefined,
    },
    searchEnabled,
  );
  const { data: campaigns = [] } = useCampaignsQuery(undefined, searchEnabled);

  useEffect(() => {
    if (!open) {
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(true);
      }

      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  const results = useMemo(() => {
    if (!keyword) return [] as SearchItem[];

    return [
      ...customers
        .filter((item) => toSlug(item.full_name).includes(keyword))
        .map(
          (item): SearchItem => ({
            id: item.id,
            group: "Khách hàng",
            title: item.full_name,
            subtitle: item.customer_code,
            href: `/customers/${item.id}`,
          }),
        ),
      ...tickets
        .filter((item) => toSlug(item.title).includes(keyword))
        .map(
          (item): SearchItem => ({
            id: item.id,
            group: "Ticket",
            title: item.title,
            subtitle: `${item.ticket_code} · ${timeAgo(item.created_at)}`,
            href: `/tickets/${item.id}`,
          }),
        ),
      ...campaigns
        .filter((item) => toSlug(item.name).includes(keyword))
        .map(
          (item): SearchItem => ({
            id: item.id,
            group: "Chiến dịch",
            title: item.name,
            subtitle: item.status,
            href: "/campaigns",
          }),
        ),
    ];
  }, [campaigns, customers, keyword, tickets]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(results.length - 1, 0)));
  }, [results.length]);

  useEffect(() => {
    if (!open) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((value) => Math.min(value + 1, Math.max(results.length - 1, 0)));
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((value) => Math.max(value - 1, 0));
      }

      if (event.key === "Enter" && results[selectedIndex]) {
        navigate(results[selectedIndex].href);
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigate, onOpenChange, open, results, selectedIndex]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm kiếm toàn cục"
      description="Tìm khách hàng, ticket và chiến dịch bằng Ctrl+K"
      className="max-w-3xl"
      bodyClassName="p-0"
      hideHeader
    >
      <div className="command-shell border-0 shadow-none">
        <div className="flex items-start gap-3 border-b border-border/70 px-4 py-4">
          <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground">
            <Search className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <Input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Tìm khách hàng, ticket, chiến dịch..."
                className="h-auto border-0 bg-transparent px-0 py-0 text-base shadow-none hover:border-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <span className="rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                Esc
              </span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Dùng mũi tên để di chuyển, Enter để mở nhanh thực thể liên quan.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Ctrl + K</span>
          <span>mở command search</span>
          <span className="text-border">/</span>
          <span>Arrow Keys</span>
          <span>điều hướng</span>
          <span className="text-border">/</span>
          <span>Enter</span>
          <span>mở kết quả</span>
        </div>

        <div className="max-h-[500px] overflow-y-auto p-3">
          {!query.trim() ? (
            <div className="space-y-4 p-2">
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Gợi ý tìm kiếm
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <QuickHint label="Theo tên khách hàng hoặc mã khách hàng" />
                  <QuickHint label="Theo ticket code hoặc tiêu đề ticket" />
                  <QuickHint label="Theo tên chiến dịch hoặc trạng thái gửi" />
                </div>
              </div>
            </div>
          ) : keyword.length < 2 ? (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
              Nhập ít nhất 2 ký tự để tìm kiếm trên toàn workspace.
            </div>
          ) : results.length ? (
            <div className="space-y-4">
              {SEARCH_GROUPS.map((group) => {
                const groupItems = results.filter((item) => item.group === group);
                if (!groupItems.length) {
                  return null;
                }

                return (
                  <div key={group} className="space-y-2">
                    <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {group}
                    </div>
                    <div className="space-y-1">
                      {groupItems.map((item) => {
                        const absoluteIndex = results.findIndex(
                          (result) => result.group === item.group && result.id === item.id,
                        );

                        return (
                          <button
                            key={`${item.group}-${item.id}`}
                            type="button"
                            onClick={() => {
                              navigate(item.href);
                              onOpenChange(false);
                            }}
                            className={
                              absoluteIndex === selectedIndex
                                ? "command-row command-row-active"
                                : "command-row command-row-idle"
                            }
                          >
                            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/35 text-muted-foreground">
                              <Search className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium text-foreground">{item.title}</div>
                              <div className="mt-1 truncate text-sm text-muted-foreground">{item.subtitle}</div>
                            </div>
                            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border/80 px-4 py-10 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả phù hợp với từ khóa hiện tại.
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
