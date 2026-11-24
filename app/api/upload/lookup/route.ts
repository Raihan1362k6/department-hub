import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDriveAccessToken } from "@/lib/drive";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

const driveFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "";

// Legacy endpoint from the Google Drive upload flow. Kept only so old clients
// get a clear response; new uploads confirm themselves directly with R2.
export const dynamic = "force-dynamic";

// Google Drive's resumable-upload session URI does not return a
// CORS-readable response to browser PUTs (the upload itself succeeds, but the
// JSON body with the new file id is unreadable from JS). The browser therefore
// confirms the finished upload through this endpoint by looking the file up
// server-side by its sanitized name and exact byte size.

export async function GET(req: NextRequest) {
  try {
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Supabase authorization is not configured." }, { status: 503 });
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

    const { searchParams } = new URL(req.url);
    const rawName = searchParams.get("name") || "";
    const size = Number(searchParams.get("size"));

    if (!rawName.trim() || !Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: "File name and size are required." }, { status: 400 });
    }

    // Same sanitization the upload session applied to the stored file name.
    const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const parentClause = driveFolderId ? ` and '${driveFolderId}' in parents` : "";
    const query = `name = '${safeName}' and trashed = false${parentClause}`;
    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,createdTime)&orderBy=createdTime desc&pageSize=10&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${await getDriveAccessToken()}` } }
    );

    if (!listRes.ok) {
      const detail = await listRes.text().catch(() => "");
      console.error("Drive lookup failed:", listRes.status, detail.slice(0, 300));
      return NextResponse.json({ error: `Could not verify the upload (${listRes.status}).` }, { status: 500 });
    }

    const list = await listRes.json().catch(() => null);
    const candidates: Array<{ id: string; size?: string }> = Array.isArray(list?.files) ? list.files : [];
    const match = candidates.find((f) => f.size === String(size));

    if (!match) {
      return NextResponse.json({ error: "The upload could not be verified. Please try again." }, { status: 404 });
    }

    return NextResponse.json({ fileId: match.id, fileName: safeName });
  } catch (err: any) {
    console.error("Upload lookup error:", err);
    return NextResponse.json({ error: err?.message || "Could not verify the upload." }, { status: 500 });
  }
}
