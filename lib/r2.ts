import crypto from "crypto";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 storage. Files live in one private bucket and are only ever
// reachable through short-lived presigned URLs, so nothing is public and no
// long-lived token is ever handed to the browser.

const accountId = (process.env.R2_ACCOUNT_ID || "").trim();
const accessKeyId = (process.env.R2_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || "").trim();

export const R2_BUCKET = (process.env.R2_BUCKET || "").trim();
export const R2_PREFIX = "r2://";

let cachedClient: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && R2_BUCKET);
}

function getClient(): S3Client {
  if (!isR2Configured()) {
    throw new Error("File storage is not configured.");
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return cachedClient;
}

export function isR2Url(value: string): boolean {
  return value.startsWith(R2_PREFIX);
}

export function r2UrlFor(key: string): string {
  return `${R2_PREFIX}${key}`;
}

export function r2KeyFromUrl(value: string): string {
  return value.slice(R2_PREFIX.length);
}

/** Builds a collision-free object key grouped by purpose and month. */
export function buildObjectKey(fileName: string, purpose?: string | null): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "file";
  const folder =
    purpose === "syllabus" ? "syllabus" : purpose === "assignment" ? "assignments" : "materials";
  const month = new Date().toISOString().slice(0, 7);
  return `${folder}/${month}/${crypto.randomUUID()}-${safeName}`;
}

/** Presigned PUT URL for a direct browser -> R2 upload. */
export async function createUploadUrl(
  key: string,
  contentType: string,
  expiresIn = 900
): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}

/** Presigned GET URL. The browser downloads straight from Cloudflare. */
export async function createDownloadUrl(
  key: string,
  fileName: string,
  contentType?: string | null,
  expiresIn = 300
): Promise<string> {
  const cleanName = (fileName || key.split("/").pop() || "document").replace(/["\r\n]/g, "_");
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${cleanName}"; filename*=UTF-8''${encodeURIComponent(cleanName)}`,
      ...(contentType ? { ResponseContentType: contentType } : {}),
    }),
    { expiresIn }
  );
}

/** Server-side upload, used for small files that arrive as multipart form data. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await getClient().send(
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
