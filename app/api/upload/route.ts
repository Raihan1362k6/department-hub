import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getDriveAccessToken } from "@/lib/drive";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Supabase upload authorization is not configured." }, { status: 503 });
    }

    const accessToken = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!accessToken) {
      return NextResponse.json({ error: "Sign in as an admin or monitor to upload files." }, { status: 401 });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Your session is invalid or expired. Sign in again." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await authClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: "Could not verify upload permissions." }, { status: 500 });
    }
    const isProtectedAdmin = authData.user.email?.trim().toLowerCase() === "2026eeb061.raihan@students.iiests.ac.in";
    if (profile?.role !== "admin" && profile?.role !== "monitor" && !isProtectedAdmin) {
      return NextResponse.json({ error: "Only admins and monitors can upload files." }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const purpose = formData.get("purpose");

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (purpose !== null && purpose !== "syllabus" && purpose !== "assignment") {
      return NextResponse.json({ error: "Unsupported upload purpose." }, { status: 400 });
    }

    // 100 MB limit
    if (file.size > 104857600) {
      return NextResponse.json({ error: "File exceeds the 100 MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if ((purpose === "syllabus" || purpose === "assignment") && (
      !file.name.toLowerCase().endsWith(".pdf")
      || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")
      || buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    )) {
      return NextResponse.json({ error: `${purpose === "syllabus" ? "Syllabus" : "Assignment"} files must be valid PDF documents.` }, { status: 400 });
    }

    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const mimeType = file.type || "application/octet-stream";

    const driveToken = await getDriveAccessToken();

    const metadata: Record<string, unknown> = { name: originalName, mimeType };
    if (driveFolderId) metadata.parents = [driveFolderId];

    const boundary = `dept-hub-${crypto.randomUUID()}`;
    const multipartBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`
      ),
      buffer,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const uploadRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,size,mimeType",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${driveToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    if (!uploadRes.ok) {
      const detail = await uploadRes.text().catch(() => "");
      console.error("Google Drive upload failed:", uploadRes.status, detail.slice(0, 500));
      return NextResponse.json({ error: `Google Drive upload failed (${uploadRes.status}).` }, { status: 500 });
    }

    const driveFile = await uploadRes.json();
    const driveFileId = driveFile.id as string;

    // Store a stable Drive URL. Downloads are proxied through /api/download,
    // which streams the file with the service account (files stay private).
    const storedUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

    return NextResponse.json({
      url: storedUrl,
      previewUrl: `https://drive.google.com/file/d/${driveFileId}/preview`,
      publicId: driveFileId,
      fileName: file.name,
      size: file.size,
      contentType: file.type,
      resourceType: "raw",
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }
}
