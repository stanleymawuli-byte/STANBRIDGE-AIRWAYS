import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { staffRoles, getStaffSession } from "@/lib/admin-auth";
import { SignOutButton } from "@/components/sign-out-button";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Operations dashboard | StanBridge Airways",
};

export default async function AdminPage() {
  const authenticatedSession = await getAuth().api.getSession({ headers: await headers() });
  if (!authenticatedSession) redirect("/login");
  if (!authenticatedSession.user.twoFactorEnabled) redirect("/two-factor/setup");
  if (!staffRoles.includes(authenticatedSession.user.role as (typeof staffRoles)[number])) {
    redirect("/account");
  }
  const session = await getStaffSession();
  if (!session) redirect("/account");

  return (
    <main className="admin-page">
      <header className="admin-header">
        <Link className="admin-brand" href="/">
          <span className="brand-mark">✦</span>
          <span><strong>STANBRIDGE</strong><small>OPERATIONS</small></span>
        </Link>
        <div className="admin-account">
          <span>{session.user.name}<small>{session.user.role.replaceAll("_", " ")}</small></span>
          <Link href="/account">Passenger account</Link>
          <SignOutButton />
        </div>
      </header>
      <AdminDashboard role={session.user.role} currentUserId={session.user.id} />
    </main>
  );
}
