import { lazy, type ComponentType } from "react";

function createLazyRoute(
  loader: () => Promise<Record<string, unknown>>,
  exportName: string,
) {
  const load = () =>
    loader().then((module) => ({
      default: module[exportName] as ComponentType,
    }));

  return {
    load,
    component: lazy(load),
  };
}

const auditLogRoute = createLazyRoute(() => import("@/pages/admin/AuditLogPage"), "AuditLogPage");
const posSyncRoute = createLazyRoute(() => import("@/pages/admin/PosSyncPage"), "PosSyncPage");
const settingsRoute = createLazyRoute(() => import("@/pages/admin/SettingsPage"), "SettingsPage");
const userManageRoute = createLazyRoute(() => import("@/pages/admin/UserManagePage"), "UserManagePage");
const automationRoute = createLazyRoute(() => import("@/pages/automation/AutomationPage"), "AutomationPage");
const loginRoute = createLazyRoute(() => import("@/pages/auth/LoginPage"), "LoginPage");
const campaignRoute = createLazyRoute(() => import("@/pages/campaigns/CampaignListPage"), "CampaignListPage");
const customerDetailRoute = createLazyRoute(() => import("@/pages/customers/CustomerDetailPage"), "CustomerDetailPage");
const customerListRoute = createLazyRoute(() => import("@/pages/customers/CustomerListPage"), "CustomerListPage");
const dashboardRoute = createLazyRoute(() => import("@/pages/dashboard/DashboardPage"), "DashboardPage");
const dealPipelineRoute = createLazyRoute(() => import("@/pages/pipeline/DealPipelinePage"), "DealPipelinePage");
const reportsRoute = createLazyRoute(() => import("@/pages/reports/ReportsPage"), "ReportsPage");
const forbiddenRoute = createLazyRoute(() => import("@/pages/system/ForbiddenPage"), "ForbiddenPage");
const ticketDetailRoute = createLazyRoute(() => import("@/pages/tickets/TicketDetailPage"), "TicketDetailPage");
const ticketListRoute = createLazyRoute(() => import("@/pages/tickets/TicketListPage"), "TicketListPage");
const transactionListRoute = createLazyRoute(() => import("@/pages/transactions/TransactionListPage"), "TransactionListPage");

const routePreloaders = [
  { matcher: /^\/dashboard/, load: dashboardRoute.load },
  { matcher: /^\/reports/, load: reportsRoute.load },
  { matcher: /^\/customers\/[^/]+/, load: customerDetailRoute.load },
  { matcher: /^\/customers/, load: customerListRoute.load },
  { matcher: /^\/pipeline/, load: dealPipelineRoute.load },
  { matcher: /^\/transactions/, load: transactionListRoute.load },
  { matcher: /^\/tickets\/[^/]+/, load: ticketDetailRoute.load },
  { matcher: /^\/tickets/, load: ticketListRoute.load },
  { matcher: /^\/automation/, load: automationRoute.load },
  { matcher: /^\/campaigns/, load: campaignRoute.load },
  { matcher: /^\/admin\/users/, load: userManageRoute.load },
  { matcher: /^\/admin\/audit/, load: auditLogRoute.load },
  { matcher: /^\/admin\/pos-sync/, load: posSyncRoute.load },
  { matcher: /^\/admin\/settings/, load: settingsRoute.load },
  { matcher: /^\/login/, load: loginRoute.load },
  { matcher: /^\/forbidden/, load: forbiddenRoute.load },
];

export function preloadRoutePath(pathname: string) {
  const matched = routePreloaders.find((entry) => entry.matcher.test(pathname));
  if (!matched) {
    return;
  }

  void matched.load();
}

export const routeComponents = {
  AuditLogPage: auditLogRoute.component,
  PosSyncPage: posSyncRoute.component,
  SettingsPage: settingsRoute.component,
  UserManagePage: userManageRoute.component,
  AutomationPage: automationRoute.component,
  LoginPage: loginRoute.component,
  CampaignListPage: campaignRoute.component,
  CustomerDetailPage: customerDetailRoute.component,
  CustomerListPage: customerListRoute.component,
  DashboardPage: dashboardRoute.component,
  DealPipelinePage: dealPipelineRoute.component,
  ReportsPage: reportsRoute.component,
  ForbiddenPage: forbiddenRoute.component,
  TicketDetailPage: ticketDetailRoute.component,
  TicketListPage: ticketListRoute.component,
  TransactionListPage: transactionListRoute.component,
};
