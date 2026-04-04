import { Navigate, Outlet } from "react-router-dom";

import { PageLoader } from "@/components/shared/page-loader";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types";

export function RoleGuard({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const user = useAuthStore((state) => state.user);
  const initialized = useAuthStore((state) => state.initialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);

  if (!initialized || isInitializing) {
    return (
      <div className="p-6">
        <PageLoader panels={1} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
}
