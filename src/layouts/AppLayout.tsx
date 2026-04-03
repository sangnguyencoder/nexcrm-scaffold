import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  ScrollText,
  Search,
  Settings,
  Target,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { GlobalSearch } from "@/components/shared/global-search";
import { NotificationCenter } from "@/components/shared/notification-center";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNotificationsQuery, useSettingsQuery } from "@/hooks/useNexcrmQueries";
import { cn, formatRole, getDefaultAvatarUrl, getDefaultLogoUrl } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useUiStore } from "@/stores/uiStore";
import type { UserRole } from "@/types";

const navGroups: Array<{
  title: string;
  items: Array<{ label: string; href: string; icon: typeof LayoutDashboard; roles?: UserRole[] }>;
}> = [
  {
    title: "TỔNG QUAN",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Báo Cáo", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    title: "KHÁCH HÀNG",
    items: [
      { label: "Khách Hàng", href: "/customers", icon: Users },
      { label: "Pipeline", href: "/pipeline", icon: Target },
      { label: "Giao Dịch", href: "/transactions", icon: CreditCard },
    ],
  },
  {
    title: "HỖ TRỢ",
    items: [
      { label: "Ticket", href: "/tickets", icon: MessageSquare },
      { label: "Chăm Sóc Tự Động", href: "/automation", icon: Zap },
    ],
  },
  {
    title: "MARKETING",
    items: [{ label: "Chiến Dịch", href: "/campaigns", icon: Megaphone }],
  },
  {
    title: "HỆ THỐNG",
    items: [
      {
        label: "Người Dùng",
        href: "/admin/users",
        icon: UserCog,
        roles: ["super_admin", "admin", "director"],
      },
      { label: "Cài Đặt", href: "/admin/settings", icon: Settings, roles: ["super_admin", "admin"] },
      {
        label: "Nhật Ký",
        href: "/admin/audit",
        icon: ScrollText,
        roles: ["super_admin", "admin", "director"],
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
};

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const { sidebarCollapsed, toggleSidebar, notificationOpen, setNotificationOpen } = useUiStore();
  const { data: notifications = [] } = useNotificationsQuery(user?.id);
  const { data: settings } = useSettingsQuery();
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const [searchOpen, setSearchOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const companyName = settings?.company_name ?? "NexCRM Demo";
  const logoUrl = settings?.logo_url || getDefaultLogoUrl();

  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumb = segments.map((segment) => breadcrumbMap[segment] ?? segment);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            item.roles ? item.roles.includes(user?.role ?? "sales") : true,
          ),
        }))
        .filter((group) => {
          if (group.title !== "HỆ THỐNG") return true;
          return !["sales", "cskh", "marketing"].includes(user?.role ?? "sales");
        }),
    [user?.role],
  );

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col border-r border-border bg-card px-3 py-4 transition-all duration-200",
          sidebarCollapsed ? "w-16" : "w-[240px]",
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="flex size-10 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 text-lg font-bold text-primary">
              <img src={logoUrl} alt={companyName} className="size-full object-cover" />
            </div>
            {!sidebarCollapsed ? (
              <div>
                <div className="font-display text-lg font-bold">NexCRM</div>
                <div className="truncate text-xs text-muted-foreground">{companyName}</div>
              </div>
            ) : null}
          </button>
          <Button variant="ghost" size="icon" onClick={toggleSidebar}>
            {sidebarCollapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <div className="mt-6 flex-1 space-y-6 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              {!sidebarCollapsed ? (
                <div className="px-3 text-xs font-semibold tracking-wide text-muted-foreground">
                  {group.title}
                </div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.href}
                      to={item.href}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" />
                      {!sidebarCollapsed ? <span>{item.label}</span> : null}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3 rounded-2xl bg-muted/50 p-3">
            <Avatar
              name={user?.full_name ?? "NexCRM"}
              src={user ? user.avatar_url || getDefaultAvatarUrl(user.role) : getDefaultAvatarUrl("admin")}
            />
            {!sidebarCollapsed ? (
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{user?.full_name}</div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge className="bg-primary/10 text-primary ring-primary/20">
                    {formatRole(user?.role ?? "sales")}
                  </Badge>
                </div>
              </div>
            ) : null}
            {!sidebarCollapsed ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={async () => {
                  await logout();
                  navigate("/login");
                }}
              >
                <LogOut className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "min-w-0 transition-all duration-200",
          sidebarCollapsed ? "ml-16" : "ml-[240px]",
        )}
      >
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 px-6 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                {breadcrumb.length ? breadcrumb.join(" / ") : "Dashboard"}
              </div>
              <div className="font-display text-xl font-semibold">
                {breadcrumb.at(-1) ?? "Dashboard"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setSearchOpen(true)}>
                <Search className="size-4" />
                <span className="hidden md:inline">Tìm kiếm</span>
                <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                  Cmd K
                </span>
              </Button>
              <ThemeToggle />
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setNotificationOpen(!notificationOpen)}
              >
                <Bell className="size-4" />
                {unreadCount ? (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {unreadCount}
                  </span>
                ) : null}
              </Button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((value) => !value)}
                  className="flex items-center gap-2 rounded-2xl border border-border px-3 py-2"
                >
                  <Avatar
                    name={user?.full_name ?? "NexCRM"}
                    src={user ? user.avatar_url || getDefaultAvatarUrl(user.role) : getDefaultAvatarUrl("admin")}
                    className="size-8 text-xs"
                  />
                  <span className="hidden text-sm font-medium md:inline">{user?.full_name}</span>
                </button>
                {userMenuOpen ? (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-soft">
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {user?.email}
                    </div>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={async () => {
                        await logout();
                        navigate("/login");
                      }}
                    >
                      <LogOut className="size-4" />
                      Đăng xuất
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-81px)] min-w-0 px-6 py-6">
          <Outlet />
        </main>
      </div>

      <NotificationCenter />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
