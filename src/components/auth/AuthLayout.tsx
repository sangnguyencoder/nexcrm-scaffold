import type { ReactNode } from "react";
import { BriefcaseBusiness, Clock3, ShieldCheck } from "lucide-react";

import { BrandLogo } from "@/components/shared/brand-logo";
import { getDefaultLogoUrl } from "@/lib/utils";

type AuthLayoutProps = {
  children: ReactNode;
};

const authHighlights = [
  {
    icon: ShieldCheck,
    title: "Đăng nhập an toàn",
    description: "Một điểm truy cập cho CRM, ticket và báo cáo nội bộ.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Hỗ trợ doanh nghiệp",
    description: "Dùng email công việc hoặc Google Workspace để vào nhanh.",
  },
  {
    icon: Clock3,
    title: "Tập trung vào thao tác",
    description: "Mọi thứ gọn trên một màn hình, không banner marketing, không nhiễu.",
  },
];

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel lg:grid-cols-[1.08fr_minmax(26rem,29rem)]">
        <section className="relative hidden overflow-hidden border-r border-border/70 bg-muted/30 p-10 lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.05),transparent_42%)]" />

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <BrandLogo
                  src={getDefaultLogoUrl()}
                  alt="NexCRM"
                  className="size-11 rounded-xl border border-border bg-card p-2"
                  imageClassName="object-contain"
                  fallbackLabel="NexCRM"
                />
                <div className="space-y-1">
                  <div className="font-display text-xl font-bold text-foreground">NexCRM</div>
                  <div className="text-sm text-muted-foreground">Workspace cho đội ngũ CRM và vận hành</div>
                </div>
              </div>

              <div className="max-w-xl space-y-4">
                <span className="inline-flex rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Secure workspace sign-in
                </span>
                <div className="space-y-3">
                  <h1 className="font-display text-4xl font-bold leading-tight text-foreground">
                    Đăng nhập để tiếp tục làm việc trên khách hàng, giao dịch và ticket.
                  </h1>
                  {/* <p className="max-w-lg text-base leading-7 text-muted-foreground">
                    Giao diện được tối ưu cho đăng nhập nhanh, rõ trạng thái, và đủ tin cậy cho cả người dùng nội bộ lẫn doanh nghiệp.
                  </p> */}
                </div>
              </div>

              <div className="grid gap-4">
                {authHighlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-4 rounded-xl border border-border/70 bg-card/90 p-4 shadow-xs"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background">
                        <Icon className="size-4 text-foreground" />
                      </div>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{item.title}</div>
                        <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* <div className="relative z-10 grid gap-3 rounded-xl border border-border/70 bg-background/85 p-5 backdrop-blur">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <span className="rounded-full border border-border/70 px-2.5 py-1">Email / Password</span>
                <span className="rounded-full border border-border/70 px-2.5 py-1">Google Workspace</span>
                <span className="rounded-full border border-border/70 px-2.5 py-1">Enterprise ready</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Nếu tài khoản bị khóa hoặc chưa được cấp profile CRM, người dùng sẽ nhận thông báo rõ ràng ngay trên form thay vì bị treo giao diện.
              </p>
            </div> */}
          </div>
        </section>

        <section className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-4 sm:p-8 lg:min-h-0 lg:p-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </div>
    </div>
  );
}
