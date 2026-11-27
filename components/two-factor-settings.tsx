"use client";

import { useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Copy, 
  Check, 
  QrCode, 
  KeyRound, 
  Loader2, 
  Smartphone 
} from "lucide-react";

type Enrollment = {
  totpURI: string;
  backupCodes: string[];
};

export function TwoFactorSettings({ enabled, required = false }: { enabled: boolean; required?: boolean }) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [testCode, setTestCode] = useState("");
  const [testStatus, setTestStatus] = useState<string>("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeQrLoading, setActiveQrLoading] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [showActiveQr, setShowActiveQr] = useState(false);
  const [activeSecret, setActiveSecret] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [setupTab, setSetupTab] = useState<"qr" | "key">("qr");

  // Fetch the active QR code and secret for already-enabled accounts
  async function loadActiveQrCode() {
    if (qrCodeDataUrl && activeSecret) {
      setShowActiveQr(!showActiveQr);
      return;
    }

    setActiveQrLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/two-factor/qr-code");
      const data = (await response.json()) as {
        secret?: string;
        totpURI?: string;
        qrCodeDataUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.qrCodeDataUrl || !data.secret) {
        throw new Error(data.error ?? "Could not load authenticator QR code.");
      }

      setQrCodeDataUrl(data.qrCodeDataUrl);
      setActiveSecret(data.secret);
      setShowActiveQr(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QR code.");
    } finally {
      setActiveQrLoading(false);
    }
  }

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
      try {
        const qrUrl = await QRCode.toDataURL(result.data.totpURI, {
          width: 240,
          margin: 1.5,
          color: {
            dark: "#071d32",
            light: "#ffffff",
          },
        });
        setQrCodeDataUrl(qrUrl);
        const secret = new URL(result.data.totpURI).searchParams.get("secret");
        if (secret) setActiveSecret(secret);
      } catch (qrErr) {
        console.error("Failed to generate QR code", qrErr);
      }
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify the authenticator code.");
    } finally {
      setLoading(false);
    }
  }

  async function testActiveTotp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTestStatus("");
    try {
      const result = await authClient.twoFactor.verifyTotp({ code: testCode.trim() });
      if (result.error) {
        setTestStatus("Code incorrect. Ensure your phone's clock is synced.");
      } else {
        setTestStatus("✓ Code verified! Google Authenticator is synced correctly.");
      }
    } catch {
      setTestStatus("Code incorrect. Please try the next 30-second code.");
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
      setQrCodeDataUrl("");
      setActiveSecret("");
      setShowDisableForm(false);
      setShowActiveQr(false);
      setPassword("");
      setMessage("Two-factor authentication has been disabled.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not disable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  function copySetupKey() {
    const key = activeSecret || (enrollment?.totpURI ? decodeURIComponent(new URL(enrollment.totpURI).searchParams.get("secret") ?? "") : "");
    if (!key) return;
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  }

  const currentSecretKey = activeSecret || (enrollment?.totpURI ? decodeURIComponent(new URL(enrollment.totpURI).searchParams.get("secret") ?? "") : "");

  return (
    <div className="security-card">
      <div className="security-header flex items-start gap-3">
        <div className="p-2.5 bg-[#f6f4ef] rounded-xl text-[#c9a66b] shrink-0 mt-0.5">
          {isEnabled ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-amber-500" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-[#071d32]">Two-Factor Authentication</h3>
            <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
              isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
            }`}>
              {isEnabled ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="text-xs text-[#74818b] mt-0.5">
            {isEnabled 
              ? "Your account is protected with Google Authenticator, Microsoft Authenticator, or Apple Keychain." 
              : required ? "Required for airline staff before accessing administration and operations." : "Optional. Add an extra layer of verification using an authenticator app (Google Authenticator, Microsoft, or Apple)."}
          </p>
        </div>
      </div>

      {message && <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg" role="status">{message}</div>}
      {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg" role="alert">{error}</div>}

      {/* 1. WHEN ENABLED: Actions to View/Scan QR Code or Disable */}
      {isEnabled && (
        <div className="mt-4 pt-3 border-t border-[#eeece6] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={loadActiveQrCode}
              disabled={activeQrLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-[#071d32] hover:bg-[#123352] text-white text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {activeQrLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a66b]" />
                  <span>Loading QR Code...</span>
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 text-[#c9a66b]" />
                  <span>{showActiveQr ? "Hide QR Code" : "Scan QR Code with Google Authenticator"}</span>
                </>
              )}
            </button>

            {!required && <button
              type="button"
              onClick={() => setShowDisableForm(!showDisableForm)}
              className="text-xs text-rose-600 hover:text-rose-700 underline underline-offset-2 ml-auto font-medium"
            >
              {showDisableForm ? "Cancel" : "Disable 2FA"}
            </button>}
          </div>

          {/* ACTIVE QR CODE DRAWER */}
          {showActiveQr && (
            <div className="bg-[#fbfaf8] border border-[#e8e4da] rounded-xl p-4 sm:p-5 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex border-b border-[#e6e3dc] pb-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSetupTab("qr")}
                  className={`text-xs font-bold pb-1 flex items-center gap-1.5 transition ${
                    setupTab === "qr" ? "text-[#071d32] border-b-2 border-[#c9a66b]" : "text-[#74818b] hover:text-[#071d32]"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" /> Scan QR Code
                </button>
                <button
                  type="button"
                  onClick={() => setSetupTab("key")}
                  className={`text-xs font-bold pb-1 flex items-center gap-1.5 transition ${
                    setupTab === "key" ? "text-[#071d32] border-b-2 border-[#c9a66b]" : "text-[#74818b] hover:text-[#071d32]"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" /> Manual Setup Key
                </button>
              </div>

              {setupTab === "qr" && (
                <div className="space-y-3 text-center">
                  {qrCodeDataUrl ? (
                    <div className="inline-block p-3 bg-white border border-[#e1dfd8] rounded-xl shadow-sm">
                      <Image 
                        src={qrCodeDataUrl} 
                        alt="Scan Google Authenticator 2FA QR Code" 
                        width={200}
                        height={200}
                        unoptimized
                        className="w-48 h-48 mx-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 mx-auto flex items-center justify-center bg-gray-50 text-xs text-gray-500 rounded-xl border border-gray-200">
                      Generating QR code...
                    </div>
                  )}
                  <div className="max-w-xs mx-auto">
                    <p className="text-xs font-semibold text-[#071d32]">Scan with Google Authenticator</p>
                    <p className="text-[11px] text-[#74818b] mt-0.5 leading-relaxed">
                      Open <strong>Google Authenticator</strong> on your phone, tap the <strong>+</strong> button, select <strong>Scan a QR code</strong>, and point your camera here.
                    </p>
                  </div>
                </div>
              )}

              {setupTab === "key" && (
                <div className="p-3.5 bg-white border border-[#e6e3dc] rounded-xl text-xs space-y-2.5">
                  <p className="font-semibold text-[#071d32]">Enter this key manually in Google Authenticator:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-[#f8f7f4] border border-[#e1dfd8] rounded font-mono text-[11px] text-[#071d32] select-all break-all">
                      {currentSecretKey}
                    </code>
                    <button
                      type="button"
                      onClick={copySetupKey}
                      className="px-3 py-2 bg-[#071d32] text-white rounded text-[11px] font-medium hover:bg-[#123352] flex items-center gap-1 shrink-0"
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey ? "Copied" : "Copy Key"}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#74818b]">
                    Account Name: <strong>StanBridge Airways</strong> · Type: <strong>Time-based (TOTP)</strong>
                  </p>
                </div>
              )}

              {/* Optional Test Verifier */}
              <form onSubmit={testActiveTotp} className="pt-3 border-t border-[#eee9de] flex flex-col sm:flex-row items-center gap-2">
                <span className="text-[11px] text-[#74818b] shrink-0">Test 6-digit code:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000 000"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  className="w-32 text-center text-xs px-2.5 py-1.5 border border-[#e1dfd8] rounded font-mono bg-white outline-none focus:border-[#c9a66b]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#071d32] text-white text-xs font-semibold rounded hover:bg-[#143a5c] transition"
                >
                  Verify Code
                </button>
                {testStatus && (
                  <span className={`text-[11px] font-medium ${testStatus.startsWith("✓") ? "text-emerald-700" : "text-rose-600"}`}>
                    {testStatus}
                  </span>
                )}
              </form>
            </div>
          )}

          {/* Disable confirmation form */}
          {showDisableForm && !required && (
            <form onSubmit={disableTwoFactor} className="p-4 bg-red-50/60 border border-red-200 rounded-xl space-y-2.5">
              <p className="text-xs text-red-900 font-medium">Confirm your password to disable Two-Factor Authentication:</p>
              <div className="flex gap-2">
                <input
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  placeholder="Account password"
                  value={password}
                  className="flex-1 text-xs px-3 py-2 border border-red-200 rounded-lg bg-white"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition"
                >
                  {loading ? "Disabling..." : "Confirm Disable"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDisableForm(false); setPassword(""); }}
                  className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 2. WHEN DISABLED: Initial Setup Flow */}
      {!isEnabled && !enrollment && !showSetup && (
        <div className="mt-4 pt-3 border-t border-[#eeece6] flex items-center justify-between">
          <span className="text-xs text-[#74818b]">Add extra protection to your bookings and profile</span>
          <button 
            type="button" 
            onClick={() => setShowSetup(true)}
            className="px-3.5 py-2 bg-[#071d32] hover:bg-[#11314f] text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#c9a66b]" />
            Configure Google Authenticator
          </button>
        </div>
      )}

      {/* Password Confirmation Before Enrollment */}
      {!isEnabled && !enrollment && showSetup && (
        <form className="mt-4 pt-4 border-t border-[#eeece6] space-y-3" onSubmit={beginEnrollment}>
          <p className="text-xs text-[#071d32] font-medium">Confirm your password to generate your authenticator setup key & QR code:</p>
          <div className="flex gap-2">
            <input 
              autoComplete="current-password" 
              onChange={(event) => setPassword(event.target.value)} 
              required 
              type="password" 
              placeholder="Your account password"
              value={password}
              className="flex-1 text-xs px-3 py-2 border border-[#e1dfd8] rounded-lg outline-none focus:border-[#c9a66b]"
            />
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-[#071d32] text-white text-xs font-semibold rounded-lg hover:bg-[#11314f] transition disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => { setShowSetup(false); setPassword(""); }}
              className="px-3 py-2 bg-white border border-gray-300 text-gray-700 text-xs rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Initial Enrollment QR Code Presentation */}
      {!isEnabled && enrollment && (
        <div className="mt-4 pt-4 border-t border-[#eeece6] space-y-4">
          <div className="flex border-b border-[#e6e3dc] pb-2 gap-4">
            <button
              type="button"
              onClick={() => setSetupTab("qr")}
              className={`text-xs font-bold pb-1 flex items-center gap-1.5 transition ${
                setupTab === "qr" ? "text-[#071d32] border-b-2 border-[#c9a66b]" : "text-[#74818b] hover:text-[#071d32]"
              }`}
            >
              <QrCode className="w-3.5 h-3.5" /> Scan QR Code
            </button>
            <button
              type="button"
              onClick={() => setSetupTab("key")}
              className={`text-xs font-bold pb-1 flex items-center gap-1.5 transition ${
                setupTab === "key" ? "text-[#071d32] border-b-2 border-[#c9a66b]" : "text-[#74818b] hover:text-[#071d32]"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" /> Manual Setup Key
            </button>
          </div>

          {setupTab === "qr" && (
            <div className="space-y-3 text-center">
              {qrCodeDataUrl ? (
                <div className="inline-block p-3 bg-white border border-[#e1dfd8] rounded-xl shadow-sm">
                  <Image 
                    src={qrCodeDataUrl} 
                    alt="Scan Google Authenticator 2FA QR Code" 
                    width={200}
                    height={200}
                    unoptimized
                    className="w-48 h-48 mx-auto object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 mx-auto flex items-center justify-center bg-gray-50 text-xs text-gray-500 rounded-xl border border-gray-200">
                  Generating QR code...
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-[#071d32]">Scan with Google Authenticator</p>
                <p className="text-[11px] text-[#74818b] mt-0.5">
                  Open Google Authenticator, tap <strong>+ (Add Account)</strong> and point your camera at this QR code.
                </p>
              </div>
            </div>
          )}

          {setupTab === "key" && (
            <div className="p-3.5 bg-[#f8f7f4] border border-[#e6e3dc] rounded-xl text-xs space-y-2.5">
              <p className="font-semibold text-[#071d32]">Enter this key manually in your authenticator app:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white border border-[#e1dfd8] rounded font-mono text-[11px] text-[#071d32] select-all break-all">
                  {currentSecretKey}
                </code>
                <button
                  type="button"
                  onClick={copySetupKey}
                  className="px-3 py-2 bg-white border border-[#e1dfd8] rounded text-[11px] font-medium text-[#071d32] hover:bg-gray-50 flex items-center gap-1 shrink-0"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? "Copied" : "Copy Key"}
                </button>
              </div>
              <p className="text-[11px] text-[#74818b]">
                Account Name: <strong>StanBridge Airways</strong>
              </p>
            </div>
          )}

          {/* Verification Code Submission */}
          <form className="space-y-2.5 bg-[#fbfaf8] p-4 border border-[#eee9de] rounded-xl" onSubmit={confirmEnrollment}>
            <p className="font-semibold text-[#071d32] text-xs">Enter the 6-digit verification code generated by Google Authenticator:</p>
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
                className="w-44 text-sm tracking-widest text-center px-3 py-2 border border-[#e1dfd8] rounded-lg outline-none focus:border-[#c9a66b] bg-white font-mono"
              />
              <button 
                type="submit" 
                disabled={loading}
                className="px-4 py-2 bg-[#071d32] text-white text-xs font-semibold rounded-lg hover:bg-[#11314f] transition disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Activate"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
