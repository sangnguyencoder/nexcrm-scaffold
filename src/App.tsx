import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { PageLoader } from "@/components/shared/page-loader";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RoleGuard } from "@/routes/RoleGuard";

const AuditLogPage = lazy(() => import("@/pages/admin/AuditLogPage").then((module) => ({ default: module.AuditLogPage })));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const UserManagePage = lazy(() => import("@/pages/admin/UserManagePage").then((module) => ({ default: module.UserManagePage })));
const AutomationPage = lazy(() => import("@/pages/automation/AutomationPage").then((module) => ({ default: module.AutomationPage })));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((module) => ({ default: module.LoginPage })));
const CampaignListPage = lazy(() => import("@/pages/campaigns/CampaignListPage").then((module) => ({ default: module.CampaignListPage })));
const CustomerDetailPage = lazy(() => import("@/pages/customers/CustomerDetailPage").then((module) => ({ default: module.CustomerDetailPage })));
const CustomerListPage = lazy(() => import("@/pages/customers/CustomerListPage").then((module) => ({ default: module.CustomerListPage })));
const DashboardPage = lazy(() => import("@/pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const DealPipelinePage = lazy(() => import("@/pages/pipeline/DealPipelinePage").then((module) => ({ default: module.DealPipelinePage })));
const ReportsPage = lazy(() => import("@/pages/reports/ReportsPage").then((module) => ({ default: module.ReportsPage })));
const ForbiddenPage = lazy(() => import("@/pages/system/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage })));
const TicketDetailPage = lazy(() => import("@/pages/tickets/TicketDetailPage").then((module) => ({ default: module.TicketDetailPage })));
const TicketListPage = lazy(() => import("@/pages/tickets/TicketListPage").then((module) => ({ default: module.TicketListPage })));
const TransactionListPage = lazy(() => import("@/pages/transactions/TransactionListPage").then((module) => ({ default: module.TransactionListPage })));

function RouteFallback() {
  return (
    <div className="p-6">
      <PageLoader panels={2} />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forbidden" element={<ForbiddenPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/customers" element={<CustomerListPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/pipeline" element={<DealPipelinePage />} />
            <Route path="/transactions" element={<TransactionListPage />} />
            <Route path="/tickets" element={<TicketListPage />} />
            <Route path="/tickets/:id" element={<TicketDetailPage />} />
            <Route path="/automation" element={<AutomationPage />} />
            <Route path="/campaigns" element={<CampaignListPage />} />
            <Route path="/reports" element={<ReportsPage />} />

            <Route element={<RoleGuard allowedRoles={["super_admin", "admin", "director"]} />}>
              <Route path="/admin/users" element={<UserManagePage />} />
              <Route path="/admin/audit" element={<AuditLogPage />} />
            </Route>

            <Route element={<RoleGuard allowedRoles={["super_admin", "admin"]} />}>
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
