import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createDatabaseBackup } from "@/lib/database-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || secret.length < 32 || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const backup = await createDatabaseBackup(null);
    return NextResponse.json({ success: true, backup: { id: backup.id, filename: backup.filename, sizeBytes: backup.sizeBytes, sha256: backup.sha256, storageType: backup.storageType } }, { status: 201 });
  } catch (error) {
    console.error("Scheduled database backup failed", error);
    return NextResponse.json({ error: "Scheduled backup failed. Check server logs and backup configuration." }, { status: 500 });
  }
}
