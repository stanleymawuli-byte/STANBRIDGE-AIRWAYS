"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type Enrollment = {
  totpURI: string;
  backupCodes: string[];
};

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function beginEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await authClient.twoFactor.enable({
        password,
        method: "totp",
        issuer: "StanBridge Airways",
      });
      if (result.error) throw new Error(result.error.message ?? "Could not start authenticator setup.");
      if (result.data.method !== "totp") throw new Error("Authenticator app setup was not returned.");
      setEnrollment({ totpURI: result.data.totpURI, backupCodes: result.data.backupCodes });
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start authenticator setup.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setError("");
    setLoading(true);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (result.error) throw new Error(result.error.message ?? "That authenticator code was not accepted.");
      setMessage("Two-factor authentication is enabled. Save your backup codes somewhere safe.");
      setEnrollment({ ...enrollment, backupCodes: [...enrollment.backupCodes] });
      setIsEnabled(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the authenticator code.");
    } finally {
      setLoading(false);
    }
  }

  async function disableTwoFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const result = await authClient.twoFactor.disable({ password });
      if (result.error) throw new Error(result.error.message ?? "Could not disable two-factor authentication.");
      setIsEnabled(false);
      setEnrollment(null);
      setMessage("Two-factor authentication has been disabled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="security-settings" aria-labelledby="two-factor-heading">
      <h2 id="two-factor-heading">Two-factor authentication</h2>
      <p>{isEnabled ? "Enabled with an authenticator app." : "Optional. Use an authenticator app for an extra sign-in step."}</p>
      {!isEnabled && !enrollment && (
        <form className="security-form" onSubmit={beginEnrollment}>
          <label>
            <span>Confirm your password</span>
            <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Starting setup..." : "Set up authenticator"}</button>
        </form>
      )}
      {!isEnabled && enrollment && (
        <div className="security-enrollment">
          <p>In your authenticator app, add an account by entering this setup key or opening the URI:</p>
          <code>{decodeURIComponent(new URL(enrollment.totpURI).searchParams.get("secret") ?? "")}</code>
          <details>
            <summary>Show setup URI</summary>
            <code>{enrollment.totpURI}</code>
          </details>
          <form className="security-form" onSubmit={confirmEnrollment}>
            <label>
              <span>6-digit authenticator code</span>
              <input autoComplete="one-time-code" inputMode="numeric" maxLength={8} onChange={(event) => setCode(event.target.value)} pattern="[0-9]{6,8}" required value={code} />
            </label>
            <button type="submit" disabled={loading}>{loading ? "Verifying..." : "Verify and enable"}</button>
          </form>
          <div className="backup-codes">
            <strong>Backup codes — save these securely</strong>
            <p>Each code can be used once if you lose access to your authenticator.</p>
            <ul>{enrollment.backupCodes.map((backupCode) => <li key={backupCode}><code>{backupCode}</code></li>)}</ul>
          </div>
        </div>
      )}
      {isEnabled && enrollment && (
        <div className="backup-codes">
          <strong>Backup codes — save these securely</strong>
          <p>Each code can be used once if you lose access to your authenticator.</p>
          <ul>{enrollment.backupCodes.map((backupCode) => <li key={backupCode}><code>{backupCode}</code></li>)}</ul>
        </div>
      )}
      {isEnabled && (
        <form className="security-form" onSubmit={disableTwoFactor}>
          <label>
            <span>Confirm your password to disable</span>
            <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          </label>
          <button type="submit" disabled={loading}>{loading ? "Updating..." : "Disable two-factor authentication"}</button>
        </form>
      )}
      {message && <p className="auth-success" role="status">{message}</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </section>
  );
}
