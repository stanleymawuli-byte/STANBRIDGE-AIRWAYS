"use client";

import { useState } from "react";

export function PaymentActions({ bookingId, status }: { bookingId: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function initializePayment() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = (await response.json()) as {
        error?: string;
        payment?: { authorizationUrl?: string };
      };
      if (!response.ok || !data.payment?.authorizationUrl) {
        throw new Error(data.error ?? "Payment initialization failed.");
      }
      window.location.assign(data.payment.authorizationUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment initialization failed.");
    } finally {
      setLoading(false);
    }
  }

  if (status !== "PENDING_PAYMENT") return null;
  return (
    <div className="payment-actions">
      <button type="button" onClick={initializePayment} disabled={loading}>
        {loading ? "Opening checkout..." : "Pay with Paystack"}
      </button>
      {message && <p role="alert">{message}</p>}
    </div>
  );
}
