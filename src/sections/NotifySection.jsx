import { useEffect, useState } from "react";
import AuthPanel from "../components/AuthPanel.jsx";
import Icon from "../components/Icon.jsx";
import {
  addTarget,
  isConfigured,
  loadNotifySettings,
  removeTarget,
  requestVerification,
  savePreferences,
  signOut,
} from "../lib/supabase.js";
import { validateDomain, validateEmail } from "../lib/scan.js";

const DEFAULT_PREFS = {
  enabled: true,
  email_alerts: true,
  threat_alerts: true,
  scan_complete: true,
  security_updates: false,
};

const PREF_ROWS = [
  { key: "email_alerts", label: "Email alerts", desc: "Send alerts to your verified addresses." },
  { key: "threat_alerts", label: "Threat alerts", desc: "Tell me when a monitored address appears in a new breach." },
  { key: "scan_complete", label: "Scan completion", desc: "Notify me when a scan I started finishes." },
  { key: "security_updates", label: "Security updates", desc: "Occasional news about APA SHIELD and security advice." },
];

/** The four subscription states from the brief, derived from saved data only. */
export function subscriptionState(targets, prefs) {
  if (targets.length === 0) return "not_subscribed";
  if (prefs && prefs.enabled === false) return "disabled";
  if (targets.some((t) => t.verified)) return "active";
  return "pending";
}

const STATE_INFO = {
  not_subscribed: {
    tone: "grey",
    title: "Not subscribed",
    text: "Add an email address or domain below to start receiving alerts.",
  },
  pending: {
    tone: "amber",
    title: "Subscription pending",
    text: "Your address is saved but not verified yet, so no alerts will be sent. Verification emails aren't connected in this version.",
  },
  active: {
    tone: "green",
    title: "Subscription active",
    text: "You'll receive alerts for your verified addresses and domains.",
  },
  disabled: {
    tone: "red",
    title: "Notifications disabled",
    text: "Your addresses are saved, but all alerts are turned off. Turn them on in preferences.",
  },
};

export default function NotifySection({ session, recovering, onRecoveryDone, onGoHome }) {
  if (!isConfigured) {
    return (
      <section className="stack-lg">
        <div className="page-head">
          <h2>Notify Me</h2>
          <p className="muted">Get instant alerts when your email or domain shows up in a data breach.</p>
        </div>
        <div className="notice notice-info">
          <Icon name="lock" size={18} />
          <span>
            <strong>Accounts aren't connected yet.</strong> Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then run <code>supabase/schema.sql</code>{" "}
            in your Supabase project.
          </span>
        </div>
      </section>
    );
  }

  if (!session || recovering) {
    return (
      <section className="stack-lg">
        <div className="page-head">
          <h2>Notify Me</h2>
          <p className="muted">Get instant alerts on security threats, scan results and important security updates.</p>
        </div>
        <div className="signin-layout">
          <div className="card signin-intro">
            <h3>How it works</h3>
            <ol className="steps-list">
              <li>Create an account or sign in.</li>
              <li>Add the email addresses and domains you want to watch.</li>
              <li>Choose which alerts you want.</li>
            </ol>
            <p className="muted small">Your monitored addresses are only visible to you.</p>
          </div>
          <div className="card">
            <AuthPanel recovering={recovering} onRecoveryDone={onRecoveryDone} />
          </div>
        </div>
      </section>
    );
  }

  return <NotifyDashboard session={session} onGoHome={onGoHome} />;
}

