// Sends an alert email to a verified address the signed-in user monitors.
// For now it only sends test alerts. Real breach alerts will call the same logic once a data source is connected.
// Secrets (set with `supabase secrets set`): RESEND_API_KEY, FROM_EMAIL, ALLOWED_ORIGINS.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "";
const ALLOWED = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

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
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  const cors = corsFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);
  if (!RESEND_API_KEY || !FROM_EMAIL) return json({ error: "Email sending isn't configured yet." }, 503, cors);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return json({ error: "Sign in first." }, 401, cors);
  const user = userData.user;

  let body: { target_id?: unknown; kind?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400, cors);
  }
  const targetId = typeof body.target_id === "string" ? body.target_id : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return json({ error: "Invalid address." }, 400, cors);
  }
  if (body.kind !== "test") return json({ error: "Only test alerts can be sent right now." }, 400, cors);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: target } = await admin
    .from("monitored_targets")
    .select("id, kind, value, verified")
    .eq("id", targetId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!target) return json({ error: "Address not found." }, 404, cors);
  if (target.kind !== "email") return json({ error: "Test alerts go to email addresses." }, 400, cors);
  if (!target.verified) return json({ error: "Verify this address before sending alerts to it." }, 400, cors);

  // Respect the user's notification preferences. No saved row means the defaults apply (alerts on).
  const { data: prefs } = await admin
    .from("notification_preferences")
    .select("enabled, email_alerts")
    .eq("user_id", user.id)
    .maybeSingle();
  if (prefs && (prefs.enabled === false || prefs.email_alerts === false)) {
    return json({ error: "Email alerts are turned off in your preferences." }, 400, cors);
  }

  const sent = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [target.value],
      subject: "APA SHIELD test alert",
      html: `<p>This is a <strong>test alert</strong> from APA SHIELD for <strong>${escapeHtml(target.value)}</strong>.</p>
<p>It confirms that alert emails can reach this address. No breach was found in this message.</p>`,
      text: `This is a test alert from APA SHIELD for ${target.value}.\n\nIt confirms that alert emails can reach this address. No breach was found in this message.`,
    }),
  });
  if (!sent.ok) return json({ error: "The alert couldn't be sent. Try again later." }, 502, cors);

  return json({ sent: true }, 200, cors);
});
