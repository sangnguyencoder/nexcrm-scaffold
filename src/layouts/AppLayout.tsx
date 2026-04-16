import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  PlugZap,
  ScrollText,
  Search,
  Settings,
  Target,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotificationsQuery, useSettingsQuery } from "@/hooks/useNexcrmQueries";
import { useNotificationRealtime } from "@/hooks/useNotificationRealtime";
import { cn, formatRole, getDefaultAvatarUrl, getDefaultLogoUrl } from "@/lib/utils";
import { preloadRoutePath } from "@/routes/route-modules";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import type { PermissionKey } from "@/utils/permissions";

const NotificationCenter = lazy(() =>
  import("@/components/shared/notification-center").then((module) => ({
    default: module.NotificationCenter,
  })),
);
const GlobalSearch = lazy(() =>
  import("@/components/shared/global-search").then((module) => ({
    default: module.GlobalSearch,
  })),
);

function preloadGlobalSearch() {
  void import("@/components/shared/global-search");
}

function preloadNotificationCenter() {
  void import("@/components/shared/notification-center");
}

const navGroups: Array<{
  title: string;
  items: Array<{ label: string; href: string; icon: typeof LayoutDashboard; permission?: PermissionKey }>;
}> = [
  {
    title: "TỔNG QUAN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard:read" },
      { label: "Báo Cáo", href: "/reports", icon: BarChart3, permission: "report:read" },
    ],
  },
  {
    title: "KHÁCH HÀNG",
    items: [
      { label: "Khách Hàng", href: "/customers", icon: Users, permission: "customer:read" },
      { label: "Pipeline", href: "/pipeline", icon: Target, permission: "deal:read" },
      { label: "Giao Dịch", href: "/transactions", icon: CreditCard, permission: "transaction:read" },
    ],
  },
  {
    title: "HỖ TRỢ",
    items: [
      { label: "Ticket", href: "/tickets", icon: MessageSquare, permission: "ticket:read" },
      { label: "Chăm Sóc Tự Động", href: "/automation", icon: Zap, permission: "automation:read" },
    ],
  },
  {
    title: "MARKETING",
    items: [{ label: "Chiến Dịch", href: "/campaigns", icon: Megaphone, permission: "campaign:read" }],
  },
  {
    title: "HỆ THỐNG",
    items: [
      {
        label: "Người Dùng",
        href: "/admin/users",
        icon: UserCog,
        permission: "user:read",
      },
      { label: "Cài Đặt", href: "/admin/settings", icon: Settings, permission: "settings:update" },
      {
        label: "Nhật Ký",
        href: "/admin/audit",
        icon: ScrollText,
        permission: "audit:read",
      },
      {
        label: "POS Sync",
        href: "/admin/pos-sync",
        icon: PlugZap,
        permission: "posSync:read",
      },
    ],
  },
];

