import { createHash, createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";

function required(name) { const value = process.env[name]?.trim(); if (!value) throw new Error(name + " is required."); return value; }
function postgresEnvironment(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") throw new Error("Database URL must use PostgreSQL.");
  return { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: decodeURIComponent(url.pathname.replace(/^\\//, "")), PGCONNECT_TIMEOUT: "15", ...(url.searchParams.get("sslmode") ? { PGSSLMODE: url.searchParams.get("sslmode") } : {}) };
}
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key, value) { return createHmac("sha256", key).update(value).digest(); }
function signedS3Request(method, key, payloadHash, date, config) {
  if (!key.startsWith("database/") || key.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(key)) throw new Error("Invalid S3 object key.");
  const host = "s3." + config.region + ".amazonaws.com";
  const uri = "/" + config.bucket + "/" + key.split("/").map(encodeURIComponent).join("/");
  const headers = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": date };
  if (config.sessionToken) headers["x-amz-security-token"] = config.sessionToken;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => name + ":" + headers[name].trim() + "\\n").join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [method, uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\\n");
  const shortDate = date.slice(0, 8);
  const scope = shortDate + "/" + config.region + "/s3/aws4_request";
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, sha256(canonicalRequest)].join("\\n");
  const dateKey = hmac("AWS4" + config.secretKey, shortDate);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = "AWS4-HMAC-SHA256 Credential=" + config.accessKey + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
  const requestHeaders = { "x-amz-content-sha256": payloadHash, "x-amz-date": date, Authorization: authorization };
  if (config.sessionToken) requestHeaders["x-amz-security-token"] = config.sessionToken;
  return { url: "https://" + host + uri, headers: requestHeaders };
}
async function uploadToS3(key, filePath, config) {
  const fileStats = await stat(filePath);
  if (fileStats.size > 5 * 1024 * 1024 * 1024) throw new Error("Backup exceeds the 5 GB single-part S3 upload limit.");
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  const hashValue = digest.digest("hex");
  const date = new Date().toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  const signed = signedS3Request("PUT", key, hashValue, date, config);
  const response = await fetch(signed.url, { method: "PUT", headers: { ...signed.headers, "content-length": String(fileStats.size) }, body: createReadStream(filePath), duplex: "half" });
  if (!response.ok) throw new Error("S3 upload failed (" + response.status + ").");
  return { sizeBytes: fileStats.size, sha256: hashValue };
}

const databaseUrl = process.env.POSTGRES_URL_NON_POOLING || required("DATABASE_URL");
const appUrl = new URL(required("APP_URL"));
if (appUrl.protocol !== "https:" && appUrl.hostname !== "localhost") throw new Error("APP_URL must use HTTPS.");
const cronSecret = required("CRON_SECRET");
if (Buffer.byteLength(cronSecret) < 32) throw new Error("CRON_SECRET must contain at least 32 random bytes.");
const config = { region: required("AWS_REGION"), bucket: required("AWS_S3_BUCKET"), accessKey: required("AWS_ACCESS_KEY_ID"), secretKey: required("AWS_SECRET_ACCESS_KEY"), sessionToken: process.env.AWS_SESSION_TOKEN?.trim() };
const directory = await mkdtemp(path.join(tmpdir(), "stanbridge-backup-"));
const filename = "stanbridge-postgres-" + new Date().toISOString().replace(/[:.]/g, "-") + "-" + process.pid + ".dump";
const filePath = path.join(directory, filename);
try {
  const child = spawn(process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--no-owner", "--no-acl"], { env: postgresEnvironment(databaseUrl), stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  if (!child.stdout || !child.stderr) throw new Error("Could not open pg_dump streams.");
  let stderr = ""; child.stderr.setEncoding("utf8"); child.stderr.on("data", (chunk) => { stderr += chunk.slice(0, 4000); });
  const exit = new Promise((resolve, reject) => { child.once("error", reject); child.once("close", (code) => code === 0 ? resolve() : reject(new Error("pg_dump exited with code " + code + ": " + stderr))); });
  await Promise.all([pipeline(child.stdout, createWriteStream(filePath, { flags: "wx" })), exit]);
  const objectKey = "database/" + filename;
  const uploaded = await uploadToS3(objectKey, filePath, config);
  const registerUrl = new URL("/api/internal/backup", appUrl);
  const response = await fetch(registerUrl, { method: "POST", headers: { Authorization: "Bearer " + cronSecret, "Content-Type": "application/json" }, body: JSON.stringify({ filename, storageKey: objectKey, storageType: "S3", sizeBytes: uploaded.sizeBytes, sha256: uploaded.sha256 }), signal: AbortSignal.timeout(60000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Backup registration failed (" + response.status + "): " + (result.error || "unknown error"));
  console.log("Backup complete: " + filename + " · SHA-256 " + uploaded.sha256);
} finally {
  await rm(directory, { recursive: true, force: true });
}
