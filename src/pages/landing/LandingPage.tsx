import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  CircleDot,
  HandCoins,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  ShieldCheck,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";

import heroImage from "@/assets/hero.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type ShowcaseKey = "dashboard" | "customers" | "reports";

type ShowcaseItem = {
  key: ShowcaseKey;
  label: string;
  title: string;
  description: string;
  metricLabel: string;
  metricValue: string;
  tintClassName: string;
};

type RevealSectionProps = {
  id?: string;
  className?: string;
  delay?: number;
  children: ReactNode;
};

type FeatureLine = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type WorkflowStep = {
  title: string;
  description: string;
};

const NAV_LINKS = [
  { label: "Tính năng", href: "#tinh-nang" },
  { label: "Demo", href: "#demo" },
  { label: "Bắt đầu", href: "#cta" },
] as const;

const TRUST_ITEMS = ["Bảo mật RLS", "Chuẩn hoá quy trình", "Báo cáo real-time"] as const;

const SOCIAL_NUMBERS = [
  { label: "Module nghiệp vụ", value: "8" },
  { label: "Vai trò phân quyền", value: "6" },
  { label: "Độ sẵn sàng", value: "99.9%" },
  { label: "Mức onboarding", value: "< 2 giờ" },
] as const;

const OPERATION_PAIN = [
  "Dữ liệu khách hàng phân tán ở Excel, Zalo, email và khó bàn giao.",
  "Không nhìn thấy trạng thái pipeline và ticket trong cùng một màn hình.",
  "Marketing không đo được hiệu quả chiến dịch theo doanh thu thực.",
] as const;

const FEATURE_LINES: FeatureLine[] = [
  {
    title: "Dashboard kể câu chuyện vận hành",
    description: "Doanh thu, pipeline, ticket ưu tiên và phân khúc khách hàng nằm trong một nhịp đọc.",
    icon: LayoutDashboard,
  },
  {
    title: "CRM thao tác nhanh cho đội sales + CSKH",
    description: "Table mạnh, filter rõ, bulk action và luồng xử lý theo trạng thái thực tế.",
    icon: Users,
  },
  {
    title: "Tự động hóa chăm sóc có kiểm soát",
    description: "Rule theo hành vi, kênh Email/SMS, lịch chạy và theo dõi hiệu suất từng kịch bản.",
    icon: Bot,
  },
  {
    title: "Marketing và hỗ trợ chung một dữ liệu",
    description: "Campaign, ticket, giao dịch và báo cáo dùng cùng nguồn dữ liệu để ra quyết định nhanh.",
    icon: Megaphone,
  },
  {
    title: "Khả năng mở rộng an toàn",
    description: "Giữ nguyên backend/business logic hiện có, nâng cấp UI theo design system nhất quán.",
    icon: ShieldCheck,
  },
];

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: "Thu thập và chuẩn hoá",
    description: "Tập trung dữ liệu khách hàng, lịch sử giao dịch, ticket và nguồn marketing vào cùng một chuẩn hiển thị.",
  },
  {
    title: "Vận hành theo ưu tiên",
    description: "Đội ngũ xử lý theo queue, mức độ khẩn cấp và trạng thái pipeline thay vì xử lý cảm tính.",
  },
  {
    title: "Đo lường và tối ưu liên tục",
    description: "Theo dõi KPI theo ngày/tuần/tháng, xuất báo cáo nhanh và tối ưu quy trình dựa trên dữ liệu thật.",
  },
];

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    title: "Bức tranh vận hành theo thời gian thực",
    description: "Đọc nhanh doanh thu, SLA ticket và tăng trưởng phân khúc khách hàng trong một màn hình.",
    metricLabel: "Doanh thu tháng",
    metricValue: "2,9 tỷ ₫",
    tintClassName: "from-primary/20 via-transparent to-emerald-200/20",
  },
  {
    key: "customers",
    label: "Khách hàng",
    title: "Danh sách khách hàng phục vụ thao tác thực",
    description: "Filter theo trạng thái, phụ trách, hoạt động gần nhất và xử lý hàng loạt không rời màn hình.",
    metricLabel: "Khách hàng hoạt động",
    metricValue: "227",
    tintClassName: "from-sky-300/25 via-transparent to-primary/10",
  },
  {
    key: "reports",
    label: "Báo cáo",
    title: "Báo cáo quản trị cho quyết định nhanh",
    description: "So sánh hiệu suất theo thời gian, kênh và đội nhóm để ưu tiên nguồn lực chính xác.",
    metricLabel: "Tỷ lệ hoàn thành",
    metricValue: "87.4%",
    tintClassName: "from-indigo-300/20 via-transparent to-primary/10",
  },
];

