// Opened from the verification link in the email. Marks the address as verified,
// then sends the user back to the app. Deploy with --no-verify-jwt (the link is opened
// from an email, so there is no session). Secrets: APP_URL.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const back = (result: "ok" | "failed") => Response.redirect(`${APP_URL}/?verify=${result}`, 302);

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token) || !APP_URL) return back("failed");

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: row } = await admin
    .from("verification_tokens")
    .select("id, target_id, expires_at, used_at")
    .eq("token_hash", await sha256Hex(token))
    .maybeSingle();
  if (!row || row.used_at || new Date(row.expires_at) < new Date()) return back("failed");

  const { error: updateErr } = await admin
    .from("monitored_targets")
    .update({ verified: true })
    .eq("id", row.target_id);
  if (updateErr) return back("failed");

  await admin.from("verification_tokens").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  return back("ok");
});
