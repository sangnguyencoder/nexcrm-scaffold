import { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppErrorBoundary } from "@/components/shared/app-error-boundary";
import { PageLoader } from "@/components/shared/page-loader";
import { AppLayout } from "@/layouts/AppLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RoleGuard } from "@/routes/RoleGuard";
import { routeComponents } from "@/routes/route-modules";
import { rolesForAnyPermissions, rolesForPermission } from "@/utils/permissions";

const {
  AuditLogPage,
  PosSyncPage,
  SettingsPage,
  UserManagePage,
  AutomationPage,
  LandingPage,
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
          <Route index element={<LandingPage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
          <Route path="/403" element={<ForbiddenPage />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/customers" element={<CustomerListPage />} />
              <Route path="/customers/new" element={<Navigate to="/customers?create=1" replace />} />
              <Route path="/customers/:id/edit" element={<CustomerDetailPage />} />
              <Route path="/customers/:id" element={<CustomerDetailPage />} />

              <Route element={<RoleGuard allowedRoles={rolesForPermission("deal:read")} />}>
                <Route path="/pipeline" element={<DealPipelinePage />} />
              </Route>

              <Route
                element={
                  <RoleGuard
                    allowedRoles={rolesForAnyPermissions(["transaction:read", "ticket:read"])}
                  />
                }
              >
                <Route path="/transactions" element={<TransactionListPage />} />
                <Route path="/transactions/new" element={<Navigate to="/transactions?create=1" replace />} />
                <Route path="/tickets" element={<TicketListPage />} />
                <Route path="/tickets/new" element={<Navigate to="/tickets?create=1" replace />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={rolesForPermission("automation:read")} />}>
                <Route path="/automation" element={<AutomationPage />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={rolesForPermission("campaign:read")} />}>
                <Route path="/campaigns" element={<CampaignListPage />} />
                <Route path="/campaigns/new" element={<Navigate to="/campaigns?create=1" replace />} />
              </Route>

              <Route
                element={
                  <RoleGuard
                    allowedRoles={rolesForAnyPermissions(["user:read", "audit:read", "posSync:read"])}
                  />
                }
              >
                <Route path="/admin/users" element={<UserManagePage />} />
                <Route path="/admin/audit" element={<AuditLogPage />} />
                <Route path="/admin/pos-sync" element={<PosSyncPage />} />
              </Route>

              <Route element={<RoleGuard allowedRoles={rolesForPermission("settings:update")} />}>
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
