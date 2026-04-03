import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import {
  useCampaignsQuery,
  useCustomersQuery,
  useTicketsQuery,
} from "@/hooks/useNexcrmQueries";
import { timeAgo, toSlug } from "@/lib/utils";

type SearchItem = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
};

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
  const { data: customers = [] } = useCustomersQuery();
  const { data: tickets = [] } = useTicketsQuery();
  const { data: campaigns = [] } = useCampaignsQuery();

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
    const keyword = toSlug(query.trim());
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
  }, [campaigns, customers, query, tickets]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
      description="Tìm khách hàng, ticket và chiến dịch bằng Cmd+K hoặc Ctrl+K"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm khách hàng, ticket, chiến dịch..."
            className="pl-9"
          />
        </div>
        <div className="max-h-[420px] space-y-4 overflow-y-auto">
          {["Khách hàng", "Ticket", "Chiến dịch"].map((group) => {
            const groupItems = results.filter((item) => item.group === group);
            if (!groupItems.length) return null;

            return (
              <div key={group} className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </div>
                <div className="space-y-2">
                  {groupItems.map((item) => {
                    const absoluteIndex = results.findIndex((result) => result.id === item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          navigate(item.href);
                          onOpenChange(false);
                        }}
                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                          absoluteIndex === selectedIndex
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="font-medium">{item.title}</div>
                        <div className="text-sm text-muted-foreground">{item.subtitle}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {!results.length && query ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả phù hợp.
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
