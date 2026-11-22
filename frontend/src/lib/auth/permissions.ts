import type { AdminRole, AdminSession } from "./admin-session.ts";

export type AdminPermission =
  // Dashboard & Navigation
  | "admin:dashboard:view"
  // Operational Management (Catalog, Inventory, Orders)
  | "admin:catalog:view"
  | "admin:catalog:manage"
  | "admin:inventory:view"
  | "admin:inventory:manage"
  | "admin:orders:view"
  | "admin:orders:manage"
  // Privileged OWNER-only Capabilities
  | "admin:users:manage"
  | "admin:settings:manage"
  | "admin:security:audit";

const ADMIN_OPERATIONAL_PERMISSIONS: ReadonlySet<AdminPermission> = new Set([
  "admin:dashboard:view",
  "admin:catalog:view",
  "admin:catalog:manage",
  "admin:inventory:view",
  "admin:inventory:manage",
  "admin:orders:view",
  "admin:orders:manage",
]);

/**
 * Checks whether a given role has the requested permission.
 *
 * Rules:
 * - OWNER has full access to all permissions.
 * - ADMIN has dashboard access and operational management permissions only.
 * - ADMIN CANNOT access OWNER-only permissions (users, settings, security audit).
 * - Any unrecognized role returns false (fails closed).
 */
export function hasPermission(
  role: AdminRole | string,
  permission: AdminPermission
): boolean {
  if (role === "OWNER") {
    return true; // Full access
  }

  if (role === "ADMIN") {
    return ADMIN_OPERATIONAL_PERMISSIONS.has(permission);
  }

  return false; // Fail closed for any invalid/customer role
}

/**
 * Verifies if an active admin session holds the required permission.
 */
export function requirePermission(
  session: AdminSession | null,
  permission: AdminPermission
): boolean {
  if (!session || !session.user || !session.user.role) {
    return false;
  }

  return hasPermission(session.user.role, permission);
}
