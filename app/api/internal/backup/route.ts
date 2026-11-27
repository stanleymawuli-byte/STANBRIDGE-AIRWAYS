import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!secret || Buffer.byteLength(secret) < 32) return false;
  const expectedBytes = Buffer.from(secret, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  if (expectedBytes.length !== suppliedBytes.length) return false;
  return timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  let body: { filename?: string; storageKey?: string; storageType?: string; sizeBytes?: number; sha256?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "A valid JSON request body is required." }, { status: 400 }); }
  if (body.storageType !== "S3" || typeof body.filename !== "string" || !(body.filename.startsWith("stanbridge-postgres-") && body.filename.endsWith(".dump") && /^[A-Za-z0-9T._-]+$/.test(body.filename)) || body.storageKey !== "database/" + body.filename || !Number.isSafeInteger(body.sizeBytes) || Number(body.sizeBytes) <= 0 || typeof body.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(body.sha256)) {
    return NextResponse.json({ error: "Backup metadata is invalid." }, { status: 400 });
  }
  try {
    const backup = await prisma.$transaction(async (tx) => {
      const created = await tx.backupRecord.create({ data: { filename: body.filename!, storageKey: body.storageKey!, storageType: "S3", status: "COMPLETED", sizeBytes: BigInt(body.sizeBytes!), sha256: body.sha256!, createdById: null }, select: { id: true, filename: true, sizeBytes: true, sha256: true, createdAt: true } });
      await tx.auditLog.create({ data: { actorId: null, action: "DATABASE_BACKUP_SCHEDULED", entityType: "BackupRecord", entityId: created.id, metadata: { filename: created.filename, sizeBytes: body.sizeBytes, sha256: body.sha256, storageType: "S3" } } });
      return created;
    });
    return NextResponse.json({ success: true, backup: { ...backup, sizeBytes: backup.sizeBytes.toString(), storageType: "S3" } }, { status: 201 });
  } catch (error) {
    console.error("Scheduled backup record creation failed", error);
    return NextResponse.json({ error: "Could not record backup metadata." }, { status: 500 });
  }
}
