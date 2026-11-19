import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });

  const [bookingsByStatus, popularRoutes, paymentsByCurrency] = await Promise.all([
    prisma.booking.groupBy({
      by: ["status"],
      _count: { _all: true },
      orderBy: { status: "asc" },
    }),
    prisma.booking.groupBy({
      by: ["origin", "destination"],
      _count: { _all: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),
    prisma.payment.groupBy({
      by: ["currency", "status"],
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: [{ currency: "asc" }, { status: "asc" }],
    }),
  ]);

  return NextResponse.json({
    bookingsByStatus: bookingsByStatus.map(({ status, _count }) => ({ status, count: _count._all })),
    popularRoutes: popularRoutes.map(({ origin, destination, _count }) => ({
      origin,
      destination,
      bookings: _count._all,
    })),
    paymentsByCurrency: paymentsByCurrency.map(({ currency, status, _sum, _count }) => ({
      currency,
      status,
      amount: _sum.amount?.toString() ?? "0",
      count: _count._all,
    })),
  });
}
