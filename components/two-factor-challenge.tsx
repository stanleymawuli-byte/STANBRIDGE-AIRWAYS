"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function TwoFactorChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = backup
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
        : await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (result.error) throw new Error(result.error.message ?? "The code was not accepted.");
      router.replace("/account");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The code was not accepted.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/" aria-label="StanBridge Airways home">
        <span className="brand-mark"><Plane size={20} /></span>
        <span><strong>STANBRIDGE</strong><small>A I R W A Y S</small></span>
      </Link>
      <section className="auth-card" aria-labelledby="two-factor-heading">
        <div className="eyebrow dark"><span /> ACCOUNT SECURITY</div>
        <h1 id="two-factor-heading">Verify it&apos;s you</h1>
        <p className="auth-intro">
          {backup
            ? "Enter one of your unused backup codes."
            : "Enter the current code from your authenticator app."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            <span>{backup ? "BACKUP CODE" : "AUTHENTICATOR CODE"}</span>
            <input
              autoComplete="one-time-code"
              autoFocus
              inputMode={backup ? "text" : "numeric"}
              maxLength={backup ? 32 : 8}
              onChange={(event) => setCode(event.target.value)}
              required
              value={code}
            />
          </label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" disabled={loading} type="submit">
            {loading ? "Verifying..." : "Verify and sign in"}
            {!loading && <ArrowRight size={17} />}
          </button>
        </form>
        <p className="auth-switch">
          <button className="auth-text-button" type="button" onClick={() => { setBackup(!backup); setCode(""); setError(""); }}>
            {backup ? "Use authenticator app" : "Use a backup code"}
          </button>
        </p>
        <p className="auth-note">This verification request expires after five minutes. If this was not you, close this page and secure your account.</p>
      </section>
      <Link className="auth-back" href="/">Back to StanBridge Airways</Link>
    </main>
  );
}
