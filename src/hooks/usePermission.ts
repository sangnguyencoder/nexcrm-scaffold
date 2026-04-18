import type { UserRole } from "@/types";
import { useAuthStore } from "@/store/authStore";
import { hasAnyPermission, type PermissionKey } from "@/utils/permissions";

export function usePermission() {
  const role = useAuthStore((state) => state.role);
  const canAccess = useAuthStore((state) => state.canAccess);

  const hasRole = (roles: UserRole[]) => {
    if (!role) {
      return false;
    }

    if (role === "super_admin") {
      return true;
    }

    return roles.includes(role);
  };

  const canAccessAny = (permissions: PermissionKey[]) =>
    hasAnyPermission(role, permissions);

  return {
    role,
    canAccess,
    hasRole,
    canAccessAny,
  };
}