const breadcrumbMap: Record<string, string> = {
  dashboard: "Dashboard",
  reports: "Báo Cáo",
  customers: "Khách Hàng",
  pipeline: "Pipeline",
  transactions: "Giao Dịch",
  tickets: "Ticket",
  automation: "Chăm Sóc Tự Động",
  campaigns: "Chiến Dịch",
  admin: "Hệ Thống",
  users: "Người Dùng",
  settings: "Cài Đặt",
  audit: "Nhật Ký",
  "pos-sync": "POS Sync",
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const canAccess = useAuthStore((state) => state.canAccess);
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const notificationOpen = useUiStore((state) => state.notificationOpen);
  const setNotificationOpen = useUiStore((state) => state.setNotificationOpen);
  const { data: notifications = [] } = useNotificationsQuery(user?.id);
  const { data: settings } = useSettingsQuery();
  useNotificationRealtime(user?.id);
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const [searchOpen, setSearchOpen] = useState(false);
  const companyName = settings?.company_name ?? "NexCRM Demo";
  const companyPlan = settings?.plan ?? "Free";
  const logoUrl = settings?.logo_url || getDefaultLogoUrl();
  const displayName = profile?.full_name ?? user?.email ?? "NexCRM";
  const displayRole = role ?? "sales";
  const displayAvatar = profile?.avatar_url || getDefaultAvatarUrl(displayRole);

  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumb = segments.map((segment) => breadcrumbMap[segment] ?? segment);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.permission ? canAccess(item.permission) : true,
          ),
        }))
        .filter((group) => group.items.length > 0),
    [canAccess],
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-3 py-3 transition-[width] duration-150",
          sidebarCollapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex min-w-0 items-center gap-3 overflow-hidden rounded-lg px-1 py-1 transition hover:bg-muted/60"
            aria-label="Đi tới dashboard"
          >
            <BrandLogo
              src={logoUrl}
              alt={companyName}
              fallbackLabel={companyName}
              className="size-9 rounded-lg border border-border/70 bg-background/90 p-2"
            />
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Workspace
                </div>
                <div className="truncate font-display text-base font-semibold tracking-[-0.02em]">
                  {companyName}
                </div>
              </div>
            ) : null}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-lg text-muted-foreground hover:text-foreground"
            onClick={toggleSidebar}
            aria-label="Thu gọn hoặc mở rộng thanh bên"
          >
            {sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        {!sidebarCollapsed ? (
          <div className="mt-3 px-2">
            <div className="rounded-lg border border-border/70 bg-card/80 px-3 py-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Active plan
                  </div>
                  <div className="mt-1 text-sm font-medium">{companyPlan}</div>
                </div>
                <Badge className="bg-primary/10 text-primary ring-primary/20">CRM</Badge>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-1 flex-col gap-5 overflow-y-auto pr-1">
          {visibleGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1.5">
              {!sidebarCollapsed ? (
                <div className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.title}
                </div>
              ) : null}
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onMouseEnter={() => preloadRoutePath(item.href)}
                      onFocus={() => preloadRoutePath(item.href)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                          isActive
                            ? "bg-card text-foreground shadow-xs ring-1 ring-border/70"
                            : "text-muted-foreground hover:bg-card/70 hover:text-foreground",
                        )
                      }
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          location.pathname.startsWith(item.href) ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                      {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border/70 pt-3">
          <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-card/75 p-2.5 shadow-xs">
            <Avatar
              name={displayName}
              src={displayAvatar}
            />
            {!sidebarCollapsed ? (
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{displayName}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className="bg-muted text-muted-foreground ring-border">
                    {formatRole(displayRole)}
                  </Badge>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "min-w-0 transition-[margin] duration-150",
          sidebarCollapsed ? "ml-[72px]" : "ml-[248px]",
        )}
      >
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/86 px-5 py-2.5 backdrop-blur xl:px-7">
          <div className="mx-auto flex w-full max-w-[1560px] items-center justify-between gap-4">
            <div className="min-w-0 flex flex-col gap-0.5">
              <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {breadcrumb.length ? breadcrumb.join(" / ") : "Dashboard"}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Operator workspace</span>
                <span className="text-border">/</span>
                <Badge className="bg-muted text-muted-foreground ring-border">{companyPlan}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="h-9 min-w-[240px] justify-between rounded-lg bg-card/80 px-3 shadow-xs"
                onMouseEnter={preloadGlobalSearch}
                onFocus={preloadGlobalSearch}
                onClick={() => setSearchOpen(true)}
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Search className="size-4" />
                  <span className="hidden lg:inline">Tìm khách hàng, ticket, chiến dịch</span>
                </span>
                <span className="rounded-md border border-border/70 bg-muted/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Ctrl K
                </span>
              </Button>
              <ThemeToggle />
              <Button
                variant="outline"
                size="icon"
                className="relative size-9 rounded-lg bg-card/80"
                aria-label="Mở thông báo"
                onMouseEnter={preloadNotificationCenter}
                onFocus={preloadNotificationCenter}
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <Bell className="size-4" />
                {unreadCount ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[22px] items-center justify-center rounded-full border-2 border-background bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-xs">
                    {unreadCount}
                  </span>
                ) : null}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-border/80 bg-card px-2.5 py-1.5 shadow-xs transition hover:bg-muted/35"
                    aria-label="Mở menu tài khoản"
                  >
                    <Avatar
                      name={displayName}
                      src={displayAvatar}
                      className="size-8 text-xs"
                    />
                    <span className="hidden min-w-0 text-left md:block">
                      <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
                    </span>
                    <ChevronDown className="hidden size-4 text-muted-foreground md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[260px]">
                  <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
                  <div className="px-3 pb-2">
                    <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
                    <div className="truncate text-sm text-muted-foreground">{user?.email}</div>
                    <div className="mt-2">
                      <Badge className="bg-muted text-muted-foreground ring-border">
                        {formatRole(displayRole)}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  {canAccess("settings:update") ? (
                    <DropdownMenuItem onSelect={() => navigate("/admin/settings")}>
                      <Settings className="size-4 text-muted-foreground" />
                      Cài đặt hệ thống
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    onSelect={async () => {
                      await logout();
                      navigate("/login");
                    }}
                    className="text-rose-600 data-[highlighted]:bg-rose-500/10 data-[highlighted]:text-rose-700 dark:text-rose-300 dark:data-[highlighted]:text-rose-200"
                  >
                    <LogOut className="size-4" />
                    Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-56px)] min-w-0 px-5 py-4 xl:px-7">
          <div className="mx-auto w-full max-w-[1560px]">
            <Outlet />
          </div>
        </main>
      </div>

      {notificationOpen ? (
        <Suspense fallback={null}>
          <NotificationCenter />
        </Suspense>
      ) : null}
      {searchOpen ? (
        <Suspense fallback={null}>
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </Suspense>
      ) : null}
    </div>
  );
}
