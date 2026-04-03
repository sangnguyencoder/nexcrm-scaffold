import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Clock3,
  Lightbulb,
  Mail,
  MessageSquare,
  Play,
  Plus,
  Sparkles,
  Tag,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAutomationQuery, queryKeys, useOutboundMessagesQuery } from "@/hooks/useNexcrmQueries";
import { cn, timeAgo } from "@/lib/utils";
import { automationService } from "@/services/automationService";
import { getAppErrorMessage } from "@/services/shared";

type RuleForm = {
  name: string;
  description: string;
  trigger_type: "birthday" | "inactive_days" | "after_purchase" | "new_customer";
  trigger_days: number;
  channel: "email" | "sms";
  summary: string;
  content: string;
};

const VARIABLE_TOKENS = [
  "{ten_khach_hang}",
  "{ma_khach_hang}",
  "{tong_chi_tieu}",
  "{lan_mua_cuoi}",
] as const;

function getRuleTone(channel: "email" | "sms") {
  return channel === "email"
    ? "from-sky-500/20 via-primary/15 to-transparent"
    : "from-emerald-500/20 via-primary/10 to-transparent";
}

export function AutomationPage() {
  const queryClient = useQueryClient();
  const { data: rules = [] } = useAutomationQuery();
  const { data: outboundMessages = [] } = useOutboundMessagesQuery();
  const [open, setOpen] = useState(false);
  const form = useForm<RuleForm>({
    defaultValues: {
      name: "",
      description: "",
      trigger_type: "birthday",
      trigger_days: 30,
      channel: "email",
      summary: "Gửi ưu đãi tự động",
      content:
        "Xin chào {ten_khach_hang}, NexCRM gửi bạn ưu đãi cá nhân hóa. Tổng chi tiêu gần nhất: {tong_chi_tieu}.",
    },
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
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 3);

      acc[message.automation_rule_id] = current;
      return acc;
    }, {});
  }, [outboundMessages]);

  const createRule = useMutation({
    mutationFn: automationService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      toast.success("Đã tạo quy tắc tự động mới");
      form.reset();
      setOpen(false);
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể tạo quy tắc tự động."));
    },
  });

  const toggleRule = useMutation({
    mutationFn: (id: string) => automationService.toggleActive(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      toast.success("Đã cập nhật trạng thái quy tắc");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể cập nhật trạng thái quy tắc."));
    },
  });

  const runRule = useMutation({
    mutationFn: (id: string) => automationService.runNow(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.automation }),
        queryClient.invalidateQueries({ queryKey: queryKeys.outboundMessages() }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.audit }),
      ]);
      toast.success("Đã chạy quy tắc tự động");
    },
    onError: (error) => {
      toast.error(getAppErrorMessage(error, "Không thể chạy quy tắc tự động."));
    },
  });

  const triggerType = form.watch("trigger_type");
  const channel = form.watch("channel");
  const content = form.watch("content");

  const previewContent = content
    .replaceAll("{ten_khach_hang}", "Nguyễn Minh Anh")
    .replaceAll("{ma_khach_hang}", "KH-2026-0128")
    .replaceAll("{tong_chi_tieu}", "18.500.000 ₫")
    .replaceAll("{lan_mua_cuoi}", "3 ngày trước");

  const appendVariable = (token: string) => {
    form.setValue("content", `${form.getValues("content")} ${token}`.trim(), {
      shouldDirty: true,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chăm Sóc Tự Động"
        subtitle="Thiết lập các kịch bản gửi Email/SMS theo hành vi khách hàng."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="size-4" />
            Tạo Quy Tắc
          </Button>
        }
      />

      <Card>
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Lightbulb className="size-5 text-primary" />
          Hệ thống tự động gửi Email/SMS theo kịch bản đã thiết lập. Quy tắc có thể chạy thủ công để test nhanh trước khi vận hành thật.
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {rules.map((rule) => {
          const messageStats = groupedMessages[rule.id] ?? {
            sent: 0,
            failed: 0,
            lastSentAt: null,
            recent: [],
          };

          return (
            <Card key={rule.id} className="overflow-hidden">
              <div className={cn("border-b border-border bg-gradient-to-br p-5", getRuleTone(rule.channel))}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      <Sparkles className="size-4 text-primary" />
                      Automation Rule
                    </div>
                    <div className="font-display text-xl font-semibold">{rule.name}</div>
                    <div className="max-w-xl text-sm text-muted-foreground">
                      {rule.description || rule.action_summary || "Chưa có mô tả chi tiết cho quy tắc này."}
                    </div>
                  </div>
                  <Switch checked={rule.is_active} onChange={() => toggleRule.mutate(rule.id)} />
                </div>
              </div>

              <CardContent className="space-y-4 p-5">
                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <Zap className="size-4 text-primary" />
                      Trigger
                    </div>
                    <div className="mt-2 text-foreground">{rule.trigger}</div>
                    {rule.trigger_days ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Chu kỳ chi tiết: {rule.trigger_days} ngày
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      {rule.channel === "email" ? (
                        <Mail className="size-4 text-primary" />
                      ) : (
                        <MessageSquare className="size-4 text-primary" />
                      )}
                      Action
                    </div>
                    <div className="mt-2 text-foreground">{rule.action}</div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Kênh: {rule.channel.toUpperCase()} · Tóm tắt: {rule.action_summary || "--"}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">Biến và nội dung mẫu</div>
                    <StatusBadge
                      label={rule.is_active ? "Đang hoạt động" : "Đã tắt"}
                      className="bg-muted text-muted-foreground ring-border"
                      dotClassName={rule.is_active ? "bg-emerald-500" : "bg-slate-400"}
                    />
                  </div>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {rule.variables.map((variable) => (
                      <span
                        key={variable}
                        className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {variable}
                      </span>
                    ))}
                  </div>
                  <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                    {rule.content || "Chưa có nội dung tự động."}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <StatCard
                    icon={Mail}
                    label="Đã gửi"
                    value={String(rule.sent_count)}
                    hint={messageStats.sent ? `${messageStats.sent} gửi thành công gần đây` : "Chưa có lần gửi gần đây"}
                  />
                  <StatCard
                    icon={Clock3}
                    label="Lần chạy gần nhất"
                    value={rule.last_run_at ? timeAgo(rule.last_run_at) : "Chưa chạy"}
                    hint={messageStats.lastSentAt ? `Có outbound ${timeAgo(messageStats.lastSentAt)}` : "Chưa có log outbound"}
                  />
                  <StatCard
                    icon={Tag}
                    label="Lỗi gửi"
                    value={String(messageStats.failed)}
                    hint={messageStats.failed ? "Cần kiểm tra provider hoặc dữ liệu liên hệ" : "Không có lỗi gần đây"}
                  />
                </div>

                {messageStats.recent.length ? (
                  <div className="space-y-3 rounded-2xl border border-border p-4">
                    <div className="text-sm font-medium">Lần chạy gần đây</div>
                    {messageStats.recent.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <div className="font-medium">{item.recipient}</div>
                          <div className="text-muted-foreground">
                            {item.channel.toUpperCase()} · {item.provider}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{item.status}</div>
                          <div className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => runRule.mutate(rule.id)}
                    disabled={runRule.isPending || !rule.is_active}
                  >
                    <Play className="size-4" />
                    Chạy ngay
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Tạo Quy Tắc Tự Động"
        description="Thiết lập trigger, biến nội dung và kênh gửi chi tiết hơn cho quy tắc mới."
        className="max-w-4xl"
      >
        <form className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]" onSubmit={form.handleSubmit((values) => createRule.mutate(values))}>
          <div className="space-y-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Tên quy tắc</span>
              <Input {...form.register("name", { required: true })} placeholder="Ví dụ: Chúc mừng sinh nhật VIP" />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Mô tả ngắn</span>
              <Textarea
                {...form.register("description")}
                placeholder="Mô tả mục tiêu của quy tắc để đội vận hành dễ theo dõi."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-[1fr,160px]">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Điều kiện kích hoạt</span>
                <Select {...form.register("trigger_type")}>
                  <option value="birthday">Sinh nhật khách hàng</option>
                  <option value="inactive_days">Không hoạt động X ngày</option>
                  <option value="after_purchase">Sau khi mua hàng X ngày</option>
                  <option value="new_customer">Khi có khách hàng mới</option>
                </Select>
              </label>

              {triggerType === "inactive_days" || triggerType === "after_purchase" ? (
                <label className="flex flex-col gap-2 text-sm">
                  <span className="font-medium">Số ngày</span>
                  <Input type="number" min={1} max={365} {...form.register("trigger_days", { valueAsNumber: true })} />
                </label>
              ) : null}
            </div>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Kênh gửi</span>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant={channel === "email" ? "default" : "secondary"}
                  onClick={() => form.setValue("channel", "email")}
                >
                  Email
                </Button>
                <Button
                  type="button"
                  variant={channel === "sms" ? "default" : "secondary"}
                  onClick={() => form.setValue("channel", "sms")}
                >
                  SMS
                </Button>
              </div>
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Tóm tắt hành động</span>
              <Input
                {...form.register("summary")}
                placeholder="Ví dụ: Gửi voucher 10% cho khách quay lại"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium">Nội dung tin nhắn</span>
              <Textarea {...form.register("content", { required: true })} rows={8} />
            </label>

            <div className="space-y-2">
              <div className="text-sm font-medium">Chèn biến nhanh</div>
              <div className="flex flex-wrap gap-2">
                {VARIABLE_TOKENS.map((token) => (
                  <Button key={token} type="button" variant="secondary" size="sm" onClick={() => appendVariable(token)}>
                    {token}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={createRule.isPending || !form.watch("name").trim()}>
                {createRule.isPending ? "Đang tạo..." : "Tạo quy tắc"}
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className={cn("border-b border-border bg-gradient-to-br p-5", getRuleTone(channel))}>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  <CalendarClock className="size-4 text-primary" />
                  Preview
                </div>
                <div className="mt-3 font-display text-2xl font-semibold">
                  {form.watch("name") || "Tên quy tắc sẽ hiển thị ở đây"}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {triggerType === "birthday"
                    ? "Kích hoạt vào đúng ngày sinh nhật của khách hàng."
                    : triggerType === "inactive_days"
                      ? `Kích hoạt khi khách hàng không mua hàng trong ${form.watch("trigger_days") || 30} ngày.`
                      : triggerType === "after_purchase"
                        ? `Kích hoạt sau ${form.watch("trigger_days") || 7} ngày kể từ lần mua gần nhất.`
                        : "Kích hoạt khi có khách hàng mới vào hệ thống."}
                </div>
              </div>
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {channel === "email" ? <Mail className="size-4 text-primary" /> : <MessageSquare className="size-4 text-primary" />}
                  {form.watch("summary") || "Tóm tắt hành động sẽ hiển thị ở đây"}
                </div>
                <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
                  {previewContent}
                </div>
                <div className="flex flex-wrap gap-2">
                  {VARIABLE_TOKENS.map((token) => (
                    <span key={token} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                      {token}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </div>
      <div className="mt-3 text-xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
