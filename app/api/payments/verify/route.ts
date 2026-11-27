import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyPaystackPayment } from "@/lib/paystack";
import { createAmadeusOrderForPaidBooking } from "@/lib/amadeus-orders";
import { sendBookingConfirmationNotifications } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  let body: { reference?: string };
  try {
    body = await request.json() as { reference?: string };
  } catch {
    return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 });
  }
  if (!body.reference || typeof body.reference !== "string" || body.reference.length > 100) {
    return NextResponse.json({ error: "Payment reference is required." }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { reference: body.reference },
    include: { booking: true },
  });
  if (!payment || payment.booking.userId !== session.user.id) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.status === "SUCCESS") {
    return NextResponse.json({ payment, status: "SUCCESS" });
  }

  try {
    const transaction = await verifyPaystackPayment(body.reference);
    if (!transaction) return NextResponse.json({ error: "Paystack returned no transaction." }, { status: 502 });
    const referenceMatches = transaction.reference === payment.reference;
    const amountMatches = transaction.amount === payment.amountMinor;
    const currencyMatches = transaction.currency === payment.currency;
    const succeeded = transaction.status === "success";

    const status = succeeded && referenceMatches && amountMatches && currencyMatches ? "SUCCESS" : "FAILED";
    const changed = await prisma.payment.updateMany({
      where: { id: payment.id, status: { not: "SUCCESS" } },
      data: { status, providerResponse: transaction.gateway_response ?? transaction.status, verifiedAt: new Date() },
    });
    const updated = await prisma.payment.findUnique({ where: { id: payment.id } });
    if (changed.count === 0 && updated?.status === "SUCCESS") {
      return NextResponse.json({ payment: updated, status: "SUCCESS" });
    }
    let order = null;
    if (status === "SUCCESS") {
      await prisma.booking.updateMany({
        where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
        data: { status: "CONFIRMED" },
      });
      order = await createAmadeusOrderForPaidBooking(payment.bookingId);
      void sendBookingConfirmationNotifications(payment.bookingId);
    }
    return NextResponse.json({
      status,
      referenceMatches,
      amountMatches,
      currencyMatches,
      payment: updated,
      order,
    });
  } catch (error) {
    console.error("Paystack verification failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment verification failed." },
      { status: 502 },
    );
  }
}
