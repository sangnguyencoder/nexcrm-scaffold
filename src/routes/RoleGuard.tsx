import { ProtectedRoute } from "@/routes/ProtectedRoute";
import type { UserRole } from "@/types";

export function RoleGuard({ allowedRoles }: { allowedRoles: UserRole[] }) {
  return <ProtectedRoute allowedRoles={allowedRoles} />;
}
