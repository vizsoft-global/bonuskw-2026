/**
 * Who may enrol or buy. Instructors and panel admins keep browsing access to
 * the student app (they need to see what students see) but never purchase:
 * an instructor account is shared with the instructor panel and a purchase
 * would create orders, revenue rows and enrolments against staff.
 */
export type PurchaseRole = "Student" | "Instructor" | "Admin";

const STAFF_ROLES = new Set(["Instructor", "Admin"]);

export function purchaseRole(profile: { userRole?: string | null } | null | undefined): PurchaseRole {
  const role = (profile?.userRole ?? "").trim();
  if (STAFF_ROLES.has(role)) return role as PurchaseRole;
  return "Student";
}

export function canPurchase(profile: { userRole?: string | null } | null | undefined) {
  return purchaseRole(profile) === "Student";
}
