import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function getResourceType(mimeType: string): "image" | "video" | "raw" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/") || mimeType.startsWith("audio/")) return "video";
  return "raw";
}

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
    if (purpose !== null && purpose !== "syllabus") {
      return NextResponse.json({ error: "Unsupported upload purpose." }, { status: 400 });
    }

    // 100 MB limit
    if (file.size > 104857600) {
      return NextResponse.json({ error: "File exceeds the 100 MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (purpose === "syllabus" && (
      !file.name.toLowerCase().endsWith(".pdf")
      || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")
      || buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    )) {
      return NextResponse.json({ error: "Syllabus files must be valid PDF documents." }, { status: 400 });
    }

    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const resourceType = getResourceType(file.type);

    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "department-hub",
          public_id: `${Date.now()}_${originalName.replace(/\.[^.]+$/, "")}`,
          resource_type: resourceType,
          use_filename: true,
          unique_filename: false,
          overwrite: false,
        },
        (error, result) => {
          if (error) return reject(new Error(error.message || "Cloudinary upload failed."));
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // For non-image files, produce a download URL with fl_attachment
    const downloadUrl =
      resourceType === "raw"
        ? cloudinary.url(result.public_id, {
            resource_type: "raw",
            flags: "attachment",
            sign_url: false,
          })
        : result.secure_url;

    return NextResponse.json({
      url: downloadUrl,
      previewUrl: result.secure_url,
      publicId: result.public_id,
      fileName: file.name,
      size: file.size,
      contentType: file.type,
      resourceType,
    });
  } catch (err: any) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: err?.message || "Upload failed." }, { status: 500 });
  }
}
