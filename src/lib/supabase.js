// Accounts and notification settings, stored in Supabase.
//
// Set these in a .env.local file (never commit real keys):
//   VITE_SUPABASE_URL=https://your-project.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-public-key
//
// Create the tables and security rules by running supabase/schema.sql in the
// Supabase SQL editor.

import { createClient } from "@supabase/supabase-js";

const env = import.meta.env ?? {};
const URL = env.VITE_SUPABASE_URL;
const ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(URL && ANON_KEY);

const REMEMBER_KEY = "apa-shield-remember";

// "Remember me" on: session kept in localStorage (survives closing the browser).
// "Remember me" off: session kept in sessionStorage (cleared when the tab closes).
function activeStore() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === "0" ? sessionStorage : localStorage;
  } catch {
    return null;
  }
}

const rememberStorage = {
  getItem(key) {
    try {
      return activeStore()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      activeStore()?.setItem(key, value);
    } catch {
      /* storage unavailable: the session simply isn't persisted */
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export const supabase = isConfigured
  ? createClient(URL, ANON_KEY, {
      auth: {
        storage: rememberStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

function client() {
  if (!supabase) throw new Error("Accounts aren't connected yet. Add the Supabase keys to your environment.");
  return supabase;
}

function setRemember(remember) {
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "1" : "0");
  } catch {
    /* ignore */
  }
}

const redirectUrl = () => `${window.location.origin}${window.location.pathname}`;

export function onAuthChange(callback) {
  const { data } = client().auth.onAuthStateChange((event, session) => callback(event, session));
  return () => data.subscription.unsubscribe();
}

export async function getSession() {
  const { data, error } = await client().auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signUp({ email, password }) {
  const { data, error } = await client().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectUrl() },
  });
  if (error) throw error;
  return data;
}

export async function signIn({ email, password, remember }) {
  setRemember(remember);
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() });
  if (error) throw error;
}

export async function setNewPassword(password) {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}

/** Loads this user's monitored addresses and alert preferences. */
export async function loadNotifySettings(userId) {
  const db = client();
  const [targets, prefs] = await Promise.all([
    db.from("monitored_targets").select("id, kind, value, verified, created_at").eq("user_id", userId).order("created_at"),
    db.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (targets.error) throw targets.error;
  if (prefs.error) throw prefs.error;
  return { targets: targets.data ?? [], prefs: prefs.data };
}

export async function addTarget({ userId, kind, value }) {
  const { data, error } = await client()
    .from("monitored_targets")
    .insert({ user_id: userId, kind, value: value.trim().toLowerCase(), verified: false })
    .select("id, kind, value, verified, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function removeTarget(id) {
  const { error } = await client().from("monitored_targets").delete().eq("id", id);
  if (error) throw error;
}

/** Saves preferences. Resolves only after the database confirms the write. */
export async function savePreferences({ userId, prefs }) {
  const { data, error } = await client()
    .from("notification_preferences")
    .upsert({ user_id: userId, ...prefs, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/* ---------- Account settings ---------- */

/** Saves the display name in the account's metadata. */
export async function updateDisplayName(name) {
  const { data, error } = await client().auth.updateUser({ data: { display_name: name } });
  if (error) throw error;
  return data.user;
}

/** Ends every session for this account, on all devices. */
export async function signOutEverywhere() {
  const { error } = await client().auth.signOut({ scope: "global" });
  if (error) throw error;
}

/**
 * Deletes the signed-in account and its data.
 * Uses the delete_own_account() database function (see supabase/migration-2.sql).
 */
export async function deleteOwnAccount() {
  const { error } = await client().rpc("delete_own_account");
  if (error) throw error;
  await client().auth.signOut({ scope: "local" }).catch(() => {});
}

/* ---------- Alert rules ---------- */

export async function loadAlertRules(userId) {
  const { data, error } = await client()
    .from("alert_rules")
    .select("id, target_id, rule_type, min_severity, enabled, created_at")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addAlertRule({ userId, targetId, ruleType, minSeverity }) {
  const { data, error } = await client()
    .from("alert_rules")
    .insert({ user_id: userId, target_id: targetId, rule_type: ruleType, min_severity: minSeverity, enabled: true })
    .select("id, target_id, rule_type, min_severity, enabled, created_at")
    .single();
  if (error) throw error;
  return data;
}

export async function setAlertRuleEnabled(id, enabled) {
  const { error } = await client().from("alert_rules").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function removeAlertRule(id) {
  const { error } = await client().from("alert_rules").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Email verification ---------- */

/** Asks the server to email a verification link to one of the user's addresses. */
export async function requestVerification(targetId) {
  const { data, error } = await client().functions.invoke("send-verification", {
    body: { target_id: targetId },
  });
  if (error) {
    let message = error.message;
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep the generic message */
    }
    throw new Error(message);
  }
  return data;
}
