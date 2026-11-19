import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPaystackSignature } from "@/lib/paystack";
import { createAmadeusOrderForPaidBooking } from "@/lib/amadeus-orders";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!verifyPaystackSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event?: string;
    data?: {
      reference?: string;
      amount?: number;
      currency?: string;
      status?: string;
      gateway_response?: string;
    };
  };
  if (event.event !== "charge.success" || !event.data?.reference) {
    return NextResponse.json({ received: true });
  }

  const payment = await prisma.payment.findUnique({
    where: { reference: event.data.reference },
  });
  if (!payment) return NextResponse.json({ received: true });

  const succeeded =
    event.data.status === "success" &&
    event.data.amount === payment.amountMinor &&
    event.data.currency === payment.currency;

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: succeeded ? "SUCCESS" : "FAILED",
      providerResponse: event.data.gateway_response ?? event.data.status ?? null,
      verifiedAt: new Date(),
    },
  });
  if (succeeded) {
    await prisma.booking.updateMany({
      where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
      data: { status: "CONFIRMED" },
    });
    await createAmadeusOrderForPaidBooking(payment.bookingId);
  }
  return NextResponse.json({ received: true });
}
