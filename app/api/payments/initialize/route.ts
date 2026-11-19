import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { getVerifiedUserSession } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";
import { initializePaystackPayment, paystackConfiguration } from "@/lib/paystack";

export async function POST(request: NextRequest) {
  const session = await getVerifiedUserSession();
  if (!session) return NextResponse.json({ error: "Sign in and complete Google Authenticator setup to continue." }, { status: 401 });

  const body = (await request.json()) as { bookingId?: string };
  if (!body.bookingId) return NextResponse.json({ error: "bookingId is required." }, { status: 400 });

  const booking = await prisma.booking.findFirst({
    where: { id: body.bookingId, userId: session.user.id },
    include: { passengers: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "PENDING_PAYMENT") {
    return NextResponse.json({ error: "Payment is only available for pending bookings." }, { status: 409 });
  }
  if (booking.expiresAt < new Date()) {
    await prisma.booking.update({ where: { id: booking.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "This booking has expired." }, { status: 409 });
  }

  const { currency } = paystackConfiguration();
  if (booking.fareCurrency !== currency) {
    return NextResponse.json(
      { error: `Paystack is configured for ${currency}, but this fare is ${booking.fareCurrency}. Currency conversion is not configured.` },
      { status: 409 },
    );
  }
  const email = booking.passengers[0]?.email?.trim() || session.user.email;
  const amountMinor = Math.round(Number(booking.fareAmount) * 100);
  const reference = `SBP-${randomBytes(8).toString("hex").toUpperCase()}`;

  try {
    const initialized = await initializePaystackPayment({
      email,
      amountMinor,
      currency,
      reference,
      callbackUrl: `${process.env.APP_URL?.replace(/\/$/, "")}/account?payment=success&booking=${booking.id}`,
      metadata: { bookingId: booking.id, bookingReference: booking.reference, userId: session.user.id },
    });
    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        reference,
        currency,
        amount: booking.fareAmount,
        amountMinor,
        authorizationUrl: initialized.authorization_url,
        accessCode: initialized.access_code,
      },
    });
    return NextResponse.json({
      payment: {
        id: payment.id,
        reference: payment.reference,
        authorizationUrl: payment.authorizationUrl,
      },
    }, { status: 201 });
  } catch (error) {
    console.error("Paystack initialization failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment initialization failed." },
      { status: 502 },
    );
  }
}
