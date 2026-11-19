import "server-only";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export async function getVerifiedUserSession() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session || session.user.twoFactorEnabled !== true) return null;
  return session;
}
