import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://iiestee30.vercel.app").replace(/\/+$/, "");

type Reason =
  | "enabled"
  | "not_configured"
  | "provider_disabled"
  | "redirect_not_allowed"
  | "unreachable"
  | "unknown";

const json = (payload: Record<string, unknown>) =>
  NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });

// Google OAuth has to be enabled in the Supabase dashboard before the button
// can work. Asking Supabase to start the flow here lets the UI tell the user
// what is missing instead of showing a broken button or a raw JSON error page.
export async function GET() {
  if (!supabaseUrl) {
    return json({ enabled: false, reason: "not_configured" as Reason });
  }

  try {
    const authorizeUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(`${siteUrl}/`)}`;
    const res = await fetch(authorizeUrl, {
      method: "GET",
      redirect: "manual",
      cache: "no-store",
      headers: { "User-Agent": "node/20 server" },
    });
    const location = res.headers.get("location") || "";
    const isRedirect = res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308;

    if (isRedirect && /accounts\.google\.com/.test(location)) {
      return json({ enabled: true, reason: "enabled" as Reason });
    }

    // Supabase answers 400 with a JSON body when the provider is switched off.
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      detail = "";
    }

    let reason: Reason = "unknown";
    if (/provider is not enabled|unsupported provider/i.test(detail)) {
      reason = "provider_disabled";
    } else if (/redirect_?to|site_?url|not allowed/i.test(detail) || /redirect_?to|not allowed/i.test(location)) {
      reason = "redirect_not_allowed";
    }

    return json({ enabled: false, reason, status: res.status, detail: detail.slice(0, 200) });
  } catch {
    return json({ enabled: false, reason: "unreachable" as Reason });
  }
}
