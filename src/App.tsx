import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/layouts/AppLayout";
import { AuditLogPage } from "@/pages/admin/AuditLogPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";
import { UserManagePage } from "@/pages/admin/UserManagePage";
import { AutomationPage } from "@/pages/automation/AutomationPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { CampaignListPage } from "@/pages/campaigns/CampaignListPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { CustomerListPage } from "@/pages/customers/CustomerListPage";
import { DashboardPage } from "@/pages/dashboard/DashboardPage";
import { DealPipelinePage } from "@/pages/pipeline/DealPipelinePage";
import { ReportsPage } from "@/pages/reports/ReportsPage";
import { ForbiddenPage } from "@/pages/system/ForbiddenPage";
import { TicketDetailPage } from "@/pages/tickets/TicketDetailPage";
import { TicketListPage } from "@/pages/tickets/TicketListPage";
import { TransactionListPage } from "@/pages/transactions/TransactionListPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RoleGuard } from "@/routes/RoleGuard";

function App() {
  return (
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
  );
}

export default App;
