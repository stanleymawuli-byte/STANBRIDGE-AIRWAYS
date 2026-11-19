import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUserSession } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getVerifiedUserSession();
  if (!session) return NextResponse.json({ error: "Sign in and complete Google Authenticator setup to continue." }, { status: 401 });
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
  const session = await getVerifiedUserSession();
  if (!session) return NextResponse.json({ error: "Sign in and complete Google Authenticator setup to continue." }, { status: 401 });
  const { id } = await context.params;
  const booking = await prisma.booking.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status === "CANCELLED") {
    return NextResponse.json({ error: "This booking can no longer be cancelled." }, { status: 409 });
  }

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json({ booking: updated });
}
