import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDriveAccessToken } from "@/lib/drive";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

// Vercel serverless functions reject request bodies larger than ~4.5 MB
// (FUNCTION_PAYLOAD_TOO_LARGE), so large files cannot be streamed through
// /api/upload. This endpoint instead starts a Google Drive *resumable upload
// session* and hands the session URI back to the browser, which then streams
// the file directly to Google — no request body ever passes through Vercel.

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

    const body = await req.json().catch(() => null);
    const rawName = typeof body?.fileName === "string" ? body.fileName : "";
    const size = Number(body?.size);
    const contentType = typeof body?.contentType === "string" && body.contentType.trim()
      ? body.contentType.trim()
      : "application/octet-stream";
    const purpose = body?.purpose ?? null;

    if (!rawName.trim()) {
      return NextResponse.json({ error: "File name is required." }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    // 100 MB limit (kept in sync with the client and /api/upload)
    if (size > 104857600) {
      return NextResponse.json({ error: "File exceeds the 100 MB limit." }, { status: 400 });
    }
    if (purpose !== null && purpose !== "syllabus" && purpose !== "assignment") {
      return NextResponse.json({ error: "Unsupported upload purpose." }, { status: 400 });
    }
    if ((purpose === "syllabus" || purpose === "assignment") && !rawName.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: `${purpose === "syllabus" ? "Syllabus" : "Assignment"} files must be PDF documents.` }, { status: 400 });
    }

    const driveToken = await getDriveAccessToken();

    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const metadata: Record<string, unknown> = { name: safeName, mimeType: contentType };
    if (driveFolderId) metadata.parents = [driveFolderId];

    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,mimeType",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${driveToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": contentType,
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const detail = await initRes.text().catch(() => "");
      console.error("Google Drive resumable session failed:", initRes.status, detail.slice(0, 500));
      return NextResponse.json({ error: `Google Drive session could not be started (${initRes.status}).` }, { status: 500 });
    }

    const uploadUrl = initRes.headers.get("location") || initRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      return NextResponse.json({ error: "Google Drive did not return an upload session. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ uploadUrl });
  } catch (err: any) {
    console.error("Upload session error:", err);
    return NextResponse.json({ error: err?.message || "Could not start the upload." }, { status: 500 });
  }
}
