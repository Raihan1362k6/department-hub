import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildObjectKey, isR2Configured, putObject, r2UrlFor } from "@/lib/r2";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

// Small-file fallback upload. Files above ~4 MB take the presigned-URL path in
// /api/upload/init so the body never passes through Vercel.
export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !anonKey) {
      return NextResponse.json({ error: "Supabase upload authorization is not configured." }, { status: 503 });
    }
    if (!isR2Configured()) {
      return NextResponse.json({ error: "File storage is not configured." }, { status: 503 });
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

    const mimeType = file.type || "application/octet-stream";
    const key = buildObjectKey(file.name, purpose === "syllabus" || purpose === "assignment" ? purpose : null);

    await putObject(key, buffer, mimeType);

    // Only the object key is stored in the database. Downloads are proxied
    // through /api/download, which redirects to a short-lived presigned URL so
    // the bucket itself stays private.
    return NextResponse.json({
      url: r2UrlFor(key),
      publicId: key,
      fileName: file.name,
      size: file.size,
      contentType: mimeType,
      resourceType: "raw",
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }
}
