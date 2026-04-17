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
  Menu,
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

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet } from "@/components/ui/sheet";
import { useNotificationsQuery, useSettingsQuery } from "@/hooks/useNexcrmQueries";
import { useNotificationRealtime } from "@/hooks/useNotificationRealtime";
import { cn, formatRole, getDefaultAvatarUrl } from "@/lib/utils";
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

  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: notifications = [] } = useNotificationsQuery(user?.id);
  const { data: settings } = useSettingsQuery();
  useNotificationRealtime(user?.id);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const companyName = settings?.company_name ?? "NexCRM";
  const displayName = profile?.full_name ?? user?.email ?? "NexCRM";
  const displayRole = role ?? "sales";
  const displayAvatar = profile?.avatar_url || getDefaultAvatarUrl(displayRole);

  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumb = segments.map((segment) => breadcrumbMap[segment] ?? segment);
  const currentSection = breadcrumb[breadcrumb.length - 1] ?? "Dashboard";

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

  const isCurrentPath = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border/80 bg-sidebar/90 backdrop-blur lg:flex",
          sidebarCollapsed ? "w-[78px]" : "w-[248px]",
        )}
      >
        <div className="flex h-14 items-center justify-between px-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition hover:bg-background/70",
              sidebarCollapsed && "justify-center",
            )}
            aria-label="Đi tới dashboard"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-primary-foreground">
              N
            </span>
            {!sidebarCollapsed ? (
              <span className="truncate text-sm font-semibold text-sidebar-foreground">{companyName}</span>
            ) : null}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg text-muted-foreground hover:bg-background/70 hover:text-foreground"
            onClick={toggleSidebar}
            aria-label="Thu gọn hoặc mở rộng thanh bên"
          >
            {sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pb-3 pt-2 scrollbar-thin">
          {visibleGroups.map((group) => (
            <div key={group.title} className="mt-2 first:mt-0">
              {!sidebarCollapsed ? (
                <div className="px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {group.title}
                </div>
              ) : null}
              <div className="space-y-0.5 px-2">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = isCurrentPath(item.href);

                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onMouseEnter={() => preloadRoutePath(item.href)}
                      onFocus={() => preloadRoutePath(item.href)}
                      className={({ isActive }) =>
                        cn(
                          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                          sidebarCollapsed && "justify-center px-0",
                          isActive || isCurrent
                            ? "bg-primary/12 font-medium text-primary"
                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                        )
                      }
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          isCurrent ? "text-primary" : "text-muted-foreground",
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

        <div className="border-t border-sidebar-border/80 px-2 py-2">
          <button
            type="button"
            onClick={() => {
              if (canAccess("settings:update")) {
                navigate("/admin/settings");
              }
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-background/70",
              sidebarCollapsed && "justify-center",
            )}
            aria-label="Mở thông tin tài khoản"
          >
            <Avatar
              name={displayName}
              src={displayAvatar}
              className="size-8 text-[10px]"
            />
            {!sidebarCollapsed ? (
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate text-sm font-medium text-sidebar-foreground">{displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{formatRole(displayRole)}</div>
              </div>
            ) : null}
            {!sidebarCollapsed ? <ChevronDown className="size-4 text-muted-foreground" /> : null}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          "min-w-0 transition-[margin] duration-200",
          sidebarCollapsed ? "lg:ml-[78px]" : "lg:ml-[248px]",
        )}
      >
        <header className="sticky top-0 z-20 border-b border-border/80 bg-background/92 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1680px] items-center gap-3 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-9 rounded-lg lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                aria-label="Mở điều hướng"
              >
                <Menu className="size-5" />
              </Button>

              <div className="min-w-0 lg:hidden">
                <div className="truncate text-sm font-semibold text-foreground">{currentSection}</div>
              </div>

              <div className="hidden min-w-0 items-center gap-1.5 lg:flex">
                <span className="text-sm font-semibold text-foreground">NexCRM</span>
                {(breadcrumb.length ? breadcrumb : ["Dashboard"]).map((label, index) => (
                  <div key={`${label}-${index}`} className="flex min-w-0 items-center gap-1.5">
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <span className="truncate text-sm text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 justify-center">
              <button
                type="button"
                className="flex h-9 w-full max-w-[460px] items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/55 px-3 text-sm text-muted-foreground transition-colors duration-150 hover:border-border hover:bg-muted/70 hover:text-foreground"
                onMouseEnter={preloadGlobalSearch}
                onFocus={preloadGlobalSearch}
                onClick={() => setSearchOpen(true)}
              >
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Search className="size-4 shrink-0" />
                  <span className="truncate">Tìm khách hàng, ticket, chiến dịch...</span>
                </span>
                <span className="hidden rounded-md border border-border/80 bg-card px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
                  Ctrl K
                </span>
              </button>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="relative size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Mở thông báo"
                onMouseEnter={preloadNotificationCenter}
                onFocus={preloadNotificationCenter}
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <Bell className="size-4" />
                {unreadCount ? (
                  <span className="absolute -right-1 -top-1 inline-flex size-[18px] items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                    {unreadCount}
                  </span>
                ) : null}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full p-0.5 transition hover:bg-muted"
                    aria-label="Mở menu tài khoản"
                  >
                    <Avatar
                      name={displayName}
                      src={displayAvatar}
                      className="size-8 text-xs"
                    />
                    <ChevronDown className="hidden size-4 text-muted-foreground md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[260px]">
                  <DropdownMenuLabel>Tài khoản</DropdownMenuLabel>
                  <div className="px-3 pb-2">
                    <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
                    <div className="truncate text-sm text-muted-foreground">{user?.email}</div>
                    <div className="mt-2">
                      <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                        {formatRole(displayRole)}
                      </span>
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

        <main className="min-h-[calc(100vh-57px)] min-w-0 px-4 py-4 md:px-6">
          <div className="mx-auto w-full max-w-[1680px]">
            <Outlet />
          </div>
        </main>
      </div>

      <Sheet
        open={mobileNavOpen}
        onOpenChange={setMobileNavOpen}
        title="Điều hướng"
        description="Truy cập nhanh các module CRM"
        className="w-[min(100vw,340px)]"
        bodyClassName="px-4 pb-4"
      >
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.title}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isCurrent = isCurrentPath(item.href);

                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileNavOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors duration-150",
                          isActive || isCurrent
                            ? "bg-primary/12 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )
                      }
                    >
                      <Icon className={cn("size-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground")} />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="rounded-xl border border-border/80 bg-muted/35 p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={displayName} src={displayAvatar} className="size-8 text-xs" />
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{displayName}</div>
                <div className="truncate text-xs text-muted-foreground">{formatRole(displayRole)}</div>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={async () => {
                await logout();
                setMobileNavOpen(false);
                navigate("/login");
              }}
            >
              <LogOut className="size-4" />
              Đăng xuất
            </Button>
          </div>
        </div>
      </Sheet>

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
