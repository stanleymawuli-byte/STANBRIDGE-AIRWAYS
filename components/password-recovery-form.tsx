"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plane } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function PasswordRecoveryForm({
  mode,
  token,
  invalidToken = false,
}: {
  mode: "request" | "reset";
  token?: string;
  invalidToken?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      if (mode === "request") {
        const result = await authClient.requestPasswordReset({
          email: email.trim(),
          redirectTo: "/reset-password",
        });
        if (result.error) throw new Error(result.error.message ?? "Could not request a reset link.");
        setMessage("If an account exists for this address, a password reset link has been sent.");
      } else {
        if (!token || invalidToken) throw new Error("This password reset link is invalid or has expired.");
        if (password !== confirmation) throw new Error("The passwords do not match.");
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error(result.error.message ?? "Could not reset the password.");
        setMessage("Your password has been updated. You can now sign in.");
        window.setTimeout(() => {
          router.replace("/login");
          router.refresh();
        }, 1200);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The request could not be completed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/" aria-label="StanBridge Airways home">
        <span className="brand-mark"><Plane size={20} /></span>
        <span><strong>STANBRIDGE</strong><small>A I R W A Y S</small></span>
      </Link>
      <section className="auth-card" aria-labelledby="recovery-heading">
        <div className="eyebrow dark"><span /> ACCOUNT SECURITY</div>
        <h1 id="recovery-heading">{mode === "request" ? "Reset your password" : "Choose a new password"}</h1>
        <p className="auth-intro">
          {mode === "request"
            ? "Enter your account email and we will send a secure reset link."
            : "Set a new password for your StanBridge Airways account."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {mode === "request" ? (
            <label>
              <span>EMAIL ADDRESS</span>
              <input autoComplete="email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
            </label>
          ) : (
            <>
              <label>
                <span>NEW PASSWORD</span>
                <input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
                <small>Use at least 12 characters.</small>
              </label>
              <label>
                <span>CONFIRM NEW PASSWORD</span>
                <input autoComplete="new-password" maxLength={128} minLength={12} onChange={(event) => setConfirmation(event.target.value)} required type="password" value={confirmation} />
              </label>
            </>
          )}
          {error && <p className="auth-error" role="alert">{error}</p>}
          {message && <p className="auth-success" role="status">{message}</p>}
          <button className="auth-submit" disabled={submitting || (mode === "reset" && invalidToken)} type="submit">
            {submitting ? "Please wait..." : mode === "request" ? "Send reset link" : "Update password"}
            {!submitting && <ArrowRight size={17} />}
          </button>
        </form>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
      </section>
      <Link className="auth-back" href="/">Back to StanBridge Airways</Link>
    </main>
  );
}
