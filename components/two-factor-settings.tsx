"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ShieldCheck, ShieldAlert, Copy, Check, Eye, EyeOff } from "lucide-react";

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
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);

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
      setMessage("Two-factor authentication is now active. Please store your backup codes safely.");
      setIsEnabled(true);
      setShowSetup(false);
      setShowBackupCodes(true);
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
      setShowDisableForm(false);
      setShowBackupCodes(false);
      setPassword("");
      setMessage("Two-factor authentication has been disabled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  function copyAllCodes() {
    if (!enrollment?.backupCodes) return;
    navigator.clipboard.writeText(enrollment.backupCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2500);
  }

  return (
    <div className="security-card">
      <div className="security-header">
        <div className="security-icon-wrap">
          {isEnabled ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-amber-500" />}
        </div>
        <div className="security-title-info">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-[#071d32]">Two-Factor Authentication</h3>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
              isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
            }`}>
              {isEnabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-[#74818b] mt-0.5">
            {isEnabled 
              ? "Your account is protected with Google Authenticator or an Apple Keychain authenticator app." 
              : "Optional. Add an extra layer of verification using an authenticator app (Google Authenticator, Microsoft, or Apple)."}
          </p>
        </div>
      </div>

      {message && <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded" role="status">{message}</div>}
      {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded" role="alert">{error}</div>}

      {/* When disabled */}
      {!isEnabled && !enrollment && !showSetup && (
        <div className="mt-4 pt-3 border-t border-[#eeece6] flex items-center justify-between">
          <span className="text-xs text-[#74818b]">Add extra protection to your bookings and profile</span>
          <button 
            type="button" 
            onClick={() => setShowSetup(true)}
            className="px-3 py-1.5 bg-[#071d32] hover:bg-[#11314f] text-white text-xs font-medium rounded transition"
          >
            Configure Authenticator
          </button>
        </div>
      )}

      {/* Start setup password confirmation */}
      {!isEnabled && !enrollment && showSetup && (
        <form className="mt-4 pt-4 border-t border-[#eeece6] space-y-3" onSubmit={beginEnrollment}>
          <p className="text-xs text-[#071d32] font-medium">Confirm your password to generate your authenticator setup key:</p>
          <div className="flex gap-2">
            <input 
              autoComplete="current-password" 
              onChange={(event) => setPassword(event.target.value)} 
              required 
              type="password" 
              placeholder="Your account password"
              value={password}
              className="flex-1 text-xs px-3 py-2 border border-[#e1dfd8] rounded outline-none focus:border-[#c9a66b]"
            />
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-[#071d32] text-white text-xs font-medium rounded hover:bg-[#11314f] transition disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Continue"}
            </button>
            <button 
              type="button" 
              onClick={() => { setShowSetup(false); setError(""); }}
              className="px-3 py-2 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Enrollment QR / Secret display */}
      {!isEnabled && enrollment && (
        <div className="mt-4 pt-4 border-t border-[#eeece6] space-y-3">
          <div className="p-3 bg-[#f8f7f4] border border-[#e6e3dc] rounded text-xs">
            <p className="font-semibold text-[#071d32] mb-1">1. Enter this setup key in your Authenticator app:</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="flex-1 p-2 bg-white border border-[#e1dfd8] rounded font-mono text-[11px] text-[#071d32] select-all break-all">
                {decodeURIComponent(new URL(enrollment.totpURI).searchParams.get("secret") ?? "")}
              </code>
            </div>
            <p className="text-[11px] text-[#74818b] mt-1.5">
              Works with Google Authenticator, Microsoft Authenticator, or iPhone Passwords.
            </p>
          </div>

          <form className="space-y-2" onSubmit={confirmEnrollment}>
            <p className="font-semibold text-[#071d32] text-xs">2. Enter the 6-digit code shown in the app:</p>
            <div className="flex gap-2">
              <input 
                autoComplete="one-time-code" 
                inputMode="numeric" 
                maxLength={8} 
                onChange={(event) => setCode(event.target.value)} 
                pattern="[0-9]{6,8}" 
                required 
                placeholder="000 000"
                value={code} 
                className="w-40 text-sm tracking-widest text-center px-3 py-2 border border-[#e1dfd8] rounded outline-none focus:border-[#c9a66b]"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="px-4 py-2 bg-[#071d32] text-white text-xs font-medium rounded hover:bg-[#11314f] transition disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Activate"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* When enabled: clean status & optional backup codes drawer */}
      {isEnabled && (
        <div className="mt-4 pt-3 border-t border-[#eeece6] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {enrollment?.backupCodes && (
              <button
                type="button"
                onClick={() => setShowBackupCodes(!showBackupCodes)}
                className="inline-flex items-center gap-1.5 text-xs text-[#071d32] font-medium hover:text-[#c9a66b] transition"
              >
                {showBackupCodes ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showBackupCodes ? "Hide Backup Codes" : "View Backup Codes"}
              </button>
            )}

            {!showDisableForm ? (
              <button
                type="button"
                onClick={() => setShowDisableForm(true)}
                className="text-xs text-red-600 hover:text-red-700 underline underline-offset-2 ml-auto"
              >
                Disable 2FA
              </button>
            ) : null}
          </div>

          {/* Backup codes grid only if user explicitly clicks to view */}
          {isEnabled && showBackupCodes && enrollment?.backupCodes && (
            <div className="p-3 bg-[#fbfaf8] border border-[#e8e4da] rounded-lg mt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#071d32]">Emergency Backup Codes</span>
                <button
                  type="button"
                  onClick={copyAllCodes}
                  className="inline-flex items-center gap-1 text-[11px] text-[#071d32] bg-white px-2 py-1 rounded border border-[#e1dfd8] hover:bg-gray-50"
                >
                  {copiedCodes ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copiedCodes ? "Copied!" : "Copy All"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {enrollment.backupCodes.map((backupCode) => (
                  <code key={backupCode} className="text-[11px] font-mono p-1.5 bg-white border border-[#eee] rounded text-center text-[#071d32]">
                    {backupCode}
                  </code>
                ))}
              </div>
              <div className="mt-2 text-right">
                <button 
                  type="button" 
                  onClick={() => setShowBackupCodes(false)}
                  className="text-[11px] text-[#74818b] hover:text-[#071d32]"
                >
                  Close & Done
                </button>
              </div>
            </div>
          )}

          {/* Disable confirmation form */}
          {showDisableForm && (
            <form onSubmit={disableTwoFactor} className="p-3 bg-red-50/50 border border-red-200 rounded mt-2 space-y-2">
              <p className="text-xs text-red-800 font-medium">Confirm your password to disable Two-Factor Authentication:</p>
              <div className="flex gap-2">
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  placeholder="Account password"
                  value={password}
                  className="flex-1 text-xs px-3 py-1.5 border border-red-200 rounded bg-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition"
                >
                  {loading ? "Disabling..." : "Confirm Disable"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisableForm(false); setPassword(""); }}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 text-gray-700 text-xs rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
