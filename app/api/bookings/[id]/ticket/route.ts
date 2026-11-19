import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUserSession } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export async function POST(
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
  return NextResponse.json(
    { error: "An Amadeus flight order is a reservation, not an e-ticket. Ticket issuance is not available in the Amadeus self-service API." },
    { status: 409 },
  );
}
