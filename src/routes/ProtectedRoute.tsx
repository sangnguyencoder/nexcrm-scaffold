import { Navigate, Outlet, useLocation } from "react-router-dom";

import { PageLoader } from "@/components/shared/page-loader";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types";

type ProtectedRouteProps = {
  allowedRoles?: UserRole[];
};

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation();
  const {
    initialized,
    isInitializing,
    isLoading,
    isAuthenticated,
    role,
  } = useAuth();

  if (!initialized || isInitializing || isLoading) {
    return (
      <div className="p-6">
        <PageLoader panels={1} />
      </div>
    );
  }

  if (!isAuthenticated) {
    const nextPath = `${location.pathname}${location.search}${location.hash}`;
    const next = nextPath.startsWith("/") ? nextPath : "/dashboard";
    const loginPath = `/login?next=${encodeURIComponent(next)}`;

    return (
      <Navigate
        to={loginPath}
        replace
        state={{
          from: {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
        }}
      />
    );
  }

  if (allowedRoles?.length && (!role || (role !== "super_admin" && !allowedRoles.includes(role)))) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
