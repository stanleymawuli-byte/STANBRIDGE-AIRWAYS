import "server-only";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export const staffRoles = [
  "SUPER_ADMIN",
  "OPERATIONS_MANAGER",
  "BOOKING_AGENT",
  "FINANCE_OFFICER",
] as const;

export type StaffRole = (typeof staffRoles)[number];

export async function getStaffSession() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const role = session?.user.role;
  if (!session || typeof role !== "string" || !staffRoles.includes(role as StaffRole) || !session.user.twoFactorEnabled) return null;
  return {
    ...session,
    user: { ...session.user, role: role as StaffRole },
  };
}
