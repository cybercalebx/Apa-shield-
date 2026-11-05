// Sends a verification link to an email address the signed-in user is monitoring.
// Secrets (set with `supabase secrets set`): RESEND_API_KEY, FROM_EMAIL, ALLOWED_ORIGINS.
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const TOKEN_HOURS = 24;
const COOLDOWN_SECONDS = 60;

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED.includes(origin) ? origin : (ALLOWED[0] ?? "null"),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function base64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (!RESEND_API_KEY || !FROM_EMAIL) return json({ error: "Email sending isn't configured yet." }, 503, cors);

  // Identify the caller from their own session token.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Sign in first." }, 401, cors);
  const user = userData.user;

  let body: { target_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400, cors);
  }
  const targetId = typeof body.target_id === "string" ? body.target_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return json({ error: "Invalid address." }, 400, cors);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: target } = await admin
    .from("monitored_targets")
    .select("id, kind, value, verified")
    .eq("id", targetId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!target) return json({ error: "Address not found." }, 404, cors);
  if (target.kind !== "email") return json({ error: "Only email addresses are verified by link." }, 400, cors);
  if (target.verified) return json({ error: "This address is already verified." }, 400, cors);

  const since = new Date(Date.now() - COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await admin
    .from("verification_tokens")
    .select("id")
    .eq("target_id", targetId)
    .gt("created_at", since)
    .limit(1);
  if (recent && recent.length > 0) {
    return json({ error: "Please wait a minute before requesting another email." }, 429, cors);
  }

  // Only a hash is stored. The raw token exists only in the email link.
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const { error: insertErr } = await admin.from("verification_tokens").insert({
    user_id: user.id,
    target_id: targetId,
    token_hash: await sha256Hex(token),
    expires_at: new Date(Date.now() + TOKEN_HOURS * 3600 * 1000).toISOString(),
  });
  if (insertErr) return json({ error: "Couldn't start verification. Try again." }, 500, cors);

  const link = `${SUPABASE_URL}/functions/v1/verify-address?token=${encodeURIComponent(token)}`;
  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [target.value],
      subject: "Confirm your email for APA SHIELD alerts",
      html: `<p>Confirm this address to receive APA SHIELD breach alerts for <strong>${escapeHtml(target.value)}</strong>.</p>
<p><a href="${link}">Confirm my email</a></p>
<p>This link expires in ${TOKEN_HOURS} hours. If you didn't ask for this, you can ignore this email.</p>`,
      text: `Confirm this address to receive APA SHIELD breach alerts for ${target.value}.\n\n${link}\n\nThis link expires in ${TOKEN_HOURS} hours. If you didn't ask for this, ignore this email.`,
    }),
  });
  if (!sent.ok) return json({ error: "The email couldn't be sent. Try again later." }, 502, cors);

  return json({ sent: true }, 200, cors);
});
