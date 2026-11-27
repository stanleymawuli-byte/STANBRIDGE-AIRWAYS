import { NextRequest, NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  const type = request.nextUrl.searchParams.get("type") || "bookings";
  const role = session.user.role;
  if (["users", "security", "audit"].includes(type) && role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required for this report." }, { status: 403 });
  if (type === "payments" && !["SUPER_ADMIN", "FINANCE_OFFICER"].includes(role)) return NextResponse.json({ error: "Finance report access required." }, { status: 403 });
  if (type === "bookings" && !["SUPER_ADMIN", "OPERATIONS_MANAGER", "BOOKING_AGENT"].includes(role)) return NextResponse.json({ error: "Booking report access required." }, { status: 403 });
  try {
    if (type === "bookings") {
      const groups = await prisma.booking.groupBy({ by: ["status"], _count: { _all: true } });
      return NextResponse.json({ title: "Booking report", rows: groups.map((item) => ({ status: item.status, count: item._count._all })) });
    }
    if (type === "users") {
      const groups = await prisma.user.groupBy({ by: ["role"], _count: { _all: true } });
      return NextResponse.json({ title: "User and role report", rows: groups.map((item) => ({ role: item.role, count: item._count._all })) });
    }
    if (type === "payments") {
      const groups = await prisma.payment.groupBy({ by: ["status", "currency"], _count: { _all: true }, _sum: { amount: true } });
      return NextResponse.json({ title: "Payment report", rows: groups.map((item) => ({ status: item.status, currency: item.currency, count: item._count._all, total: item._sum.amount?.toString() || "0" })) });
    }
    if (type === "security") {
      const staff = await prisma.user.findMany({ where: { role: { not: "CUSTOMER" } }, orderBy: { createdAt: "desc" }, take: 100, select: { name: true, email: true, role: true, twoFactorEnabled: true, emailVerified: true } });
      return NextResponse.json({ title: "Staff security report", rows: staff.map((item) => ({ name: item.name, email: item.email, role: item.role, twoFactor: item.twoFactorEnabled ? "Enabled" : "Required", emailVerified: item.emailVerified ? "Yes" : "No" })) });
    }
    if (type === "audit") {
      const events = await prisma.auditLog.findMany({ take: 100, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true, email: true } } } });
      return NextResponse.json({ title: "Audit log report", rows: events.map((item) => ({ action: item.action, actor: item.actor?.email || "System", entityType: item.entityType, entityId: item.entityId || "", createdAt: item.createdAt.toISOString() })) });
    }
    if (type === "system") {
      const [users, bookings, payments, backups, settings] = await Promise.all([prisma.user.count(), prisma.booking.count(), prisma.payment.count(), prisma.backupRecord.count(), prisma.systemSetting.count()]);
      const backupStorageConfigured = process.env.NODE_ENV !== "production" || Boolean(process.env.BACKUP_DIRECTORY || (process.env.AWS_S3_BUCKET && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY));
      return NextResponse.json({ title: "Current system state", rows: [{ item: "Database", state: "Connected" }, { item: "Backup storage", state: backupStorageConfigured ? "Configured" : "Missing" }, { item: "Email", state: process.env.RESEND_API_KEY ? "Configured" : "Missing" }, { item: "Amadeus", state: process.env.AMADEUS_CLIENT_ID ? "Configured" : "Missing" }, { item: "Paystack", state: process.env.PAYSTACK_SECRET_KEY ? "Configured" : "Demo mode" }], summary: { users, bookings, payments, backups, settings } });
    }
    return NextResponse.json({ error: "Unknown report type." }, { status: 400 });
  } catch (error) {
    console.error("Admin report failed", error);
    return NextResponse.json({ error: "The requested report could not be generated." }, { status: 500 });
  }
}
