import "server-only";
import { createHash, createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

function awsConfig() {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKey = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !region || !accessKey || !secretKey) throw new Error("AWS S3 backup environment is incomplete.");
  return { bucket, region, accessKey, secretKey, sessionToken: process.env.AWS_SESSION_TOKEN?.trim() };
}
function hash(value: string | Buffer) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: string | Buffer, value: string) { return createHmac("sha256", key).update(value).digest(); }
function signedRequest(method: "GET" | "PUT", key: string, payloadHash: string, date: string) {
  const c = awsConfig();
  if (!key.startsWith("database/") || key.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(key)) throw new Error("Invalid backup object key.");
  const host = "s3." + c.region + ".amazonaws.com";
  const uri = "/" + c.bucket + "/" + key.split("/").map(encodeURIComponent).join("/");
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": date };
  if (c.sessionToken) headers["x-amz-security-token"] = c.sessionToken;
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((name) => name + ":" + headers[name].trim() + "\n").join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [method, uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const shortDate = date.slice(0, 8);
  const scope = shortDate + "/" + c.region + "/s3/aws4_request";
  const stringToSign = ["AWS4-HMAC-SHA256", date, scope, hash(canonicalRequest)].join("\n");
  const dateKey = hmac("AWS4" + c.secretKey, shortDate);
  const regionKey = hmac(dateKey, c.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = "AWS4-HMAC-SHA256 Credential=" + c.accessKey + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
  const requestHeaders: Record<string, string> = { "x-amz-content-sha256": payloadHash, "x-amz-date": date, Authorization: authorization };
  if (c.sessionToken) requestHeaders["x-amz-security-token"] = c.sessionToken;
  return { url: "https://" + host + uri, headers: requestHeaders };
}

export async function putFileInS3(key: string, filePath: string) {
  const fileStats = await stat(filePath);
  if (fileStats.size > 5 * 1024 * 1024 * 1024) throw new Error("Database dump exceeds the 5 GB single-part S3 upload limit.");
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  const payloadHash = digest.digest("hex");
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const signed = signedRequest("PUT", key, payloadHash, date);
  const response = await fetch(signed.url, { method: "PUT", headers: { ...signed.headers, "content-length": String(fileStats.size) }, body: createReadStream(filePath) as unknown as BodyInit, duplex: "half" } as RequestInit & { duplex: "half" });
  if (!response.ok) throw new Error("AWS S3 upload failed (" + response.status + ").");
  return { sizeBytes: fileStats.size, sha256: payloadHash };
}

export async function getS3Object(key: string) {
  const date = new Date().toISOString().replace(/[:-]|\\.\\d{3}/g, "");
  const signed = signedRequest("GET", key, hash(""), date);
  const response = await fetch(signed.url, { method: "GET", headers: signed.headers, cache: "no-store" });
  if (!response.ok) throw new Error("AWS S3 download failed (" + response.status + ").");
  return response;
}
