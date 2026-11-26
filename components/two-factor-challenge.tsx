"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { 
  ArrowRight, 
  Plane, 
  KeyRound, 
  Copy, 
  Check, 
  Loader2, 
  Smartphone 
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function TwoFactorChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // QR Code & Secret state
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [secretKey, setSecretKey] = useState<string>("");
  const [resolvedEmail, setResolvedEmail] = useState<string>("");
  const [qrLoading, setQrLoading] = useState(true);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load challenge QR code
  useEffect(() => {
    let isMounted = true;

    async function loadChallengeQr() {
      setQrLoading(true);
      try {
        let email = searchParams?.get("email")?.trim().toLowerCase() || "";
        if (!email && typeof window !== "undefined") {
          try {
            email = sessionStorage.getItem("sb_auth_challenge_email") || "";
          } catch {}
        }

        const query = email ? `?email=${encodeURIComponent(email)}` : "";
        const res = await fetch(`/api/auth/two-factor/challenge-qr${query}`);
        const data = await res.json();

        if (isMounted && res.ok && data.qrCodeDataUrl) {
          setQrCodeDataUrl(data.qrCodeDataUrl);
          if (data.secret) setSecretKey(data.secret);
          if (data.email) setResolvedEmail(data.email);
        }
      } catch (err) {
        console.error("Failed to load two-factor challenge QR code", err);
      } finally {
        if (isMounted) setQrLoading(false);
      }
    }

    loadChallengeQr();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  function copyKey() {
    if (!secretKey) return;
    navigator.clipboard.writeText(secretKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = backup
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim() })
        : await authClient.twoFactor.verifyTotp({ code: code.trim() });
      if (result.error) {
        if (result.error.message?.toLowerCase().includes("cookie")) {
          throw new Error("Your sign-in session expired. Please sign in again with your email and password to verify.");
        }
        throw new Error(result.error.message ?? "The code was not accepted. Please ensure your device clock is synced.");
      }
      router.replace("/account");
      router.refresh();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "The code was not accepted.";
      setError(msg);
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
      
      <section className="auth-card" aria-labelledby="two-factor-heading" style={{ maxWidth: "480px" }}>
        <div className="eyebrow dark"><span /> ACCOUNT SECURITY</div>
        <h1 id="two-factor-heading" style={{ fontSize: "28px", marginBottom: "6px" }}>Verify it&apos;s you</h1>
        
        {resolvedEmail && (
          <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#74818b" }}>
            Signing in as <strong style={{ color: "#071d32" }}>{resolvedEmail}</strong>
          </p>
        )}

        {/* 1. AUTHENTICATOR MODE: SHOW QR CODE DIRECTLY */}
        {!backup ? (
          <div className="space-y-4">
            <div className="p-4 bg-[#fbfaf8] border border-[#e8e4da] rounded-xl text-center space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#071d32]">
                <Smartphone className="w-4 h-4 text-[#c9a66b]" />
                <span>Scan with Google Authenticator</span>
              </div>

              {qrLoading ? (
                <div className="w-44 h-44 mx-auto flex flex-col items-center justify-center bg-white border border-[#e1dfd8] rounded-xl text-xs text-[#74818b] gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-[#c9a66b]" />
                  <span>Loading QR code...</span>
                </div>
              ) : qrCodeDataUrl ? (
                <div className="space-y-2">
                  <div className="inline-block p-2.5 bg-white border border-[#e1dfd8] rounded-xl shadow-sm">
                    <Image
                      src={qrCodeDataUrl}
                      alt="Google Authenticator QR Code"
                      width={180}
                      height={180}
                      unoptimized
                      priority
                      className="w-44 h-44 object-contain mx-auto"
                    />
                  </div>
                  <p className="text-[11px] text-[#74818b] leading-tight max-w-[280px] mx-auto">
                    Open <strong>Google Authenticator</strong>, tap <strong>+</strong>, and scan this code to get your 6-digit login token.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-white border border-[#e1dfd8] rounded-xl text-xs text-[#74818b]">
                  Please enter the 6-digit code from your authenticator app below.
                </div>
              )}

              {secretKey && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="text-[11px] text-[#987343] hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <KeyRound className="w-3 h-3" />
                    {showSecret ? "Hide manual setup key" : "Can't scan? Use manual setup key"}
                  </button>

                  {showSecret && (
                    <div className="mt-2 p-2.5 bg-white border border-[#e1dfd8] rounded-lg text-left space-y-1.5">
                      <span className="text-[9px] font-bold text-[#9a794c] tracking-wider uppercase block">
                        Manual Setup Key
                      </span>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-1.5 bg-[#f8f7f4] border border-[#e1dfd8] rounded font-mono text-[10px] text-[#071d32] select-all break-all">
                          {secretKey}
                        </code>
                        <button
                          type="button"
                          onClick={copyKey}
                          className="px-2.5 py-1.5 bg-[#071d32] text-white rounded text-[10px] font-medium hover:bg-[#123352] flex items-center gap-1 shrink-0"
                        >
                          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <form className="auth-form" onSubmit={submit} style={{ marginTop: "18px" }}>
              <label>
                <span>6-DIGIT AUTHENTICATOR CODE</span>
                <input
                  autoComplete="one-time-code"
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000 000"
                  style={{ textAlign: "center", fontSize: "20px", letterSpacing: "0.25em", fontWeight: "600" }}
                  onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
                  required
                  value={code}
                />
              </label>

              {error && (
                <div className="auth-error" role="alert" style={{ textAlign: "center", marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 6px 0" }}>{error}</p>
                  {error.includes("session expired") && (
                    <Link
                      href="/login"
                      style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        backgroundColor: "#071d32",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textDecoration: "none",
                        marginTop: "4px",
                      }}
                    >
                      Return to Sign In &rarr;
                    </Link>
                  )}
                </div>
              )}

              <button className="auth-submit" disabled={loading} type="submit">
                {loading ? "Verifying code..." : "Verify and sign in"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </div>
        ) : (
          /* 2. BACKUP CODE MODE */
          <div>
            <p className="auth-intro" style={{ marginBottom: "16px" }}>
              Enter one of your 10-character backup recovery codes to access your account.
            </p>
            <form className="auth-form" onSubmit={submit}>
              <label>
                <span>BACKUP CODE</span>
                <input
                  autoComplete="off"
                  autoFocus
                  maxLength={32}
                  placeholder="e.g. Wfpv-SIWEG"
                  onChange={(event) => setCode(event.target.value)}
                  required
                  value={code}
                />
              </label>

              {error && (
                <div className="auth-error" role="alert" style={{ textAlign: "center", marginBottom: "12px" }}>
                  <p style={{ margin: "0 0 6px 0" }}>{error}</p>
                  {error.includes("session expired") && (
                    <Link
                      href="/login"
                      style={{
                        display: "inline-block",
                        padding: "6px 14px",
                        backgroundColor: "#071d32",
                        color: "#ffffff",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: "600",
                        textDecoration: "none",
                        marginTop: "4px",
                      }}
                    >
                      Return to Sign In &rarr;
                    </Link>
                  )}
                </div>
              )}

              <button className="auth-submit" disabled={loading} type="submit">
                {loading ? "Verifying..." : "Verify backup code"}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>
          </div>
        )}

        <div className="auth-switch" style={{ marginTop: "18px", borderTop: "1px solid #eeece6", paddingTop: "14px" }}>
          <button
            className="auth-text-button"
            type="button"
            onClick={() => {
              setBackup(!backup);
              setCode("");
              setError("");
            }}
          >
            {backup ? "← Use authenticator app (scan QR code)" : "Lost your authenticator? Use a backup code"}
          </button>
        </div>

        <p className="auth-note" style={{ marginTop: "14px" }}>
          This verification request expires after 30 minutes. If this was not you, return to the{" "}
          <Link href="/login" className="text-[#987343] underline">sign in page</Link>.
        </p>
      </section>

      <Link className="auth-back" href="/">Back to StanBridge Airways</Link>
    </main>
  );
}
