"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Loader2, AlertCircle, ArrowRight } from "lucide-react";

export function PaymentActions({ bookingId, status }: { bookingId: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [isExpired, setIsExpired] = useState(false);

  async function initializePayment() {
    setLoading(true);
    setMessage("");
    setIsExpired(false);

    const timeout = setTimeout(() => {
      setLoading(false);
      setMessage("Checkout request timed out. Please try again.");
    }, 20000);

    try {
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      clearTimeout(timeout);

      const data = (await response.json()) as {
        error?: string;
        payment?: { authorizationUrl?: string };
      };

      if (!response.ok || !data.payment?.authorizationUrl) {
        if (response.status === 409 && data.error?.toLowerCase().includes("expired")) {
          setIsExpired(true);
        }
        throw new Error(data.error ?? "Payment initialization failed.");
      }

      window.location.assign(data.payment.authorizationUrl);
    } catch (error) {
      clearTimeout(timeout);
      setMessage(error instanceof Error ? error.message : "Payment initialization failed.");
      setLoading(false);
    }
  }

  if (status !== "PENDING_PAYMENT") return null;

  return (
    <div className="flex flex-col items-end gap-2">
      {isExpired ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-rose-600 font-medium">Reservation expired</span>
          <Link
            href="/#book"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#071d32] hover:bg-[#143859] text-white text-xs font-semibold rounded-lg shadow-sm transition"
          >
            Re-book Flight <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <button
          type="button"
          onClick={initializePayment}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#071d32] hover:bg-[#112f4c] active:bg-[#051422] text-[#c9a66b] hover:text-[#e4c694] text-xs font-bold tracking-wider uppercase rounded-lg border border-[#c9a66b]/40 shadow-sm transition disabled:opacity-60 disabled:cursor-wait"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#c9a66b]" />
              <span>Connecting to Checkout...</span>
            </>
          ) : (
            <>
              <CreditCard className="w-3.5 h-3.5 text-[#c9a66b]" />
              <span>Pay with Paystack</span>
            </>
          )}
        </button>
      )}

      {message && !isExpired && (
        <div className="flex items-center gap-1.5 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded max-w-xs text-right">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}
