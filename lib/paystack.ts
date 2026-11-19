import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export class PaystackConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaystackConfigurationError";
  }
}

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY?.trim());
}

export function paystackConfiguration() {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim() || "sk_test_demo";
  const currency = process.env.PAYSTACK_CURRENCY?.trim().toUpperCase() || "USD";
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
  if (!isPaystackConfigured()) {
    const separator = input.callbackUrl.includes("?") ? "&" : "?";
    return {
      authorization_url: `${input.callbackUrl}${separator}reference=${encodeURIComponent(input.reference)}`,
      access_code: `demo_${input.reference}`,
    };
  }

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
  if (!isPaystackConfigured()) {
    const payment = await prisma.payment.findUnique({
      where: { reference },
      select: { amountMinor: true, currency: true },
    });
    return {
      status: "success",
      amount: payment?.amountMinor ?? 0,
      currency: payment?.currency ?? "USD",
      reference,
      gateway_response: "Demo simulation payment verified",
    };
  }

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
