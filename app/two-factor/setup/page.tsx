import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { TwoFactorSettings } from "@/components/two-factor-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Secure your account | StanBridge Airways",
};

export default async function TwoFactorSetupPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.twoFactorEnabled) redirect("/account");

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="setup-heading">
        <div className="eyebrow dark"><span /> ACCOUNT SECURITY</div>
        <h1 id="setup-heading">Secure your account</h1>
        <p className="auth-intro">
          Set up Google Authenticator to verify sign-ins. Authenticator setup is required to use bookings and account features.
        </p>
        <TwoFactorSettings enabled={false} required />
      </section>
    </main>
  );
}
