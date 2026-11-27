import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaystackSignature } from "@/lib/paystack";
import { createAmadeusOrderForPaidBooking } from "@/lib/amadeus-orders";
import { sendBookingConfirmationNotifications } from "@/lib/notifications";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  const signature = request.headers.get("x-paystack-signature");
  let signatureValid = false;
  try {
    signatureValid = verifyPaystackSignature(rawBody, signature);
  } catch (error) {
    console.error("Paystack webhook configuration error", error);
    return NextResponse.json({ error: "Payment webhook is not configured." }, { status: 503 });
  }
  if (!signatureValid) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  let event: {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      currency?: string;
      status?: string;
      gateway_response?: string;
    };
  };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: "Invalid webhook JSON." }, { status: 400 });
  }
  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const payment = await prisma.payment.findUnique({
    where: { reference: event.data.reference },
  });
  if (!payment) return NextResponse.json({ received: true });

  if (payment.status === "SUCCESS") return NextResponse.json({ received: true, duplicate: true });
  const succeeded =
    event.data.status === "success" &&
    event.data.reference === payment.reference &&
    event.data.amount === payment.amountMinor &&
    event.data.currency === payment.currency;

  const changed = await prisma.payment.updateMany({
    where: { id: payment.id, status: { not: "SUCCESS" } },
    data: {
      status: succeeded ? "SUCCESS" : "FAILED",
      providerResponse: event.data.gateway_response ?? event.data.status ?? null,
      verifiedAt: new Date(),
    },
  });
  if (succeeded && changed.count > 0) {
    await prisma.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
      data: { status: "CONFIRMED" },
    });
    await createAmadeusOrderForPaidBooking(payment.bookingId);
    void sendBookingConfirmationNotifications(payment.bookingId);
  }
  return NextResponse.json({ received: true });
}
