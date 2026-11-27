import "server-only";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createWriteStream, createReadStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { prisma } from "@/lib/prisma";
import { putFileInS3 } from "@/lib/s3-storage";

function postgresEnvironment(databaseUrl: string): NodeJS.ProcessEnv {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Backup source must be PostgreSQL.");
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL must include a database name.");
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: database, PGCONNECT_TIMEOUT: "15", ...(url.searchParams.get("sslmode") ? { PGSSLMODE: url.searchParams.get("sslmode")! } : {}) };
}

export async function createDatabaseBackup(createdById: string | null) {
  const databaseUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured.");
  const useS3 = Boolean(process.env.AWS_S3_BUCKET && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  if (process.env.NODE_ENV === "production" && !useS3 && !process.env.BACKUP_DIRECTORY) throw new Error("Configure AWS S3 or a persistent BACKUP_DIRECTORY for production backups.");
  const directory = path.resolve(process.env.BACKUP_DIRECTORY || path.join(process.cwd(), "backups"));
  const filename = "stanbridge-postgres-" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid + ".dump";
  const filePath = path.join(directory, filename);
  const digest = createHash("sha256");
  const meter = new Transform({ transform(chunk: Buffer, _encoding, callback) { digest.update(chunk); callback(null, chunk); } });
  try {
    await mkdir(directory, { recursive: true });
    const child = spawn(process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--no-owner", "--no-acl"], { env: postgresEnvironment(databaseUrl), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    if (!child.stdout || !child.stderr) throw new Error("Could not open pg_dump output streams.");
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk.slice(0, 4000); });
    const exit = new Promise<void>((resolve, reject) => { child.once("error", reject); child.once("close", (code) => code === 0 ? resolve() : reject(new Error("pg_dump exited with code " + code + ": " + stderr))); });
    await Promise.all([pipeline(child.stdout, meter, createWriteStream(filePath, { flags: "wx" })), exit]);
    const fileStats = await stat(filePath);
    let sha256 = digest.digest("hex");
    let storageType = "LOCAL";
    let storageKey = filename;
    if (useS3) {
      storageKey = "database/" + filename;
      const uploaded = await putFileInS3(storageKey, filePath);
      sha256 = uploaded.sha256;
      storageType = "S3";
      await rm(filePath, { force: true });
    }
    const record = await prisma.$transaction(async (tx) => {
      const backup = await tx.backupRecord.create({ data: { filename, storageKey, storageType, status: "COMPLETED", sizeBytes: BigInt(fileStats.size), sha256, createdById }, select: { id: true, filename: true, sizeBytes: true, sha256: true, createdAt: true } });
      await tx.auditLog.create({ data: { actorId: createdById, action: createdById ? "DATABASE_BACKUP_CREATED" : "DATABASE_BACKUP_SCHEDULED", entityType: "BackupRecord", entityId: backup.id, metadata: { filename, sizeBytes: fileStats.size, sha256, storageType } } });
      return backup;
    });
    return { ...record, sizeBytes: record.sizeBytes.toString(), storageType };
  } catch (error) {
    await rm(filePath, { force: true }).catch(() => undefined);
    throw error;
  }
}
