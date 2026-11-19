import "server-only";

import { getVerifiedUserSession } from "@/lib/user-auth";

export const staffRoles = [
  "SUPER_ADMIN",
  "OPERATIONS_MANAGER",
  "BOOKING_AGENT",
  "FINANCE_OFFICER",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export async function getStaffSession() {
  const session = await getVerifiedUserSession();
  const role = session?.user.role;
  if (!session || typeof role !== "string" || !staffRoles.includes(role as StaffRole)) return null;
  return {
    ...session,
    user: { ...session.user, role: role as StaffRole },
  };
}
