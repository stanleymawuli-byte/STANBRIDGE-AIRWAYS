import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getFlightOrder } from "@/lib/amadeus";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });

  const { id } = await context.params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    select: { id: true, amadeusOrderId: true, amadeusOrderStatus: true },
  });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.amadeusOrderStatus !== "CREATED" || !booking.amadeusOrderId) {
    return NextResponse.json({ error: "No Amadeus order is available for this booking." }, { status: 409 });
  }

  try {
    const order = await getFlightOrder(booking.amadeusOrderId);
    return NextResponse.json({ order });
  } catch (error) {
    console.error("Amadeus order retrieval failed", error);
    return NextResponse.json(
      { error: "Could not retrieve the Amadeus order. Try again later." },
      { status: 502 },
    );
  }
}
