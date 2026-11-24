import { NextRequest, NextResponse } from "next/server";
import { extractDriveFileId, fetchDriveFile } from "@/lib/drive";
import { createDownloadUrl, isR2Configured, isR2Url, r2KeyFromUrl } from "@/lib/r2";

const mimeMap: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
};

function detectExtension(headerBytes: Buffer, fileUrl: string): string {
  const head = headerBytes.toString("latin1");
  if (head.startsWith("%PDF")) return ".pdf";
  if (head.startsWith("PK\x03\x04") || fileUrl.includes(".docx")) return ".docx";
  if (fileUrl.includes(".pptx")) return ".pptx";
  if (fileUrl.includes(".xlsx")) return ".xlsx";
  if (head.startsWith("\x89PNG")) return ".png";
  if (head.startsWith("\xFF\xD8\xFF")) return ".jpg";
  return ".pdf"; // default fallback for documents
}

function buildFileResponse(
  arrayBuffer: ArrayBuffer,
  filename: string,
  contentType: string
): NextResponse {
  const cleanFilename = filename.replace(/["\r\n]/g, "_");
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Disposition": `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`,
      "Content-Type": contentType,
      "Content-Length": String(arrayBuffer.byteLength),
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    let filename = searchParams.get("name") || "";

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
    }

    // Cloudflare R2 objects: hand the browser a short-lived presigned URL so
    // the bytes come straight from Cloudflare instead of through this function.
    if (isR2Url(fileUrl)) {
      if (!isR2Configured()) {
        return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
      }
      const key = r2KeyFromUrl(fileUrl);
      if (!key) {
        return NextResponse.json({ error: "Missing file key" }, { status: 400 });
      }

      const storedName = (key.split("/").pop() || "document").replace(/^[0-9a-f-]{36}-/i, "");
      const downloadName = filename && filename.includes(".")
        ? filename
        : storedName.includes(".")
          ? storedName
          : `${filename || storedName}.pdf`;

      const ext = downloadName.split(".").pop()?.toLowerCase() || "";
      const contentType = mimeMap[ext] || null;
      const signedUrl = await createDownloadUrl(key, downloadName, contentType, 300);
      return NextResponse.redirect(signedUrl, 302);
    }

    let arrayBuffer: ArrayBuffer;
    let upstreamContentType: string | null = null;
    let upstreamName: string | null = null;

    // Google Drive files are private — stream them with the service account.
    const driveFileId = extractDriveFileId(fileUrl);
    if (driveFileId) {
      const drive = await fetchDriveFile(driveFileId);
      const copy = new ArrayBuffer(drive.buffer.byteLength);
      new Uint8Array(copy).set(drive.buffer);
      arrayBuffer = copy;
      upstreamContentType = drive.mimeType;
      upstreamName = drive.fileName;
    } else {
      // Non-Drive URLs (legacy Cloudinary uploads, direct links) — plain proxy.
      const upstreamRes = await fetch(fileUrl);
      if (!upstreamRes.ok) {
        return NextResponse.json(
          { error: "Failed to retrieve file from storage" },
          { status: upstreamRes.status }
        );
      }
      arrayBuffer = await upstreamRes.arrayBuffer();
      upstreamContentType = upstreamRes.headers.get("content-type");
    }

    // If filename wasn't provided or lacks extension, inspect magic bytes and URL
    if (!filename || !filename.includes(".")) {
      const headerBytes = Buffer.from(arrayBuffer.slice(0, 8));
      const detectedExt = detectExtension(headerBytes, fileUrl);

      if (!filename) {
        const urlParts = fileUrl.split("/");
        const lastPart = urlParts[urlParts.length - 1].split("?")[0];
        const strippedName = lastPart.replace(/^\d+_/, "");
        filename = (strippedName || "document") + detectedExt;
      } else {
        filename = filename + detectedExt;
      }
    }

    // Prefer the real content type from upstream when the extension is unknown
    let ext = filename.split(".").pop()?.toLowerCase() || "";
    let contentType = mimeMap[ext] || upstreamContentType || "application/octet-stream";
    // Never serve HTML for documents (Drive virus-scan pages, etc.)
    if (contentType === "text/html") contentType = mimeMap[ext] || "application/octet-stream";

    // Prefer the real Drive file name only when no usable name was supplied
    if (upstreamName && !filename) {
      filename = upstreamName;
    }
    if (upstreamName && !filename.includes(".")) {
      filename = upstreamName;
    }

    return buildFileResponse(arrayBuffer, filename, contentType);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Download failed" }, { status: 500 });
  }
}
