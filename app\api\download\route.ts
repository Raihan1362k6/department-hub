import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    let filename = searchParams.get("name") || "";

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
    }

    // Fetch the file from storage
    const upstreamRes = await fetch(fileUrl);
    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: "Failed to retrieve file from storage" },
        { status: upstreamRes.status }
      );
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();

    // If filename wasn't provided or lacks extension, inspect magic bytes and URL
    if (!filename || !filename.includes(".")) {
      const headerBytes = Buffer.from(arrayBuffer.slice(0, 8)).toString();

      let detectedExt = "";
      if (headerBytes.startsWith("%PDF")) {
        detectedExt = ".pdf";
      } else if (headerBytes.startsWith("PK\x03\x04") || fileUrl.includes(".docx")) {
        detectedExt = ".docx";
      } else if (fileUrl.includes(".pptx")) {
        detectedExt = ".pptx";
      } else if (fileUrl.includes(".xlsx")) {
        detectedExt = ".xlsx";
      } else if (headerBytes.startsWith("\x89PNG")) {
        detectedExt = ".png";
      } else if (headerBytes.startsWith("\xFF\xD8\xFF")) {
        detectedExt = ".jpg";
      } else {
        detectedExt = ".pdf"; // default fallback for documents
      }

      if (!filename) {
        // Try extracting from URL
        const urlParts = fileUrl.split("/");
        const lastPart = urlParts[urlParts.length - 1].split("?")[0];
        const strippedName = lastPart.replace(/^\d+_/, "");
        filename = (strippedName || "document") + detectedExt;
      } else {
        filename = filename + detectedExt;
      }
    }

    // Determine MIME Content-Type
    const ext = filename.split(".").pop()?.toLowerCase() || "";
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
    const contentType = mimeMap[ext] || "application/octet-stream";

    const cleanFilename = filename.replace(/["\r\n]/g, "_");

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Disposition": `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`,
        "Content-Type": contentType,
        "Content-Length": String(arrayBuffer.byteLength),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Download failed" }, { status: 500 });
  }
}

