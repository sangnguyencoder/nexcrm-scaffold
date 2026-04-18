import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  Lightbulb,
  Mail,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Trash2,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { ActionErrorAlert } from "@/components/shared/action-error-alert";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTableShell } from "@/components/shared/data-table-shell";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterSelect } from "@/components/shared/filter-select";
import { FormField } from "@/components/shared/form-field";
import { FormSection } from "@/components/shared/form-section";
import { InspectorList } from "@/components/shared/inspector-list";
import { MetricStrip, MetricStripItem } from "@/components/shared/metric-strip";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoader } from "@/components/shared/page-loader";
import { SectionPanel } from "@/components/shared/section-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { StickyFilterBar } from "@/components/shared/sticky-filter-bar";
import { Can } from "@/components/shared/Can";
import { useAppMutation } from "@/hooks/useAppMutation";
import { queryKeys, useAutomationQuery, useOutboundMessagesQuery } from "@/hooks/useNexcrmQueries";
import { cn, formatNumberCompact, timeAgo } from "@/lib/utils";
import { automationService } from "@/services/automationService";
import { communicationService } from "@/services/communicationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { AutomationRule } from "@/types";

type RuleForm = {
  name: string;
  description: string;
  trigger_type: "birthday" | "inactive_days" | "after_purchase" | "new_customer";
  trigger_days: number;
  channel: "email" | "sms";
  summary: string;
  content: string;
  schedule_enabled: boolean;
  schedule_interval_minutes: number;
};
type RuleSortKey = "status" | "rule" | "trigger" | "channel" | "performance" | "last_run";
type SortDirection = "asc" | "desc";

const VARIABLE_TOKENS = [
  "{ten_khach_hang}",
  "{ma_khach_hang}",
  "{tong_chi_tieu}",
  "{lan_mua_cuoi}",
] as const;

function formatChannel(channel: "email" | "sms") {
  return channel === "email" ? "Email" : "SMS";
}

function getChannelIcon(channel: "email" | "sms") {
  return channel === "email" ? Mail : MessageSquare;
}

function getRuleStatusColor(isActive: boolean) {
  return isActive
    ? "bg-emerald-500/15 text-emerald-600 ring-emerald-500/25 dark:text-emerald-300"
    : "bg-slate-500/15 text-slate-600 ring-slate-500/25 dark:text-slate-300";
}

function getRuleTone(channel: "email" | "sms") {
  return channel === "email"
    ? "from-sky-500/20 via-primary/10 to-transparent"
    : "from-emerald-500/20 via-primary/10 to-transparent";
}

function getTriggerBadgeClass(triggerType: AutomationRule["trigger_type"]) {
  if (triggerType === "inactive_days") return "bg-warning/10 text-warning border-warning/20";
  if (triggerType === "after_purchase") return "bg-success/10 text-success border-success/20";
  if (triggerType === "birthday") return "bg-info/10 text-info border-info/20";
  return "bg-primary/10 text-primary border-primary/20";
}

function getRuleDraft(rule?: AutomationRule | null): RuleForm {
  return {
    name: rule?.name ?? "",
    description: rule?.description ?? "",
    trigger_type: rule?.trigger_type ?? "birthday",
    trigger_days: rule?.trigger_days ?? 30,
    channel: rule?.channel ?? "email",
    summary: rule?.action_summary ?? "Gửi ưu đãi tự động",
    content:
      rule?.content ??
      "Xin chào {ten_khach_hang}, NexCRM gửi bạn ưu đãi cá nhân hóa. Tổng chi tiêu gần nhất: {tong_chi_tieu}.",
    schedule_enabled: rule?.schedule_enabled ?? false,
    schedule_interval_minutes: rule?.schedule_interval_minutes ?? 60,
  };
}

