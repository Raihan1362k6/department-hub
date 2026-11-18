import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://iiestee30.vercel.app").replace(/\/+$/, "");

// Google OAuth has to be enabled in the Supabase dashboard before the button
// can work. Asking Google to start the flow here lets the UI know whether the
// provider is live without ever showing a broken button.
export async function GET() {
  if (!supabaseUrl) {
    return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
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
    const redirectedToGoogle = (res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308)
      && /accounts\.google\.com/.test(location);

    return NextResponse.json(
      { enabled: redirectedToGoogle },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
