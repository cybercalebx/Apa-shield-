import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import {
  addAlertRule,
  loadAlertRules,
  loadNotifySettings,
  removeAlertRule,
  sendTestAlert,
  setAlertRuleEnabled,
} from "../lib/supabase.js";

const RULE_FOR_KIND = {
  email: { type: "new_breach", label: "New breach found" },
  domain: { type: "dns_failure", label: "Domain security check fails" },
};

const SEVERITY = {
  any: "Any severity",
  high: "High and critical",
  critical: "Critical only",
};

export default function AlertsSection({ session }) {
  const userId = session.user.id;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [targets, setTargets] = useState([]);
  const [rules, setRules] = useState([]);
  const [targetId, setTargetId] = useState("");
  const [minSeverity, setMinSeverity] = useState("any");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testMessage, setTestMessage] = useState("");
  const [testError, setTestError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadNotifySettings(userId), loadAlertRules(userId)])
      .then(([settings, savedRules]) => {
        if (cancelled) return;
        setTargets(settings.targets);
        setRules(savedRules);
        if (settings.targets[0]) setTargetId(settings.targets[0].id);
      })
      .catch((err) => !cancelled && setLoadError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const targetById = (id) => targets.find((t) => t.id === id);
  const selected = targetById(targetId);
  const verifiedEmails = targets.filter((t) => t.kind === "email" && t.verified);

  const sendTest = async (t) => {
    setTestingId(t.id);
    setTestMessage("");
    setTestError("");
    try {
      await sendTestAlert(t.id);
      setTestMessage(`Test alert sent to ${t.value}. Check your inbox and spam folder.`);
    } catch (err) {
      setTestError(err.message || "Couldn't send the test alert.");
    } finally {
      setTestingId(null);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!selected) {
      setError("Choose an address or domain first.");
      return;
    }
    const rule = RULE_FOR_KIND[selected.kind];
    setBusy(true);
    try {
      const row = await addAlertRule({
        userId,
        targetId: selected.id,
        ruleType: rule.type,
        minSeverity,
      });
      setRules((r) => [...r, row]);
      setMessage(`Rule saved for ${selected.value}. Alerts aren't sent yet.`);
    } catch (err) {
      setError(
        err.code === "23505"
          ? "That rule already exists for this address or domain."
          : `Couldn't save the rule: ${err.message}`,
      );
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (rule) => {
    setError("");
    setMessage("");
    const next = !rule.enabled;
    try {
      await setAlertRuleEnabled(rule.id, next);
      setRules((rs) => rs.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)));
    } catch (err) {
      setError(`Couldn't update that rule: ${err.message}`);
    }
  };

  const remove = async (rule) => {
    setError("");
    setMessage("");
    try {
      await removeAlertRule(rule.id);
      setRules((rs) => rs.filter((r) => r.id !== rule.id));
    } catch (err) {
      setError(`Couldn't remove that rule: ${err.message}`);
    }
  };

  return (
    <section className="stack-lg">
      <div className="page-head">
        <h2>Alerts</h2>
        <p className="muted">Choose what should trigger an alert for each address or domain you monitor.</p>
      </div>

      <div className="notice notice-info" role="status">
        <Icon name="alert" size={18} />
        <span>
          <strong>Rules are saved, but alerts aren't sent yet.</strong> The alert service isn't connected in this
          version, so nothing will be emailed when a rule matches.
        </span>
      </div>

      {loadError && <div className="notice notice-error" role="alert">Couldn't load your alerts: {loadError}</div>}

      <div className="grid-2">
        <section className="card">
          <h3>Add an alert rule</h3>
          {loading ? (
            <p className="muted small">Loading…</p>
          ) : targets.length === 0 ? (
            <p className="muted small">
              You aren't monitoring anything yet. Add an email address or domain on the Notify Me page first.
            </p>
          ) : (
            <form className="form" onSubmit={add} noValidate>
              <label className="field">
                <span>Address or domain</span>
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>{t.value}</option>
                  ))}
                </select>
              </label>
              <div className="field">
                <span>Alert when</span>
                <p className="rule-label">{selected ? RULE_FOR_KIND[selected.kind].label : ""}</p>
              </div>
              <label className="field">
                <span>Minimum severity</span>
                <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value)}>
                  {Object.entries(SEVERITY).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              {error && <div className="notice notice-error" role="alert">{error}</div>}
              {message && <div className="notice notice-success" role="status">{message}</div>}
              <button className="btn btn-primary btn-block" type="submit" disabled={busy || !selected}>
                {busy ? "Saving…" : "Save alert rule"}
              </button>
            </form>
          )}
        </section>

        <section className="card">
          <h3>Your rules</h3>
          {!loading && rules.length === 0 && <p className="muted small">No alert rules saved yet.</p>}
          <ul className="list">
            {rules.map((rule) => {
              const t = targetById(rule.target_id);
              return (
                <li key={rule.id} className="list-row">
                  <div className="target">
                    <span className="mono wrap">{t ? t.value : "Removed address"}</span>
                    <span className="muted small">
                      {RULE_FOR_KIND[t?.kind ?? "email"].label} · {SEVERITY[rule.min_severity] ?? rule.min_severity}
                    </span>
                  </div>
                  <div className="target-actions">
                    <label className="check">
                      <input type="checkbox" checked={rule.enabled} onChange={() => toggle(rule)}
                        aria-label={`Rule enabled for ${t ? t.value : "this address"}`} />
                      <span className="small">{rule.enabled ? "On" : "Off"}</span>
                    </label>
                    <button className="link" onClick={() => remove(rule)}>Remove</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card">
        <h3>Send a test alert</h3>
        <p className="muted small">
          Sends a test email to a verified address so you can check delivery. It doesn't report a breach.
        </p>
        {testError && <div className="notice notice-error" role="alert">{testError}</div>}
        {testMessage && <div className="notice notice-success" role="status">{testMessage}</div>}
        {verifiedEmails.length === 0 ? (
          <p className="muted small">Verify an email address on Notify Me to send a test alert.</p>
        ) : (
          <ul className="list">
            {verifiedEmails.map((t) => (
              <li key={t.id} className="list-row">
                <span className="mono wrap">{t.value}</span>
                <button className="btn btn-outline" onClick={() => sendTest(t)} disabled={testingId === t.id}>
                  {testingId === t.id ? "Sending…" : "Send test alert"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
