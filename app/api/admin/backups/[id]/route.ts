import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getS3Object } from "@/lib/s3-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getStaffSession();
  if (!session || session.user.role !== "SUPER_ADMIN") return NextResponse.json({ error: "Super-admin access required." }, { status: 403 });
  const { id } = await context.params;
  const backup = await prisma.backupRecord.findUnique({ where: { id } });
  if (!backup || backup.status !== "COMPLETED") return NextResponse.json({ error: "Backup not found or not completed." }, { status: 404 });
  if (backup.storageType === "S3") {
    try {
      const object = await getS3Object(backup.storageKey);
      if (!object.body) return NextResponse.json({ error: "Backup object is empty." }, { status: 404 });
      return new NextResponse(object.body, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=\"" + backup.filename + "\"", "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("S3 backup download failed", error);
      return NextResponse.json({ error: "Could not retrieve the backup from S3." }, { status: 502 });
    }
  }
  if (backup.storageType !== "LOCAL" || path.basename(backup.storageKey) !== backup.storageKey) return NextResponse.json({ error: "Unsupported backup storage." }, { status: 404 });
  const directory = path.resolve(process.env.BACKUP_DIRECTORY || path.join(process.cwd(), "backups"));
  const filePath = path.resolve(directory, backup.storageKey);
  if (!filePath.startsWith(directory + path.sep)) return NextResponse.json({ error: "Invalid backup path." }, { status: 400 });
  try {
    const fileStats = await stat(filePath);
    if (!fileStats.isFile()) return NextResponse.json({ error: "Backup file not found." }, { status: 404 });
    const digest = createHash("sha256");
    for await (const chunk of createReadStream(filePath)) digest.update(chunk);
    if (digest.digest("hex") !== backup.sha256) return NextResponse.json({ error: "Backup checksum verification failed." }, { status: 409 });
    return new NextResponse(createReadStream(filePath) as unknown as BodyInit, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment; filename=\"" + backup.filename + "\"", "Content-Length": String(fileStats.size), "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Local backup download failed", error);
    return NextResponse.json({ error: "Could not retrieve the backup file." }, { status: 404 });
  }
}
