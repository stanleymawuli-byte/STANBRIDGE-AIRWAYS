"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");

  async function signOut() {
    setErrorMessage("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        console.error("Sign out failed.", result.error);
        setErrorMessage("We couldn't sign you out. Please try again.");
        return;
      }
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Sign out request failed.", error);
      setErrorMessage("Account services are temporarily unavailable. Please try again.");
    }
  }

  return (
    <>
      {errorMessage && <p className="auth-error" role="alert">{errorMessage}</p>}
      <button className="auth-submit" onClick={signOut} type="button">
        Sign out
      </button>
    </>
  );
}
