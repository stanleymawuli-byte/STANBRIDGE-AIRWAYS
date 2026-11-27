import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const booking = await prisma.booking.findFirst({
    where: { id, userId: session.user.id },
    include: { passengers: true, ticket: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  return NextResponse.json({ booking });
}

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { id } = await context.params;
  const booking = await prisma.booking.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "Only bookings awaiting payment can be cancelled online. Confirmed bookings require an approved refund workflow." },
      { status: 409 },
    );
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
    }),
    prisma.payment.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "ABANDONED" },
    }),
  ]);
  return NextResponse.json({ booking: updated });
}
