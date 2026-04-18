import type { UserRole } from "@/types";

const ALL_ROLES: readonly UserRole[] = [
  "super_admin",
  "admin",
  "director",
  "sales",
  "cskh",
  "marketing",
];

export const PERMISSIONS = {
  "dashboard:read": ALL_ROLES,
  "report:read": ALL_ROLES,
  "report:export": ["super_admin", "admin", "director"],

  "customer:read": ALL_ROLES,
  "customer:create": ["super_admin", "admin", "sales"],
  "customer:update": ["super_admin", "admin", "sales"],
  "customer:delete": ["super_admin", "admin", "director", "sales"],

  "transaction:read": ["super_admin", "admin", "director", "sales", "cskh", "marketing"],
  "transaction:create": ["super_admin", "admin", "sales"],
  "transaction:update": ["super_admin", "admin", "sales"],
  "transaction:delete": ["super_admin", "admin"],

  "ticket:read": ["super_admin", "admin", "director", "sales", "cskh", "marketing"],
  "ticket:create": ["super_admin", "admin", "sales", "cskh"],
  "ticket:update": ["super_admin", "admin", "cskh"],
  "ticket:delete": ["super_admin", "admin"],

  "campaign:read": ["super_admin", "admin", "director", "marketing"],
  "campaign:create": ["super_admin", "admin", "marketing"],
  "campaign:update": ["super_admin", "admin", "marketing"],
  "campaign:delete": ["super_admin", "admin"],
  "campaign:send": ["super_admin", "admin", "marketing"],

  "automation:read": ["super_admin", "admin", "director", "cskh", "marketing"],
  "automation:create": ["super_admin", "admin", "marketing"],
  "automation:update": ["super_admin", "admin", "marketing"],
  "automation:delete": ["super_admin", "admin"],

  "deal:read": ["super_admin", "admin", "director", "sales", "marketing"],
  "deal:create": ["super_admin", "admin", "sales"],
  "deal:update": ["super_admin", "admin", "sales"],
  "deal:delete": ["super_admin", "admin"],

  "task:read": ["super_admin", "admin", "director", "sales", "cskh", "marketing"],
  "task:create": ["super_admin", "admin", "sales", "cskh"],
  "task:update": ["super_admin", "admin", "sales", "cskh"],
  "task:delete": ["super_admin", "admin"],

  "user:read": ["super_admin", "admin", "director"],
  "user:create": ["super_admin", "admin"],
  "user:update": ["super_admin", "admin"],
  "user:delete": ["super_admin", "admin"],

  "audit:read": ["super_admin", "admin", "director"],
  "posSync:read": ["super_admin", "admin", "director"],
  "posSync:run": ["super_admin", "admin"],

  "settings:read": ALL_ROLES,
  "settings:update": ["super_admin", "admin"],

  "notification:read": ALL_ROLES,
  "notification:markRead": ALL_ROLES,
} as const satisfies Record<string, readonly UserRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

export function rolesForPermission(permission: PermissionKey): UserRole[] {
  return [...(PERMISSIONS[permission] as readonly UserRole[])];
}

export function rolesForAnyPermissions(permissions: PermissionKey[]): UserRole[] {
  const roleSet = new Set<UserRole>();
  permissions.forEach((permission) => {
    (PERMISSIONS[permission] as readonly UserRole[]).forEach((role) => {
      roleSet.add(role);
    });
  });
  return [...roleSet];
}

export function hasPermission(
  role: UserRole | null | undefined,
  permission: PermissionKey,
) {
  if (!role) {
    return false;
  }

  if (role === "super_admin") {
    return true;
  }

  return (PERMISSIONS[permission] as readonly UserRole[]).includes(role);
}

export function hasAnyPermission(
  role: UserRole | null | undefined,
  permissions: PermissionKey[],
) {
  return permissions.some((permission) => hasPermission(role, permission));
}
