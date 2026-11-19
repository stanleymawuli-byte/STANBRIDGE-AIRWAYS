import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export class PaystackConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackConfigurationError";
  }
}

export function paystackConfiguration() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  const currency = process.env.PAYSTACK_CURRENCY?.trim().toUpperCase();
  if (!secretKey) throw new PaystackConfigurationError("PAYSTACK_SECRET_KEY is not configured.");
  if (!currency) throw new PaystackConfigurationError("PAYSTACK_CURRENCY is not configured.");
  return { secretKey, currency };
}

export async function initializePaystackPayment(input: {
  email: string;
  amountMinor: number;
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}) {
  const { secretKey } = paystackConfiguration();
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountMinor,
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  const data = (await response.json()) as {
    status: boolean;
    message?: string;
    data?: { authorization_url: string; access_code: string };
  };
  if (!response.ok || !data.status || !data.data) {
    throw new Error(data.message ?? `Paystack initialization failed (${response.status}).`);
  }
  return data.data;
}

export async function verifyPaystackPayment(reference: string) {
  const { secretKey } = paystackConfiguration();
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secretKey}` }, cache: "no-store" },
  );
  const data = (await response.json()) as {
    status: boolean;
    message?: string;
    data?: {
      status: string;
      amount: number;
      currency: string;
      reference: string;
      gateway_response?: string;
      metadata?: Record<string, unknown>;
    };
  };
  if (!response.ok || !data.status) {
    throw new Error(data.message ?? `Paystack verification failed (${response.status}).`);
  }
  return data.data;
}

export function verifyPaystackSignature(rawBody: string, signature: string | null) {
  if (!signature) return false;
  const { secretKey } = paystackConfiguration();
  const digest = createHmac("sha512", secretKey).update(rawBody).digest();
  const supplied = Buffer.from(signature, "hex");
  return digest.length === supplied.length && timingSafeEqual(digest, supplied);
}
