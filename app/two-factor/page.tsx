import { Suspense } from "react";
import { TwoFactorChallenge } from "@/components/two-factor-challenge";

export const metadata = {
  title: "Verify sign-in | StanBridge Airways",
};

export default function TwoFactorPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <div className="auth-card" style={{ textAlign: "center", padding: "48px 24px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                margin: "0 auto 16px",
                borderRadius: "50%",
                border: "2px solid #c9a66b",
                borderTopColor: "transparent",
                animation: "spin 1s linear infinite",
              }}
            />
            <p style={{ fontSize: "12px", color: "#74818b" }}>Loading security verification...</p>
          </div>
        </main>
      }
    >
      <TwoFactorChallenge />
    </Suspense>
  );
}