function formatScheduleWindow(rule: AutomationRule) {
  if (!rule.schedule_enabled) return "Chạy thủ công";
  const interval = rule.schedule_interval_minutes ?? 60;
  if (interval >= 1_440) {
    const dayValue = Math.round(interval / 1_440);
    return `Mỗi ${dayValue} ngày`;
  }
  if (interval >= 60) {
    const hourValue = Math.round(interval / 60);
    return `Mỗi ${hourValue} giờ`;
  }
  return `Mỗi ${interval} phút`;
}

function formatIntervalLabel(intervalMinutes: number) {
  if (intervalMinutes >= 1_440) {
    const dayValue = Math.round(intervalMinutes / 1_440);
    return `Mỗi ${dayValue} ngày`;
  }
  if (intervalMinutes >= 60) {
    const hourValue = Math.round(intervalMinutes / 60);
    return `Mỗi ${hourValue} giờ`;
  }
  return `Mỗi ${intervalMinutes} phút`;
}

export function AutomationPage() {
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useAutomationQuery();
  const { data: outboundMessages = [] } = useOutboundMessagesQuery();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "email" | "sms">("all");
  const [sortBy, setSortBy] = useState<RuleSortKey>("last_run");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [detailRule, setDetailRule] = useState<AutomationRule | null>(null);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AutomationRule | null>(null);
  const form = useForm<RuleForm>({
    defaultValues: getRuleDraft(),
  });

  const groupedMessages = useMemo(() => {
    return outboundMessages.reduce<
      Record<
        string,
        {
          sent: number;
          failed: number;
          lastSentAt: string | null;
          recent: typeof outboundMessages;
        }
      >
    >((acc, message) => {
      if (!message.automation_rule_id) return acc;
      const current = acc[message.automation_rule_id] ?? {
        sent: 0,
        failed: 0,
        lastSentAt: null,
        recent: [],
      };

      if (message.status === "failed") {
        current.failed += 1;
      } else {
        current.sent += 1;
      }

      if (!current.lastSentAt || new Date(message.created_at).getTime() > new Date(current.lastSentAt).getTime()) {
        current.lastSentAt = message.created_at;
      }

      current.recent = [...current.recent, message]
        .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
        .slice(0, 5);

      acc[message.automation_rule_id] = current;
      return acc;
    }, {});
  }, [outboundMessages]);

  const filteredRules = useMemo(
    () =>
      rules.filter((rule) => {
        if (activeFilter === "active" && !rule.is_active) return false;
        if (activeFilter === "inactive" && rule.is_active) return false;
        if (channelFilter !== "all" && rule.channel !== channelFilter) return false;
        if (!search.trim()) return true;

        const keyword = search.toLowerCase();
        const haystack = `${rule.name} ${rule.description ?? ""} ${rule.action_summary ?? ""} ${rule.trigger}`.toLowerCase();
        return haystack.includes(keyword);
      }),
    [activeFilter, channelFilter, rules, search],
  );

  const sortedRules = useMemo(() => {
    return [...filteredRules].sort((left, right) => {
      const leftStats = groupedMessages[left.id] ?? { sent: 0, failed: 0, lastSentAt: null };
      const rightStats = groupedMessages[right.id] ?? { sent: 0, failed: 0, lastSentAt: null };
      let compare = 0;

      if (sortBy === "status") {
        compare = Number(left.is_active) - Number(right.is_active);
      } else if (sortBy === "rule") {
        compare = left.name.localeCompare(right.name, "vi");
      } else if (sortBy === "trigger") {
        compare = left.trigger.localeCompare(right.trigger, "vi");
      } else if (sortBy === "channel") {
        compare = left.channel.localeCompare(right.channel, "vi");
      } else if (sortBy === "performance") {
        compare = leftStats.sent - rightStats.sent;
        if (compare === 0) {
          compare = rightStats.failed - leftStats.failed;
        }
      } else {
        const leftRun = left.last_run_at ? new Date(left.last_run_at).getTime() : 0;
        const rightRun = right.last_run_at ? new Date(right.last_run_at).getTime() : 0;
        compare = leftRun - rightRun;
      }

      if (compare === 0) {
        compare = left.name.localeCompare(right.name, "vi");
      }

      return sortDirection === "asc" ? compare : -compare;
    });
  }, [filteredRules, groupedMessages, sortBy, sortDirection]);

  const summary = useMemo(() => {
    const active = rules.filter((rule) => rule.is_active).length;
    const sent = rules.reduce((total, rule) => total + rule.sent_count, 0);
    const failed = rules.reduce((total, rule) => total + (groupedMessages[rule.id]?.failed ?? 0), 0);
    const recentRuns = rules.filter((rule) => rule.last_run_at).length;
    return { active, sent, failed, recentRuns };
  }, [groupedMessages, rules]);

  const toggleSort = (key: RuleSortKey) => {
    setSortBy((currentKey) => {
      if (currentKey === key) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentKey;
      }

      setSortDirection("asc");
      return key;
    });
  };

  const renderSortIcon = (key: RuleSortKey) => {
    if (sortBy !== key) {
      return <ArrowUpDown className="size-3.5 text-muted-foreground/70" />;
    }

    return sortDirection === "asc" ? (
      <ChevronUp className="size-3.5 text-primary" />
    ) : (
      <ChevronDown className="size-3.5 text-primary" />
    );
  };

  const saveRule = useAppMutation({
    action: editingRule ? "automation.update" : "automation.create",
    errorMessage: editingRule
      ? "Không thể cập nhật quy tắc tự động."
      : "Không thể tạo quy tắc tự động.",
    successMessage: editingRule
      ? "Đã cập nhật quy tắc tự động"
      : "Đã tạo quy tắc tự động mới",
    mutationFn: (values: RuleForm) => {
      const scheduleEnabled = values.schedule_enabled === true;
      const scheduleIntervalMinutes = Number.isFinite(values.schedule_interval_minutes)
        ? Math.max(5, Math.round(values.schedule_interval_minutes))
        : 60;
      const payload = {
        name: values.name,
        description: values.description,
        trigger_type: values.trigger_type,
        trigger_days: values.trigger_days,
        channel: values.channel,
        summary: values.summary,
        content: values.content,
        schedule_enabled: scheduleEnabled,
        schedule_interval_minutes: scheduleEnabled ? scheduleIntervalMinutes : null,
      };

      return editingRule
        ? automationService.update(editingRule.id, payload)
        : automationService.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      form.reset(getRuleDraft());
      setEditingRule(null);
      setOpen(false);
    },
  });

  const runScheduler = useAppMutation({
    action: "scheduler.tick",
    errorMessage: "Không thể chạy scheduler tự động.",
    mutationFn: () => communicationService.runSchedulerTick(),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.automation }),
        queryClient.invalidateQueries({ queryKey: queryKeys.outboundMessages() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.campaigns() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      ]);

      const processed = result.processedCampaigns + result.processedAutomationRules;
      if (processed > 0) {
        toast.success(`Scheduler đã xử lý ${processed} job đến hạn.`);
      } else {
        toast("Không có job đến hạn để chạy.");
      }
    },
  });

  const toggleRule = useAppMutation({
    action: "automation.toggle",
    errorMessage: "Không thể cập nhật trạng thái quy tắc.",
    successMessage: "Đã cập nhật trạng thái quy tắc",
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => automationService.toggleActive(id, isActive),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
    },
  });

  const runRule = useAppMutation({
    action: "automation.run",
    errorMessage: "Không thể chạy quy tắc tự động.",
    successMessage: "Đã chạy quy tắc tự động",
    mutationFn: (id: string) => automationService.runNow(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.automation }),
        queryClient.invalidateQueries({ queryKey: queryKeys.outboundMessages() }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
    },
  });

  const duplicateRule = useAppMutation({
    action: "automation.duplicate",
    errorMessage: "Không thể nhân bản quy tắc tự động.",
    successMessage: "Đã nhân bản quy tắc tự động",
    mutationFn: automationService.duplicate,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
    },
  });

  const deleteRule = useAppMutation({
    action: "automation.delete",
    errorMessage: "Không thể xóa quy tắc tự động.",
    successMessage: "Đã xóa quy tắc tự động",
    mutationFn: automationService.delete,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.automation }),
        queryClient.invalidateQueries({ queryKey: queryKeys.outboundMessages() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
      setDetailRule(null);
    },
  });

  const openRuleEditor = (rule?: AutomationRule | null) => {
    setEditingRule(rule ?? null);
    form.reset(getRuleDraft(rule));
    setOpen(true);
  };

  useEffect(() => {
    if (open) {
      form.reset(getRuleDraft(editingRule));
    }
  }, [editingRule, form, open]);

  const triggerType = useWatch({ control: form.control, name: "trigger_type" });
  const triggerDays = useWatch({ control: form.control, name: "trigger_days" });
  const channel = useWatch({ control: form.control, name: "channel" });
  const content = useWatch({ control: form.control, name: "content" });
  const ruleName = useWatch({ control: form.control, name: "name" });
  const ruleSummary = useWatch({ control: form.control, name: "summary" });
  const scheduleEnabled = useWatch({ control: form.control, name: "schedule_enabled" });
  const scheduleIntervalMinutes = useWatch({
    control: form.control,
    name: "schedule_interval_minutes",
  });

  const previewContent = (content || "")
    .replaceAll("{ten_khach_hang}", "Nguyễn Minh Anh")
    .replaceAll("{ma_khach_hang}", "KH-2026-0128")
    .replaceAll("{tong_chi_tieu}", "18.500.000 ₫")
    .replaceAll("{lan_mua_cuoi}", "3 ngày trước");

  const appendVariable = (token: string) => {
    form.setValue("content", `${form.getValues("content")} ${token}`.trim(), {
      shouldDirty: true,
    });
  };

  if (isLoading) {
    return <PageLoader panels={2} />;
  }

  const detailStats = detailRule ? groupedMessages[detailRule.id] : undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chăm Sóc Tự Động"
        // subtitle="Rule list, trigger và kết quả gửi được gom vào cùng một workspace để team vận hành scan nhanh hơn."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => runScheduler.mutate()}
              disabled={runScheduler.isPending}
            >
              <CalendarClock className="size-4" />
              {runScheduler.isPending ? "Đang chạy lịch..." : "Chạy lịch"}
            </Button>
            <Can roles={["super_admin", "admin", "director", "marketing", "cskh"]}>
              <Button onClick={() => openRuleEditor()}>
                <Plus className="size-4" />
                Tạo Quy Tắc
              </Button>
            </Can>
          </div>
        }
      />

      <MetricStrip>
        <MetricStripItem
          label="Quy tắc"
          value={formatNumberCompact(rules.length)}
          helper={`${formatNumberCompact(summary.active)} rule đang hoạt động.`}
          icon={Zap}
          tone="primary"
        />
        <MetricStripItem
          label="Đã gửi"
          value={formatNumberCompact(summary.sent)}
          helper="Outbound message từ tất cả quy tắc."
          icon={Mail}
          tone="success"
        />
        <MetricStripItem
          label="Thất bại"
          value={formatNumberCompact(summary.failed)}
          helper="Dùng để kiểm tra provider hoặc dữ liệu liên hệ."
          icon={AlertTriangle}
          tone="danger"
        />
        <MetricStripItem
          label="Đã chạy"
          value={formatNumberCompact(summary.recentRuns)}
          helper="Rule đã có ít nhất một lần run."
          icon={CalendarClock}
          tone="info"
        />
      </MetricStrip>

      <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-primary" />
          Ưu tiên compact list để operator thấy trigger, kênh, last run và tình trạng gửi trong một màn thay vì card grid dài.
        </div>
      </div>

      <StickyFilterBar>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo rule, mô tả hoặc trigger"
          aria-label="Tìm quy tắc tự động"
          className="min-w-[300px] flex-1"
        />
        <FilterSelect
          value={activeFilter}
          onValueChange={(nextValue) => setActiveFilter(nextValue as typeof activeFilter)}
          options={[
            { value: "all", label: "Tất cả trạng thái" },
            { value: "active", label: "Đang hoạt động" },
            { value: "inactive", label: "Đã tắt" },
          ]}
          className="w-[190px]"
        />
        <FilterSelect
          value={channelFilter}
          onValueChange={(nextValue) => setChannelFilter(nextValue as typeof channelFilter)}
          options={[
            { value: "all", label: "Tất cả kênh" },
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" },
          ]}
          className="w-[180px]"
        />
      </StickyFilterBar>

      <DataTableShell stickyHeader>
        {sortedRules.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("status")}>
                    Trạng thái
                    {renderSortIcon("status")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("rule")}>
                    Quy tắc
                    {renderSortIcon("rule")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("trigger")}>
                    Trigger
                    {renderSortIcon("trigger")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("channel")}>
                    Kênh
                    {renderSortIcon("channel")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("performance")}>
                    Hiệu suất
                    {renderSortIcon("performance")}
                  </button>
                </TableHead>
                <TableHead>
                  <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleSort("last_run")}>
                    Lần chạy
                    {renderSortIcon("last_run")}
                  </button>
                </TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRules.map((rule) => {
                const messageStats = groupedMessages[rule.id] ?? {
                  sent: 0,
                  failed: 0,
                  lastSentAt: null,
                  recent: [],
                };
                const ChannelIcon = getChannelIcon(rule.channel);

                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={rule.is_active}
                          onChange={(event) =>
                            void toggleRule.mutateAsync({ id: rule.id, isActive: event.target.checked })
                          }
                          aria-label={`Bật tắt quy tắc ${rule.name}`}
                        />
                        <StatusBadge
                          label={rule.is_active ? "Đang bật" : "Đã tắt"}
                          className={getRuleStatusColor(rule.is_active)}
                          dotClassName="bg-current"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <button type="button" onClick={() => setDetailRule(rule)} className="min-w-0 text-left">
                        <div className="text-sm font-medium text-foreground">{rule.name}</div>
                        <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {rule.description || rule.action_summary || "Chưa có mô tả chi tiết"}
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={rule.trigger}
                        className={getTriggerBadgeClass(rule.trigger_type)}
                        dotClassName="bg-current"
                      />
                      <div className="text-xs text-muted-foreground">
                        {rule.trigger_days ? `${rule.trigger_days} ngày` : "Kích hoạt tức thời"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatScheduleWindow(rule)}
                        {rule.schedule_enabled && rule.schedule_next_run_at
                          ? ` · tiếp theo ${timeAgo(rule.schedule_next_run_at)}`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ChannelIcon className="size-4 text-primary" />
                        {formatChannel(rule.channel)}
                      </div>
                      <div className="text-xs text-muted-foreground">{rule.action_summary || "--"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{messageStats.sent} gửi thành công</div>
                      <div className="text-xs text-muted-foreground">{messageStats.failed} lỗi gần đây</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{rule.last_run_at ? timeAgo(rule.last_run_at) : "Chưa chạy"}</div>
                      <div className="text-xs text-muted-foreground">
                        {messageStats.lastSentAt ? `Outbound ${timeAgo(messageStats.lastSentAt)}` : "Chưa có outbound"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDetailRule(rule)}>
                          Xem
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openRuleEditor(rule)}>
                          <Pencil className="size-4" />
                          Sửa
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runRule.mutate(rule.id)}
                          disabled={runRule.isPending || !rule.is_active}
                        >
                          <Play className="size-4" />
                          Chạy
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-4">
            <EmptyState
              icon={Zap}
              title="Không có quy tắc phù hợp"
              description="Thử bộ lọc khác hoặc tạo quy tắc mới để bắt đầu automation."
              className="min-h-[220px] border-dashed bg-transparent shadow-none"
            />
          </div>
        )}
      </DataTableShell>

      <Sheet
        open={Boolean(detailRule)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDetailRule(null);
          }
        }}
        title={detailRule?.name ?? "Chi tiết quy tắc"}
        // description={detailRule ? "Inspector vận hành cho trigger, nội dung, recent delivery và các action chính của rule." : undefined}
        className="w-[min(100vw,720px)]"
        footer={
          detailRule ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" onClick={() => setDetailRule(null)}>
                Đóng
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={() => openRuleEditor(detailRule)}>
                  <Pencil className="size-4" />
                  Chỉnh sửa
                </Button>
                <Button variant="outline" onClick={() => duplicateRule.mutate(detailRule.id)} disabled={duplicateRule.isPending}>
                  <Copy className="size-4" />
                  Nhân bản
                </Button>
                <Button variant="destructive" onClick={() => setDeleteTarget(detailRule)}>
                  <Trash2 className="size-4" />
                  Xóa
                </Button>
                <Button onClick={() => runRule.mutate(detailRule.id)} disabled={runRule.isPending || !detailRule.is_active}>
                  <Play className="size-4" />
                  Chạy ngay
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {detailRule ? (
          <div className="space-y-4">
            <SectionPanel title="Tổng quan vận hành" /* description="Các thông tin quyết định để bật, tắt hoặc chạy rule." */>
              <InspectorList
                items={[
                  { label: "Trigger", value: detailRule.trigger },
                  { label: "Kênh", value: formatChannel(detailRule.channel) },
                  { label: "Trạng thái", value: detailRule.is_active ? "Đang bật" : "Đã tắt" },
                  { label: "Lịch chạy", value: formatScheduleWindow(detailRule) },
                  {
                    label: "Lần chạy lịch kế tiếp",
                    value: detailRule.schedule_next_run_at ? timeAgo(detailRule.schedule_next_run_at) : "Chưa bật lịch",
                  },
                  {
                    label: "Trạng thái scheduler",
                    value:
                      detailRule.schedule_last_status === "failed"
                        ? "Lỗi"
                        : detailRule.schedule_last_status === "success"
                          ? "Thành công"
                          : "Chưa chạy",
                  },
                  { label: "Lần chạy", value: detailRule.last_run_at ? timeAgo(detailRule.last_run_at) : "Chưa chạy" },
                ]}
              />
              {detailRule.schedule_last_error ? (
                <div className="mt-3 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
                  Lỗi scheduler gần nhất: {detailRule.schedule_last_error}
                </div>
              ) : null}
            </SectionPanel>

            <SectionPanel title="Nội dung gửi" /* description="Body mẫu cùng các token cá nhân hóa được dùng bởi rule." */>
              <div className={cn("rounded-lg border border-border/70 bg-gradient-to-br p-4", getRuleTone(detailRule.channel))}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <CalendarClock className="size-4 text-primary" />
                  Preview
                </div>
                <div className="mt-3 text-sm font-medium text-foreground">
                  {detailRule.action_summary || detailRule.name}
                </div>
                <div className="mt-3 rounded-lg bg-card/70 p-3 text-sm text-muted-foreground">
                  {detailRule.content || "Chưa có nội dung."}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {detailRule.variables.map((variable) => (
                    <StatusBadge
                      key={variable}
                      label={variable}
                      className="bg-card/60 text-muted-foreground ring-border"
                      dotClassName="bg-primary/70"
                    />
                  ))}
                </div>
              </div>
            </SectionPanel>

            <SectionPanel title="Recent delivery" /* description="5 lần gửi gần nhất để đọc provider và trạng thái." */>
              {detailStats?.recent.length ? (
                <div className="space-y-3">
                  {detailStats.recent.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 text-sm">
                      <div>
                        <div className="font-medium text-foreground">{item.recipient}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.channel.toUpperCase()} · {item.provider}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-foreground">{item.status}</div>
                        <div className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">Chưa có log outbound cho quy tắc này.</div>
              )}
            </SectionPanel>
          </div>
        ) : null}
      </Sheet>

      <Modal
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            setEditingRule(null);
            form.reset(getRuleDraft());
          }
        }}
        title={editingRule ? "Chỉnh sửa quy tắc tự động" : "Tạo Quy Tắc Tự Động"}
        description={
          editingRule
            ? undefined // "Cập nhật trigger, nội dung và summary trong cùng một modal chỉnh sửa."
            : undefined // "Thiết lập trigger, nội dung và preview trong một modal ngắn gọn hơn cho team vận hành."
        }
        className="max-w-4xl"
        footer={
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button
              onClick={form.handleSubmit((values) => saveRule.mutate(values))}
              disabled={saveRule.isPending || !ruleName.trim()}
            >
              {saveRule.isPending ? "Đang lưu…" : editingRule ? "Lưu thay đổi" : "Tạo quy tắc"}
            </Button>
          </div>
        }
      >
        <form className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]" onSubmit={form.handleSubmit((values) => saveRule.mutate(values))}>
          <div className="space-y-4">
            {saveRule.actionError ? (
              <ActionErrorAlert
                error={saveRule.actionError}
                onDismiss={saveRule.clearActionError}
                onRetry={saveRule.canRetry ? () => void saveRule.retryLast() : undefined}
              />
            ) : null}

            <FormSection title="Thông tin quy tắc" /* description="Đặt tên rõ ràng để đội vận hành biết rule này xử lý tình huống nào." */>
              <div className="grid gap-4">
                <FormField label="Tên quy tắc">
                  <Input {...form.register("name", { required: true })} placeholder="Ví dụ: Chúc mừng sinh nhật VIP" />
                </FormField>
                <FormField label="Mô tả ngắn">
                  <Textarea
                    {...form.register("description")}
                    placeholder="Mô tả mục tiêu của quy tắc để đội vận hành dễ theo dõi."
                    rows={4}
                  />
                </FormField>
                <div className="grid gap-4 md:grid-cols-[1fr,150px]">
                  <FormField label="Điều kiện kích hoạt">
                    <FilterSelect
                      value={triggerType}
                      onValueChange={(nextValue) =>
                        form.setValue("trigger_type", nextValue as RuleForm["trigger_type"], {
                          shouldDirty: true,
                        })
                      }
                      options={[
                        { value: "birthday", label: "Sinh nhật khách hàng" },
                        { value: "inactive_days", label: "Không hoạt động X ngày" },
                        { value: "after_purchase", label: "Sau khi mua hàng X ngày" },
                        { value: "new_customer", label: "Khi có khách hàng mới" },
                      ]}
                    />
                  </FormField>
                  {triggerType === "inactive_days" || triggerType === "after_purchase" ? (
                    <FormField label="Số ngày">
                      <Input type="number" min={1} max={365} {...form.register("trigger_days", { valueAsNumber: true })} />
                    </FormField>
                  ) : null}
                </div>
              </div>
            </FormSection>

            <FormSection title="Lịch chạy tự động" /* description="Cho phép bật chạy theo định kỳ thay vì chỉ chạy thủ công." */>
              <div className="grid gap-4">
                <FormField label="Chế độ chạy">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => form.setValue("schedule_enabled", false, { shouldDirty: true })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition",
                        !scheduleEnabled
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      Chạy thủ công
                    </button>
                    <button
                      type="button"
                      onClick={() => form.setValue("schedule_enabled", true, { shouldDirty: true })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm font-medium transition",
                        scheduleEnabled
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/40",
                      )}
                    >
                      Chạy theo lịch
                    </button>
                  </div>
                </FormField>
                {scheduleEnabled ? (
                  <FormField label="Chu kỳ chạy">
                    <FilterSelect
                      value={String(scheduleIntervalMinutes || 60)}
                      onValueChange={(nextValue) =>
                        form.setValue("schedule_interval_minutes", Number(nextValue), {
                          shouldDirty: true,
                        })
                      }
                      options={[
                        { value: "15", label: "Mỗi 15 phút" },
                        { value: "30", label: "Mỗi 30 phút" },
                        { value: "60", label: "Mỗi 1 giờ" },
                        { value: "180", label: "Mỗi 3 giờ" },
                        { value: "360", label: "Mỗi 6 giờ" },
                        { value: "1440", label: "Mỗi 1 ngày" },
                      ]}
                    />
                  </FormField>
                ) : null}
              </div>
            </FormSection>

            <FormSection title="Hành động gửi" /* description="Giữ summary, channel và body sát nhau để chỉnh rule nhanh hơn." */>
              <div className="grid gap-4">
                <FormField label="Kênh gửi">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Email", value: "email" as const },
                      { label: "SMS", value: "sms" as const },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => form.setValue("channel", option.value)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm font-medium transition",
                          channel === option.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </FormField>
                <FormField label="Tóm tắt hành động">
                  <Input {...form.register("summary")} placeholder="Ví dụ: Gửi voucher 10% cho khách quay lại" />
                </FormField>
                <FormField label="Nội dung tin nhắn">
                  <Textarea {...form.register("content", { required: true })} rows={8} />
                </FormField>
                <FormField label="Chèn biến nhanh">
                  <div className="flex flex-wrap gap-2">
                    {VARIABLE_TOKENS.map((token) => (
                      <Button key={token} type="button" variant="secondary" size="sm" onClick={() => appendVariable(token)}>
                        {token}
                      </Button>
                    ))}
                  </div>
                </FormField>
              </div>
            </FormSection>
          </div>

          <div className="space-y-4">
            <SectionPanel title="Preview" /* description="Bản xem nhanh của trigger và nội dung sau khi cá nhân hóa." */>
              <div className={cn("rounded-lg border border-border/70 bg-gradient-to-br p-4", getRuleTone(channel))}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <CalendarClock className="size-4 text-primary" />
                  Preview
                </div>
                <div className="mt-3 font-display text-2xl font-semibold text-foreground">
                  {ruleName || "Tên quy tắc sẽ hiển thị ở đây"}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {triggerType === "birthday"
                    ? "Kích hoạt vào đúng ngày sinh nhật của khách hàng."
                    : triggerType === "inactive_days"
                      ? `Kích hoạt khi khách hàng không mua hàng trong ${triggerDays || 30} ngày.`
                      : triggerType === "after_purchase"
                        ? `Kích hoạt sau ${triggerDays || 7} ngày kể từ lần mua gần nhất.`
                        : "Kích hoạt khi có khách hàng mới vào hệ thống."}
                </div>
                <div className="mt-4 rounded-lg bg-card/75 p-4 text-sm text-muted-foreground">
                  {previewContent}
                </div>
              </div>
            </SectionPanel>

            <SectionPanel title="Tóm tắt vận hành" /* description="Các thông tin cuối cùng trước khi lưu rule mới." */>
              <InspectorList
                items={[
                  { label: "Kênh", value: formatChannel(channel) },
                  { label: "Trigger", value: triggerType },
                  { label: "Số ngày", value: String(triggerDays || 0) },
                  {
                    label: "Lịch chạy",
                    value: scheduleEnabled ? formatIntervalLabel(scheduleIntervalMinutes || 60) : "Thủ công",
                  },
                  { label: "Action", value: ruleSummary || "--" },
                ]}
              />
            </SectionPanel>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteTarget(null);
          }
        }}
        title="Xóa quy tắc tự động"
        description="Quy tắc này sẽ bị xóa khỏi hệ thống và không thể hoàn tác."
        confirmLabel="Xóa quy tắc"
        onConfirm={() => {
          if (deleteTarget) {
            deleteRule.mutate(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      >
        {deleteTarget ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-sm">
            <div className="font-medium text-foreground">{deleteTarget.name}</div>
            <div className="mt-1 text-muted-foreground">
              {deleteTarget.trigger} · {formatChannel(deleteTarget.channel)}
            </div>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
