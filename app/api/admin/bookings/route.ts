import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

const editableRoles = new Set(["SUPER_ADMIN", "OPERATIONS_MANAGER", "BOOKING_AGENT"]);
const bookingStatuses = new Set(["PENDING_PAYMENT", "CONFIRMED", "CANCELLED", "EXPIRED"]);

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });

  const parameters = request.nextUrl.searchParams;
  const status = parameters.get("status");
  if (status && !bookingStatuses.has(status)) {
    return NextResponse.json({ error: "Invalid booking status." }, { status: 400 });
  }
  const requestedPage = Number(parameters.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const bookings = await prisma.booking.findMany({
    where: status ? { status: status as "PENDING_PAYMENT" | "CONFIRMED" | "CANCELLED" | "EXPIRED" } : undefined,
    take: 50,
    skip: (page - 1) * 50,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reference: true,
      status: true,
      origin: true,
      destination: true,
      departureDate: true,
      returnDate: true,
      cabin: true,
      airline: true,
      fareAmount: true,
      fareCurrency: true,
      amadeusOrderStatus: true,
      amadeusOrderId: true,
      amadeusRecordLocator: true,
      amadeusOrderError: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      passengers: {
        select: { title: true, firstName: true, lastName: true, type: true },
      },
      ticket: { select: { ticketNumber: true, status: true } },
      payments: {
        select: { reference: true, status: true, amount: true, currency: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  return NextResponse.json({ bookings });
}

export async function PATCH(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  if (!editableRoles.has(session.user.role)) {
    return NextResponse.json({ error: "Your role cannot update bookings." }, { status: 403 });
  }

  const body = (await request.json()) as { bookingId?: string; status?: string };
  if (!body.bookingId || body.status !== "CANCELLED") {
    return NextResponse.json({ error: "Only booking cancellation is supported." }, { status: 400 });
  }
  const booking = await prisma.booking.findUnique({ where: { id: body.bookingId } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "Only pending-payment bookings can be cancelled here. Confirmed bookings need a refund workflow." },
      { status: 409 },
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.booking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED" },
      select: { id: true, reference: true, status: true },
    });
    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: { status: "ABANDONED" },
    });
    await tx.auditLog.create({
      data: { actorId: session.user.id, action: "BOOKING_CANCELLED_BY_STAFF", entityType: "Booking", entityId: booking.id, metadata: { reference: booking.reference, role: session.user.role } },
    });
    return changed;
  });
  return NextResponse.json({ booking: updated });
}
