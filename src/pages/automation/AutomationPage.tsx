import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Mail, MessageSquare, Play, Plus, Zap } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAutomationQuery, queryKeys } from "@/hooks/useNexcrmQueries";
import { automationService } from "@/services/automationService";
import { useState } from "react";

type RuleForm = {
  name: string;
  trigger: string;
  channel: "email" | "sms";
  content: string;
};

export function AutomationPage() {
  const queryClient = useQueryClient();
  const { data: rules = [] } = useAutomationQuery();
  const [open, setOpen] = useState(false);
  const form = useForm<RuleForm>({
    defaultValues: {
      name: "",
      trigger: "Vào ngày sinh nhật của khách hàng",
      channel: "email",
      content: "Xin chào {tên_khách_hàng}, đây là nội dung tự động từ NexCRM.",
    },
  });

  const createRule = useMutation({
    mutationFn: automationService.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      toast.success("Đã tạo quy tắc tự động mới");
      form.reset();
      setOpen(false);
    },
  });

  const toggleRule = useMutation({
    mutationFn: (id: string) => automationService.toggleActive(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.automation });
      toast.success("Đã cập nhật trạng thái quy tắc");
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
  });

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
          Hệ thống tự động gửi Email/SMS theo kịch bản đã thiết lập
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle>{rule.name}</CardTitle>
                <div className="mt-1 text-sm text-muted-foreground">{rule.trigger}</div>
              </div>
              <Switch checked={rule.is_active} onChange={() => toggleRule.mutate(rule.id)} />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Zap className="size-4 text-primary" />
                  Trigger
                </div>
                <div className="mt-1 text-muted-foreground">{rule.trigger}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {rule.channel === "email" ? (
                    <Mail className="size-4 text-primary" />
                  ) : (
                    <MessageSquare className="size-4 text-primary" />
                  )}
                  Action
                </div>
                <div className="mt-1 text-muted-foreground">{rule.action}</div>
              </div>
              <div className="flex items-center justify-between">
                <StatusBadge
                  label={rule.is_active ? "Đang hoạt động" : "Đã tắt"}
                  className="bg-muted text-muted-foreground ring-border"
                  dotClassName={rule.is_active ? "bg-emerald-500" : "bg-slate-400"}
                />
                <div className="text-sm text-muted-foreground">Đã gửi: {rule.sent_count} lần</div>
              </div>
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
        ))}
      </div>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Tạo Quy Tắc Tự Động"
        description="Thiết lập kịch bản kích hoạt và nội dung gửi tự động."
      >
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => createRule.mutate(values))}>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Tên quy tắc</span>
            <input className="h-10 rounded-xl border border-border bg-background px-3" {...form.register("name")} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Điều kiện kích hoạt</span>
            <Select {...form.register("trigger")}>
              <option value="Vào ngày sinh nhật của khách hàng">Sinh nhật</option>
              <option value="Không mua hàng trong 30 ngày">Không hoạt động X ngày</option>
              <option value="Sau khi mua hàng 7 ngày">Sau khi mua hàng X ngày</option>
            </Select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Kênh gửi</span>
            <div className="flex gap-3">
              <Button type="button" variant={form.watch("channel") === "email" ? "default" : "secondary"} onClick={() => form.setValue("channel", "email")}>
                Email
              </Button>
              <Button type="button" variant={form.watch("channel") === "sms" ? "default" : "secondary"} onClick={() => form.setValue("channel", "sms")}>
                SMS
              </Button>
            </div>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium">Nội dung tin nhắn</span>
            <Textarea {...form.register("content")} />
            <span className="text-xs text-muted-foreground">Hỗ trợ biến {"{tên_khách_hàng}"}</span>
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={createRule.isPending}>
              {createRule.isPending ? "Đang tạo..." : "Tạo quy tắc"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
