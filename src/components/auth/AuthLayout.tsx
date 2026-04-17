import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative hidden overflow-hidden border-r border-border lg:flex">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(37,99,235,0.06) 0%, transparent 55%), radial-gradient(ellipse 60% 80% at 80% 20%, rgba(16,185,129,0.04) 0%, transparent 50%), #f8f9fb",
            }}
          />
          <div className="relative z-10 flex w-full items-center px-16">
              <div className="space-y-7">
              <img
                src="/branding/nexcrm-mark.svg"
                alt="NexCRM logo"
                className="size-12 rounded-xl object-cover"
              />
              <div className="space-y-2">
                <div className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Quản lý khách hàng</div>
                <div className="text-4xl font-bold leading-tight text-foreground">thông minh hơn</div>
                <div className="text-xl font-light text-muted-foreground">cho doanh nghiệp Việt</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">Bảo mật RLS</span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">Real-time</span>
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">8 Module</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-l border-border bg-card">
          <div className="mx-auto flex min-h-screen w-full max-w-sm items-center py-16">
            <div className="w-full px-6 sm:px-0">{children}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
