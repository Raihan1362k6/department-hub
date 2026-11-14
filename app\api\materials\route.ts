import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || anonKey;

const supabaseAdmin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

const dataFilePath = path.join(process.cwd(), "data", "materials.json");

async function authorizeStaff(req: NextRequest): Promise<{ userId: string } | { response: NextResponse }> {
  if (!supabaseUrl || !anonKey) {
    return {
      response: NextResponse.json({ error: "Staff changes require Supabase authentication to be configured." }, { status: 503 }),
    };
  }

  const accessToken = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return { response: NextResponse.json({ error: "Sign in as an admin or monitor to make changes." }, { status: 401 }) };
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return { response: NextResponse.json({ error: "Your session is invalid or expired. Sign in again." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await authClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();
  if (profileError) {
    return { response: NextResponse.json({ error: "Could not verify staff permissions." }, { status: 500 }) };
  }
  if (profile?.role !== "admin" && profile?.role !== "monitor") {
    return { response: NextResponse.json({ error: "Only admins and monitors can make these changes." }, { status: 403 }) };
  }

  return { userId: authData.user.id };
}

function ensureDataFile() {
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(dataFilePath)) {
    fs.writeFileSync(dataFilePath, JSON.stringify([], null, 2), "utf8");
  }
}

function readLocalMaterials(): any[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(dataFilePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeLocalMaterials(items: any[]) {
  ensureDataFile();
  fs.writeFileSync(dataFilePath, JSON.stringify(items, null, 2), "utf8");
}

export async function GET() {
  try {
    if (supabaseAdmin) {
      try {
        const { data, error } = await supabaseAdmin
          .from("materials")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && Array.isArray(data)) {
          return NextResponse.json({ materials: data });
        }
      } catch {
        // Fall back to local file if supabase materials table not migrated
      }
    }

    const localMaterials = readLocalMaterials();
    return NextResponse.json({ materials: localMaterials });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to load materials" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authorization = await authorizeStaff(req);
    if ("response" in authorization) return authorization.response;

    const item = await req.json();
    if (!item.title || !item.url) {
      return NextResponse.json({ error: "Title and URL are required" }, { status: 400 });
    }
    item.uploader_id = authorization.userId;

    // Try inserting into Supabase if available
    if (supabaseAdmin) {
      try {
        await supabaseAdmin.from("materials").insert({
          id: item.id,
          title: item.title,
          semester: item.semester,
          subject: item.subject,
          course_name: item.course_name || item.subject,
          category: item.category,
          kind: item.kind,
          url: item.url,
          uploader_id: item.uploader_id,
          created_at: item.created_at || new Date().toISOString(),
        });
      } catch {
        // Table not present yet in Supabase, continuing with file store
      }
    }

    // Persist to local JSON file so all clients see it
    const list = readLocalMaterials();
    const filtered = list.filter((m) => m.id !== item.id);
    filtered.unshift(item);
    writeLocalMaterials(filtered);

    return NextResponse.json({ success: true, material: item });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save material" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authorization = await authorizeStaff(req);
    if ("response" in authorization) return authorization.response;

    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid course rename request is required" }, { status: 400 });
    }

    const semester = Number(body.semester);
    const currentSubject = typeof body.currentSubject === "string" ? body.currentSubject.trim() : "";
    const nextSubject = typeof body.nextSubject === "string" ? body.nextSubject.trim().replace(/\s+/g, " ") : "";

    if (!Number.isInteger(semester) || semester < 1 || semester > 8 || !currentSubject || !nextSubject) {
      return NextResponse.json({ error: "Semester and both course names are required" }, { status: 400 });
    }

    const materials = readLocalMaterials();
    const updatedMaterials = materials.map((material) => (
      material.semester === semester && material.subject === currentSubject
        ? { ...material, subject: nextSubject, course_name: nextSubject }
        : material
    ));

    writeLocalMaterials(updatedMaterials);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to rename course materials" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authorization = await authorizeStaff(req);
    if ("response" in authorization) return authorization.response;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const semester = searchParams.get("semester");
    const subject = searchParams.get("subject");

    if (supabaseAdmin) {
      try {
        if (id) {
          await supabaseAdmin.from("materials").delete().eq("id", id);
        } else if (semester && subject) {
          await supabaseAdmin.from("materials").delete().eq("semester", Number(semester)).eq("subject", subject);
        }
      } catch {
        // Supabase table not created yet
      }
    }

    const list = readLocalMaterials();
    const updated = list.filter((m) => {
      if (id && m.id === id) return false;
      if (semester && subject && m.semester === Number(semester) && m.subject === subject) return false;
      return true;
    });
    writeLocalMaterials(updated);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete material" }, { status: 500 });
  }
}

