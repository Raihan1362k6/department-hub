import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.SUPABASE_PUBLISHABLE_KEY
  || process.env.SUPABASE_ANON_KEY
  || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
const allowedDomain = (
  process.env.ALLOWED_EMAIL_DOMAIN
  || process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN
  || "students.iiests.ac.in"
).trim().toLowerCase();

const supabaseAdmin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  : null;

const isAlreadyRegisteredError = (error: { code?: string; message?: string; status?: number } | null) => {
  if (!error) return false;
  if (error.code === "email_exists" || error.code === "user_already_exists") return true;
  if (error.status === 409 || error.status === 422) return true;
  return /already\s+(been\s+)?registered|already\s+exists|user\s+already/i.test(error.message || "");
};

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAdmin) {
      return NextResponse.json(
        { error: "Account creation is not configured. Set the server-only Supabase service role key." },
        { status: 503 },
      );
    }

    const body = await req.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const rawName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
    const fullName = (rawName || "Student User").slice(0, 120);

    if (!email) {
      return NextResponse.json({ error: "Enter your college email address." }, { status: 400 });
    }
    if (!email.endsWith(`@${allowedDomain}`)) {
      return NextResponse.json(
        { error: "Only department of Electrical Engineering'30 IIEST Shibpur Can Register" },
        { status: 400 },
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Create the user directly with the service key and mark the email as
    // confirmed. Supabase's email delivery is not configured for this project,
    // so the default signup flow fails with "Error sending confirmation email".
    // This path never sends mail and the user can sign in immediately.
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (!createError) {
      return NextResponse.json({ ok: true, created: true });
    }

    if (!isAlreadyRegisteredError(createError)) {
      console.error("Signup failed:", createError.status, createError.code, createError.message);
      return NextResponse.json(
        { error: createError.message || "Unable to create the account right now." },
        { status: 500 },
      );
    }

    // The account may already exist from an earlier signup that failed while
    // sending the confirmation email. Activate those unconfirmed accounts
    // instead of leaving the student stuck.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (profileError) {
      console.error("Signup profile lookup failed:", profileError.message);
      return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
    }

    let existingUserId = profile?.id || null;

    if (!existingUserId) {
      // Fall back to scanning auth users when the profile row is missing.
      const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        console.error("Signup user lookup failed:", listError.message);
        return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
      }
      existingUserId = list?.users?.find((user) => user.email?.toLowerCase() === email)?.id || null;
    }

    if (!existingUserId) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in with your password." },
        { status: 409 },
      );
    }

    const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(existingUserId);
    if (getUserError || !existingUser?.user) {
      console.error("Signup user fetch failed:", getUserError?.message);
      return NextResponse.json({ error: "Unable to create the account right now." }, { status: 500 });
    }

    if (existingUser.user.email_confirmed_at) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in with your password." },
        { status: 409 },
      );
    }

    // Unconfirmed account: confirm it and apply the password just chosen.
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (updateError) {
      console.error("Signup activation failed:", updateError.status, updateError.message);
      return NextResponse.json(
        { error: updateError.message || "Unable to activate the account right now." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, activated: true });
  } catch (err: any) {
    console.error("Signup endpoint error:", err);
    return NextResponse.json({ error: err?.message || "Unable to create the account right now." }, { status: 500 });
  }
}
