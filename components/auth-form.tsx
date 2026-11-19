"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Plane } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [verificationPending, setVerificationPending] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegistering = mode === "register";

  async function resendVerification() {
    setVerificationMessage("");
    try {
      const result = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: "/account",
      });
      if (result.error) throw new Error(result.error.message ?? "Could not send verification email.");
      setVerificationMessage("If an unverified account exists for this address, a verification link has been sent.");
    } catch (error) {
      console.error("Verification email request failed.", error);
      setVerificationMessage("Could not send the verification email. Please try again later.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = isRegistering
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
          });

      if (result.error) {
        if (!isRegistering && result.error.code === "EMAIL_NOT_VERIFIED") {
          setVerificationPending(true);
          setErrorMessage("Verify your email address before signing in.");
          return;
        }
        if (result.error.status === 503) {
          setErrorMessage("Account services are not configured yet. Please try again later.");
          return;
        }
        setErrorMessage(
          isRegistering
            ? "We couldn't create your account. If you already registered, try signing in."
            : "The email or password is incorrect.",
        );
        return;
      }

      if (isRegistering) {
        if (result.data?.user) {
          router.replace("/account");
          router.refresh();
          return;
        }
        setVerificationPending(true);
        setVerificationMessage("Account created. Check your email for a verification link before signing in.");
        return;
      }

      if (result.data && (result.data as { twoFactorRedirect?: boolean }).twoFactorRedirect) {
        router.replace("/two-factor");
        router.refresh();
        return;
      }

      router.replace("/account");
      router.refresh();
    } catch (error) {
      console.error("Account request failed.", error);
      setErrorMessage("Account services are temporarily unavailable. Please try again later.");
    } finally {
      setIsSubmitting(false);
    }

  }

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/" aria-label="StanBridge Airways home">
        <span className="brand-mark"><Plane size={20} /></span>
        <span><strong>STANBRIDGE</strong><small>A I R W A Y S</small></span>
      </Link>

      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="eyebrow dark"><span /> PASSENGER ACCOUNT</div>
        <h1 id="auth-heading">{isRegistering ? "Create your account" : "Welcome back"}</h1>
        <p className="auth-intro">
          {isRegistering
            ? "Keep your travel details together for the journeys ahead."
            : "Sign in to continue to your passenger account."}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {isRegistering && (
            <label>
              <span>FULL NAME</span>
              <input
                autoComplete="name"
                maxLength={100}
                minLength={2}
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          )}
          <label>
            <span>EMAIL ADDRESS</span>
            <input
              autoComplete="email"
              maxLength={254}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            <span>PASSWORD</span>
            <input
              autoComplete={isRegistering ? "new-password" : "current-password"}
              maxLength={128}
              minLength={isRegistering ? 12 : undefined}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            {isRegistering && <small>Use at least 12 characters.</small>}
          </label>

          {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
          {verificationMessage && <p className="auth-success" role="status">{verificationMessage}</p>}
          {verificationPending && (
            <button className="auth-secondary" type="button" onClick={resendVerification}>
              Resend verification email
            </button>
          )}

          <button className="auth-submit" disabled={isSubmitting} type="submit">
            {isSubmitting
              ? "Please wait..."
              : isRegistering
                ? "Create account"
                : "Sign in"}
            {!isSubmitting && <ArrowRight size={17} />}
          </button>
        </form>

        <p className="auth-switch">
          {isRegistering ? "Already have an account?" : "New to StanBridge?"}{" "}
          <Link href={isRegistering ? "/login" : "/register"}>
            {isRegistering ? "Sign in" : "Create an account"}
          </Link>
        </p>
        {!isRegistering && <p className="auth-switch"><Link href="/forgot-password">Forgot your password?</Link></p>}
        <p className="auth-note">
          Accounts use secure password hashing, verified email addresses, and protected sessions.
        </p>
      </section>
      <Link className="auth-back" href="/">Back to StanBridge Airways</Link>
    </main>
  );
}
