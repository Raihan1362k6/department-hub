import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildObjectKey, createUploadUrl, isR2Configured, r2UrlFor } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

// Vercel serverless functions reject request bodies larger than ~4.5 MB
// (FUNCTION_PAYLOAD_TOO_LARGE), so large files cannot be streamed through
// /api/upload. This endpoint instead returns a presigned PUT URL and the
// browser streams the file straight to Cloudflare R2 — no request body ever
// passes through Vercel.

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

    if (!isR2Configured()) {
      return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
    }

    const key = buildObjectKey(rawName, purpose);
    const uploadUrl = await createUploadUrl(key, contentType);

    return NextResponse.json({ uploadUrl, key, url: r2UrlFor(key), method: "PUT", contentType });
  } catch (err: any) {
    console.error("Upload session error:", err);
    return NextResponse.json({ error: err?.message || "Could not start the upload." }, { status: 500 });
  }
}
