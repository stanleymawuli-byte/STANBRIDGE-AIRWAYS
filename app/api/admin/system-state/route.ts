import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ error: "Staff access required." }, { status: 403 });
  try {
    const [users, bookings, payments, pendingBookings, auditEvents, settingsCount, latestBackup] = await Promise.all([
      prisma.user.count(), prisma.booking.count(), prisma.payment.count(),
      prisma.booking.count({ where: { status: "PENDING_PAYMENT" } }), prisma.auditLog.count(),
      prisma.systemSetting.count(),
      prisma.backupRecord.findFirst({ orderBy: { createdAt: "desc" }, select: { id: true, filename: true, status: true, storageType: true, sizeBytes: true, createdAt: true } }),
    ]);
    await prisma.$queryRaw`SELECT 1`;
    const s3BackupConfigured = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    const backupStorageConfigured = process.env.NODE_ENV !== "production" || s3BackupConfigured || Boolean(process.env.BACKUP_DIRECTORY);
    return NextResponse.json({
      status: backupStorageConfigured ? "HEALTHY" : "DEGRADED",
      checkedAt: new Date().toISOString(), environment: process.env.NODE_ENV || "development", database: "CONNECTED",
      counts: { users, bookings, payments, pendingBookings, auditEvents },
      configuration: { storedSettings: settingsCount },
      integrations: {
        emailConfigured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
        amadeusConfigured: Boolean(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET),
        paystackConfigured: Boolean(process.env.PAYSTACK_SECRET_KEY),
        s3BackupConfigured,
      },
      latestBackup: latestBackup ? { ...latestBackup, sizeBytes: latestBackup.sizeBytes.toString() } : null,
      backupStorageConfigured,
    });
  } catch (error) {
    console.error("System-state check failed", error);
    return NextResponse.json({ status: "DEGRADED", checkedAt: new Date().toISOString(), database: "UNAVAILABLE", error: "The system state could not be fully checked." }, { status: 503 });
  }
}
