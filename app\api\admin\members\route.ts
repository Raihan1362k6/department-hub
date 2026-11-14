import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const protectedAdminEmail = "2026eeb061.raihan@students.iiests.ac.in";

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  : null;

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function DELETE(request: NextRequest) {
  if (!supabaseUrl || !anonKey || !supabaseAdmin) {
    return NextResponse.json(
      { error: "Member removal is not configured. Set the server-only Supabase service role key." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") || "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) {
    return NextResponse.json({ error: "Sign in as an admin to remove a member." }, { status: 401 });
  }

  let body: { memberId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid member ID is required." }, { status: 400 });
  }

  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!isUuid(memberId)) {
    return NextResponse.json({ error: "A valid Supabase member ID is required." }, { status: 400 });
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return NextResponse.json({ error: "Your session is invalid or expired. Sign in again." }, { status: 401 });
  }

  const { data: requester, error: requesterError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (requesterError) {
    return NextResponse.json({ error: "Could not verify admin permissions." }, { status: 500 });
  }
  if (requester?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can remove members." }, { status: 403 });
  }
  if (memberId === authData.user.id) {
    return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });
  }

  const { data: target, error: targetError } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .eq("id", memberId)
    .maybeSingle();

  if (targetError) {
    return NextResponse.json({ error: "Could not find the selected member." }, { status: 500 });
  }
  if (!target) {
    return NextResponse.json({ error: "This member no longer exists." }, { status: 404 });
  }
  if (target.email.trim().toLowerCase() === protectedAdminEmail) {
    return NextResponse.json({ error: "This admin account cannot be removed." }, { status: 409 });
  }

  if (target.role === "admin") {
    const { count, error } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    if (error) {
      return NextResponse.json({ error: "Could not verify the department admin count." }, { status: 500 });
    }
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: "The last admin account cannot be removed." }, { status: 409 });
    }
  }

  const [announcements, assignments] = await Promise.all([
    supabaseAdmin.from("announcements").select("id", { count: "exact", head: true }).eq("author_id", memberId),
    supabaseAdmin.from("assignments").select("id", { count: "exact", head: true }).eq("author_id", memberId),
  ]);
  if (announcements.error || assignments.error) {
    return NextResponse.json({ error: "Could not check the member's authored records." }, { status: 500 });
  }
  if ((announcements.count ?? 0) > 0 || (assignments.count ?? 0) > 0) {
    return NextResponse.json(
      { error: "This member authored announcements or assignments. Reassign or delete those records before removing the account." },
      { status: 409 },
    );
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(memberId);
  if (deleteError) {
    const isConstraintError = deleteError.code === "23503" || /foreign key|constraint/i.test(deleteError.message);
    return NextResponse.json(
      { error: isConstraintError ? "Related records prevent this member from being removed." : deleteError.message },
      { status: isConstraintError ? 409 : 500 },
    );
  }

  return NextResponse.json({ success: true });
}
