import crypto from "crypto";

let cachedDriveToken: { token: string; expiresAt: number } | null = null;

/**
 * Two supported auth modes:
 * 1. OAuth refresh token (uploads count against the authorized Gmail account's
 *    storage — works with any personal folder, e.g. iiesteedownload@gmail.com).
 * 2. Service account JWT (works with Google Workspace Shared Drives only).
 * Mode 1 is preferred when configured.
 */
function isOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    && process.env.GOOGLE_OAUTH_CLIENT_ID
    && process.env.GOOGLE_OAUTH_CLIENT_SECRET
  );
}

async function getOAuthAccessToken(): Promise<string> {
  if (cachedDriveToken && Date.now() < cachedDriveToken.expiresAt - 60_000) {
    return cachedDriveToken.token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || "",
      refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || "",
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google Drive OAuth refresh failed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const expiresIn = Number(json.expires_in) || 3600;
  cachedDriveToken = { token: json.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return cachedDriveToken.token;
}

export function isDriveConfigured(): boolean {
  return isOAuthConfigured() || Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Mint (and cache) an OAuth access token for Google Drive access. */
export async function getDriveAccessToken(): Promise<string> {
  if (isOAuthConfigured()) {
    return getOAuthAccessToken();
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";

  if (!clientEmail || !rawKey) {
    const missing: string[] = [];
    if (!process.env.GOOGLE_OAUTH_CLIENT_ID) missing.push("GOOGLE_OAUTH_CLIENT_ID");
    if (!process.env.GOOGLE_OAUTH_CLIENT_SECRET) missing.push("GOOGLE_OAUTH_CLIENT_SECRET");
    if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) missing.push("GOOGLE_OAUTH_REFRESH_TOKEN");
    if (missing.length === 3) {
      missing.length = 0;
      missing.push("GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET", "GOOGLE_OAUTH_REFRESH_TOKEN");
      missing.push("(or alternatively GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY for a Shared Drive)");
    } else if (missing.length < 3) {
      missing.push("— one of the three GOOGLE_OAUTH_* variables is set but others are missing");
    }
    throw new Error(
      `Google Drive storage is not configured on the server. Missing environment variables: ${missing.join(", ")}. `
      + "Add them in Vercel → Settings → Environment Variables, then redeploy."
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = signer.sign(privateKey, "base64url");
  const assertion = `${header}.${claim}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw new Error(`Google Drive authentication failed (${tokenRes.status}). ${detail.slice(0, 200)}`);
  }

  const tokenJson = await tokenRes.json();
  const expiresIn = Number(tokenJson.expires_in) || 3600;
  cachedDriveToken = { token: tokenJson.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return cachedDriveToken.token;
}

/** Extract a Drive file id from any of the common Google Drive URL shapes. */
export function extractDriveFileId(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    if (parsed.hostname === "drive.google.com" || parsed.hostname === "docs.google.com") {
      // /file/d/<id>/..., /open?id=<id>, uc?export=download&id=<id>, /uc?id=<id>
      const pathMatch = parsed.pathname.match(/\/(?:file\/d|document\/d|drive\/folders)\/([a-zA-Z0-9_-]{10,})/);
      if (pathMatch) return pathMatch[1];
      const idParam = parsed.searchParams.get("id");
      if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) return idParam;
    }
  } catch {
    // not an absolute URL
  }
  return null;
}

/**
 * Fetch a Drive file's bytes (and optionally its real name) using the service
 * account, so files stay private and bypass Google's virus-scan interstitial.
 */
export async function fetchDriveFile(
  fileId: string
): Promise<{ buffer: Buffer; fileName: string | null; mimeType: string }> {
  const token = await getDriveAccessToken();

  const metaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true&fields=name,mimeType`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  let fileName: string | null = null;
  let mimeType = "application/octet-stream";
  if (metaRes.ok) {
    const meta = await metaRes.json();
    fileName = typeof meta.name === "string" ? meta.name : null;
    mimeType = typeof meta.mimeType === "string" ? meta.mimeType : mimeType;
  }

  const mediaRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!mediaRes.ok) {
    const detail = await mediaRes.text().catch(() => "");
    throw new Error(`Failed to retrieve file from Google Drive (${mediaRes.status}). ${detail.slice(0, 200)}`);
  }
  const buffer = Buffer.from(await mediaRes.arrayBuffer());
  return { buffer, fileName, mimeType };
}
