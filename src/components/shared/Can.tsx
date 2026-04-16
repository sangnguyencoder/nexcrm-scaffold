import type { ReactNode } from "react";

import { usePermission } from "@/hooks/usePermission";
import type { UserRole } from "@/types";
import type { PermissionKey } from "@/utils/permissions";

type CanProps = {
  permission?: PermissionKey;
  roles?: UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
};

export function Can({
  permission,
  roles,
  children,
  fallback = null,
}: CanProps) {
  const { canAccess, hasRole } = usePermission();

  const allowByPermission = permission ? canAccess(permission) : true;
  const allowByRole = roles ? hasRole(roles) : true;
  const isAllowed = allowByPermission && allowByRole;

  if (!isAllowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