function RevealSection({ id, className, delay = 0, children }: RevealSectionProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(
    () => typeof IntersectionObserver === "undefined",
  );

  useEffect(() => {
    const current = sectionRef.current;
    if (!current) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          setIsVisible(true);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(current);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay > 0 ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <div
      id={id}
      ref={sectionRef}
      style={style}
      className={cn(
        "transition-all duration-500 ease-out motion-reduce:transition-none motion-reduce:transform-none",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function HeroVisual({ item }: { item: ShowcaseItem }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg">
      <div className="flex items-center gap-3 border-b border-border/75 bg-muted/45 px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-rose-400/90" />
          <span className="size-2.5 rounded-full bg-amber-400/90" />
          <span className="size-2.5 rounded-full bg-emerald-400/90" />
        </div>
        <div className="min-w-0 flex-1 truncate rounded-md border border-border/75 bg-card px-2.5 py-1 text-xs text-muted-foreground">
          app.nexcrm.vn/{item.label.toLowerCase()}
        </div>
      </div>

      <div className="relative p-3 sm:p-4">
        <div className={cn("absolute inset-0 bg-gradient-to-br", item.tintClassName)} />
        <img
          src={heroImage}
          alt={`Ảnh giao diện ${item.label}`}
          className="relative z-10 h-auto w-full rounded-xl border border-border/80 object-cover shadow-sm"
        />
        <div className="relative z-10 mt-3 rounded-xl border border-border/80 bg-card/95 p-3 shadow-xs backdrop-blur-sm sm:p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{item.metricLabel}</p>
          <div className="mt-1.5 flex items-end justify-between gap-3">
            <p className="font-mono text-xl font-semibold text-foreground sm:text-2xl">{item.metricValue}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <CircleDot className="size-3" />
              Live
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <nav className="mx-auto flex h-14 w-full max-w-[1240px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/branding/nexcrm-mark.svg" alt="NexCRM logo" className="size-8 rounded-lg object-cover" />
            <span className="text-sm font-semibold text-foreground">NexCRM</span>
          </div>

          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </div>

          <Link
            to="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-transparent bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-xs transition-all duration-150 hover:bg-[rgb(var(--accent-hover-rgb)/1)]"
          >
            Đăng nhập
          </Link>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 -top-20 h-[340px] w-[340px] rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute right-[-8%] top-12 h-[360px] w-[360px] rounded-full bg-sky-400/15 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[32%] h-[280px] w-[280px] rounded-full bg-emerald-300/20 blur-3xl" />
          </div>

          <div className="relative mx-auto grid min-h-[calc(100svh-56px)] w-full max-w-[1240px] content-center gap-10 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 lg:px-8 lg:pb-16 lg:pt-14">
            <RevealSection className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Enterprise CRM UI</p>
              <h1 className="mt-4 text-balance font-display text-[clamp(2.05rem,4.9vw,4rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-foreground">
                NEXCRM
              </h1>
              <p className="mt-3 max-w-xl text-balance text-[clamp(1rem,1.8vw,1.2rem)] leading-7 text-muted-foreground">
                Giao diện SaaS CRM hiện đại để đội ngũ nhìn đúng dữ liệu, hiểu đúng ưu tiên và thao tác nhanh ngay từ lần đầu.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-transparent bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-[rgb(var(--accent-hover-rgb)/1)]"
                >
                  Dùng thử miễn phí
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-border/85 bg-card px-6 text-sm font-semibold text-foreground transition hover:border-border hover:bg-muted/55"
                >
                  Xem demo sản phẩm
                </a>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground">
                {TRUST_ITEMS.map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 text-success" />
                    {item}
                  </span>
                ))}
              </div>
            </RevealSection>

            <RevealSection delay={90}>
              <HeroVisual item={SHOWCASE_ITEMS[0]} />
            </RevealSection>
          </div>
        </section>

        <section className="border-b border-border/70 bg-card/45 py-12 sm:py-14">
          <div className="mx-auto grid w-full max-w-[1240px] gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
            {SOCIAL_NUMBERS.map((stat, index) => (
              <RevealSection
                key={stat.label}
                delay={40 + index * 45}
                className="border-l border-border/75 pl-4"
              >
                <p className="font-mono text-2xl font-semibold text-foreground">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{stat.label}</p>
              </RevealSection>
            ))}
          </div>
        </section>

        <section className="border-b border-border/70 bg-background py-14 sm:py-16">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <RevealSection>
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Bài toán thực tế</p>
                <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                  Khi CRM khó dùng, đội ngũ mất tốc độ ra quyết định
                </h2>
              </div>
            </RevealSection>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {OPERATION_PAIN.map((item, index) => (
                <RevealSection
                  key={item}
                  delay={70 + index * 55}
                  className="border-l-2 border-border/80 pl-4"
                >
                  <p className="text-sm leading-7 text-muted-foreground">{item}</p>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        <section id="tinh-nang" className="scroll-mt-20 border-b border-border/70 bg-card/35 py-14 sm:py-16">
          <div className="mx-auto grid w-full max-w-[1240px] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-8">
            <RevealSection>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Giá trị sản phẩm</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Thiết kế để dữ liệu là trung tâm, không phải hiệu ứng
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
                Mọi màn hình đều đi theo cùng design system, giúp đội ngũ học nhanh, thao tác nhất quán và dễ mở rộng thêm module.
              </p>
            </RevealSection>

            <div className="divide-y divide-border/75 border-y border-border/75">
              {FEATURE_LINES.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <RevealSection
                    key={feature.title}
                    delay={65 + index * 45}
                    className="grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-4"
                  >
                    <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">{feature.title}</p>
                      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                    </div>
                  </RevealSection>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 bg-background py-14 sm:py-16">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <RevealSection>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Luồng vận hành</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Từ dữ liệu rời rạc sang quy trình nhất quán
              </h2>
            </RevealSection>

            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {WORKFLOW_STEPS.map((step, index) => (
                <RevealSection
                  key={step.title}
                  delay={70 + index * 55}
                  className="rounded-xl border border-border/80 bg-card/70 p-4"
                >
                  <div className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-primary">Bước {index + 1}</div>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </RevealSection>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="scroll-mt-20 border-b border-border/70 bg-card/40 py-14 sm:py-16">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <RevealSection>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Demo giao diện</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Mỗi màn hình đều tập trung vào thao tác thực tế
              </h2>
            </RevealSection>

            <RevealSection delay={90} className="mt-8">
              <Tabs defaultValue="dashboard" className="w-full">
                <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-xl border border-border/80 bg-card p-1.5">
                  {SHOWCASE_ITEMS.map((item) => (
                    <TabsTrigger
                      key={item.key}
                      value={item.key}
                      className="rounded-lg px-4 py-2 text-sm data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
                    >
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {SHOWCASE_ITEMS.map((item) => (
                  <TabsContent key={item.key} value={item.key} className="mt-4">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
                      <div className="rounded-2xl border border-border/80 bg-card/80 p-5">
                        <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
                        <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                          <CircleDot className="size-3" />
                          {item.metricLabel}: {item.metricValue}
                        </div>
                      </div>
                      <HeroVisual item={item} />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </RevealSection>
          </div>
        </section>

        <section id="cta" className="scroll-mt-20 border-b border-border/70 bg-background py-14 sm:py-16">
          <div className="mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-8">
            <RevealSection className="rounded-2xl border border-border/80 bg-card px-6 py-10 text-center shadow-sm sm:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Sẵn sàng triển khai</p>
              <h2 className="mt-3 text-balance text-3xl font-semibold tracking-[-0.03em] text-foreground sm:text-4xl">
                Build CRM mà đội ngũ có thể dùng ngay
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Tập trung dữ liệu, chuẩn hoá thao tác và giữ toàn bộ luồng vận hành trên một giao diện rõ ràng, chuyên nghiệp.
              </p>
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/login"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-transparent bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-xs transition hover:bg-[rgb(var(--accent-hover-rgb)/1)]"
                >
                  Bắt đầu miễn phí
                  <ArrowRight className="size-4" />
                </Link>
                <a
                  href="#demo"
                  className="inline-flex h-11 items-center justify-center rounded-lg border border-border/80 bg-background px-6 text-sm font-semibold text-foreground transition hover:bg-muted/55"
                >
                  Xem lại demo
                </a>
              </div>
            </RevealSection>
          </div>
        </section>
      </main>

      <footer className="bg-background py-8">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2.5 text-foreground">
            <img src="/branding/nexcrm-mark.svg" alt="NexCRM logo" className="size-8 rounded-lg object-cover" />
            <span className="font-semibold">NexCRM</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><HandCoins className="size-4" /> Giao dịch</span>
            <span className="inline-flex items-center gap-1.5"><Workflow className="size-4" /> Pipeline</span>
            <span className="inline-flex items-center gap-1.5"><LifeBuoy className="size-4" /> Ticket</span>
            <span className="inline-flex items-center gap-1.5"><BarChart3 className="size-4" /> Báo cáo</span>
          </div>

          <p className="text-xs">© {new Date().getFullYear()} NexCRM. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