function NotifyDashboard({ session, onGoHome }) {
  const userId = session.user.id;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [targets, setTargets] = useState([]);
  const [savedPrefs, setSavedPrefs] = useState(null);
  const [draft, setDraft] = useState(DEFAULT_PREFS);
  const [kind, setKind] = useState("email");
  const [value, setValue] = useState("");
  const [addError, setAddError] = useState("");
  const [addMessage, setAddMessage] = useState("");
  const [prefMessage, setPrefMessage] = useState("");
  const [prefError, setPrefError] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyError, setVerifyError] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadNotifySettings(userId)
      .then(({ targets: t, prefs }) => {
        if (cancelled) return;
        setTargets(t);
        const merged = prefs ? { ...DEFAULT_PREFS, ...prefs } : null;
        setSavedPrefs(merged);
        setDraft(merged ?? DEFAULT_PREFS);
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const state = subscriptionState(targets, savedPrefs);
  const info = STATE_INFO[state];
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedPrefs ?? DEFAULT_PREFS);

  const addMonitored = async (e) => {
    e.preventDefault();
    setAddError("");
    setAddMessage("");
    const v = value.trim();
    const ok = kind === "email" ? validateEmail(v) : validateDomain(v);
    if (!ok) {
      setAddError(kind === "email" ? "Enter a valid email address, e.g. you@company.com" : "Enter a valid domain, e.g. company.com");
      return;
    }
    try {
      const row = await addTarget({ userId, kind, value: v });
      setTargets((t) => [...t, row]);
      setValue("");
      setAddMessage(`${v} is saved. It stays pending until it's verified.`);
    } catch (err) {
      setAddError(
        err.code === "23505" ? "You're already monitoring that address." : err.message || "Couldn't save that address.",
      );
    }
  };

  const removeMonitored = async (id) => {
    try {
      await removeTarget(id);
      setTargets((t) => t.filter((x) => x.id !== id));
    } catch (err) {
      setAddError(err.message || "Couldn't remove that address.");
    }
  };

  const sendVerification = async (t) => {
    setVerifyingId(t.id);
    setVerifyMessage("");
    setVerifyError("");
    try {
      await requestVerification(t.id);
      setVerifyMessage(`Verification email sent to ${t.value}. Check your inbox and spam folder.`);
    } catch (err) {
      setVerifyError(err.message || "Couldn't send the verification email.");
    } finally {
      setVerifyingId(null);
    }
  };

  const save = async () => {
    setSaving(true);
    setPrefError("");
    setPrefMessage("");
    try {
      const row = await savePreferences({ userId, prefs: draft });
      const merged = { ...DEFAULT_PREFS, ...row };
      setSavedPrefs(merged);
      setDraft(merged);
      setPrefMessage("Preferences saved.");
    } catch (err) {
      setPrefError(`Preferences weren't saved: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key) => setDraft((d) => ({ ...d, [key]: !d[key] }));

  return (
    <section className="stack-lg">
      <div className="page-head">
        <h2>Notify Me</h2>
        <p className="muted small">Signed in as {session.user.email}</p>
      </div>

      {loadError && <div className="notice notice-error" role="alert">Couldn't load your settings: {loadError}</div>}

      <div className={`status-card tone-${info.tone}`} role="status">
        <span className="status-dot" aria-hidden="true" />
        <div>
          <strong>{info.title}</strong>
          <p>{info.text}</p>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Monitored addresses and domains</h3>
          <form className="form" noValidate onSubmit={addMonitored}>
            <div className="seg" role="group" aria-label="Type">
              <button type="button" className={kind === "email" ? "active" : ""} aria-pressed={kind === "email"} onClick={() => setKind("email")}>Email</button>
              <button type="button" className={kind === "domain" ? "active" : ""} aria-pressed={kind === "domain"} onClick={() => setKind("domain")}>Domain</button>
            </div>
            <label className="field">
              <span>{kind === "email" ? "Email address" : "Domain"}</span>
              <input maxLength={253} value={value} onChange={(e) => setValue(e.target.value)}
                placeholder={kind === "email" ? "you@company.com" : "company.com"} />
            </label>
            {addError && <div className="notice notice-error" role="alert">{addError}</div>}
            {addMessage && <div className="notice notice-success" role="status">{addMessage}</div>}
            <button type="submit" className="btn btn-primary btn-block">Add to monitoring</button>
          </form>

          {verifyError && <div className="notice notice-error" role="alert">{verifyError}</div>}
          {verifyMessage && <div className="notice notice-success" role="status">{verifyMessage}</div>}
          {loading ? (
            <p className="muted small">Loading…</p>
          ) : targets.length === 0 ? (
            <p className="muted small">Nothing is being monitored yet.</p>
          ) : (
            <ul className="list">
              {targets.map((t) => (
                <li key={t.id} className="list-row">
                  <div className="target">
                    <span className="mono wrap">{t.value}</span>
                    <span className="muted small">{t.kind === "email" ? "Email" : "Domain"}</span>
                  </div>
                  <div className="target-actions">
                    <span className={`status ${t.verified ? "status-pass" : "status-warning"}`}>
                      {t.verified ? "Verified" : "Pending"}
                    </span>
                    {t.kind === "email" && !t.verified && (
                      <button className="link" onClick={() => sendVerification(t)} disabled={verifyingId === t.id}>
                        {verifyingId === t.id ? "Sending…" : "Send verification email"}
                      </button>
                    )}
                    <button className="link" onClick={() => removeMonitored(t.id)}>Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3>Alert preferences</h3>
          <div className="toggle-list">
            <ToggleRow label="Notifications on" desc="Master switch for every alert." checked={draft.enabled} onChange={() => toggle("enabled")} />
            {PREF_ROWS.map((row) => (
              <ToggleRow key={row.key} label={row.label} desc={row.desc} checked={draft[row.key]}
                disabled={!draft.enabled} onChange={() => toggle(row.key)} />
            ))}
          </div>

          {prefError && <div className="notice notice-error" role="alert">{prefError}</div>}
          {prefMessage && !dirty && <div className="notice notice-success" role="status">{prefMessage}</div>}
          <button className="btn btn-primary btn-block" onClick={save} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </section>
      </div>

      <div className="signout-row">
        <button className="btn btn-outline" onClick={async () => { await signOut(); onGoHome(); }}>
          Sign out
        </button>
      </div>
    </section>
  );
}

function ToggleRow({ label, desc, checked, disabled, onChange }) {
  return (
    <label className={`toggle-row ${disabled ? "is-disabled" : ""}`}>
      <span>
        <span className="row-title">{label}</span>
        <span className="muted small block">{desc}</span>
      </span>
      <input maxLength={253} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={onChange} />
    </label>
  );
}
