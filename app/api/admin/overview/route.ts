import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });

  const [customers, allBookings, pendingBookings, confirmedBookings, cancelledBookings, payments, recentBookings] =
    await Promise.all([
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.booking.count(),
      prisma.booking.count({ where: { status: "PENDING_PAYMENT" } }),
      prisma.booking.count({ where: { status: "CONFIRMED" } }),
      prisma.booking.count({ where: { status: "CANCELLED" } }),
      prisma.payment.groupBy({
        by: ["currency"],
        where: { status: "SUCCESS" },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.booking.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reference: true,
          status: true,
          origin: true,
          destination: true,
          departureDate: true,
          fareAmount: true,
          fareCurrency: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

  return NextResponse.json({
    role: session.user.role,
    metrics: {
      customers,
      allBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      successfulPayments: payments.reduce((total, entry) => total + entry._count._all, 0),
      successfulPaymentTotal: payments.map((entry) => ({
        currency: entry.currency,
        amount: entry._sum.amount?.toString() ?? "0",
      })),
    },
    recentBookings,
  });
}
