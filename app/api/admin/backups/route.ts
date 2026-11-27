import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { createDatabaseBackup } from "@/lib/database-backup";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  const backups = await prisma.backupRecord.findMany({ take: 50, orderBy: { createdAt: "desc" }, select: { id: true, filename: true, storageType: true, status: true, sizeBytes: true, sha256: true, createdAt: true } });
  return NextResponse.json({ backups: backups.map((item) => ({ ...item, sizeBytes: item.sizeBytes.toString() })) });
}

export async function POST() {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  try {
    const backup = await createDatabaseBackup(session.user.id);
    return NextResponse.json({ backup }, { status: 201 });
  } catch (error) {
    console.error("Database backup failed", error);
    const message = error instanceof Error && error.message.includes("pg_dump") ? "pg_dump failed or is not installed. Configure PG_DUMP_PATH and check server logs." : error instanceof Error && error.message.includes("Configure AWS S3") ? error.message : "The database backup could not be completed. Check the database connection and server logs.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
