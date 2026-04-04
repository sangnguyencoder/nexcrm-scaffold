import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PageLoader } from "@/components/shared/page-loader";
import { useAuthStore } from "@/stores/authStore";

export function ProtectedRoute() {
  const location = useLocation();
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
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
