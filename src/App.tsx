import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppErrorBoundary } from "@/components/shared/app-error-boundary";
import { PageLoader } from "@/components/shared/page-loader";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RoleGuard } from "@/routes/RoleGuard";
import { routeComponents } from "@/routes/route-modules";

const {
  AuditLogPage,
  SettingsPage,
  UserManagePage,
  AutomationPage,
  LoginPage,
  CampaignListPage,
  CustomerDetailPage,
  CustomerListPage,
  DashboardPage,
  DealPipelinePage,
  ReportsPage,
  ForbiddenPage,
  TicketDetailPage,
  TicketListPage,
  TransactionListPage,
} = routeComponents;

function RouteFallback() {
  return (
    <div className="p-6">
      <PageLoader panels={2} />
    </div>
  );
}

function App() {
  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}

export default App;
