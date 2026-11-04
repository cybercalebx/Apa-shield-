import { useState } from "react";
import {
  deleteOwnAccount,
  setNewPassword,
  signOutEverywhere,
  updateDisplayName,
} from "../lib/supabase.js";

const DELETE_WORD = "DELETE";

export default function SettingsSection({ session }) {
  return (
    <section className="stack-lg">
      <div className="page-head">
        <h2>Settings</h2>
        <p className="muted small">Signed in as {session.user.email}</p>
      </div>
      <div className="grid-2">
        <AccountInfo session={session} />
        <ChangePassword />
        <SignOutEverywhere />
        <DeleteAccount />
      </div>
    </section>
  );
}

function AccountInfo({ session }) {
  const saved = session.user.user_metadata?.display_name ?? "";
  const [name, setName] = useState(saved);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    const trimmed = name.trim();
    if (trimmed.length > 80) {
      setError("Display name must be 80 characters or fewer.");
      return;
    }
    setSaving(true);
    try {
      await updateDisplayName(trimmed);
      setMessage("Display name saved.");
    } catch (err) {
      setError(`Couldn't save your name: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h3>Account information</h3>
      <form className="form" onSubmit={save} noValidate>
        <label className="field">
          <span>Email</span>
          <input value={session.user.email ?? ""} readOnly />
        </label>
        <label className="field">
          <span>Display name</span>
          <input maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </label>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {message && <div className="notice notice-success" role="status">{message}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving || name.trim() === saved}>
          {saving ? "Saving…" : "Save name"}
        </button>
      </form>
    </section>
  );
}

function ChangePassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      await setNewPassword(password);
      setPassword("");
      setConfirm("");
      setMessage("Password changed.");
    } catch (err) {
      setError(`Couldn't change your password: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <h3>Change password</h3>
      <form className="form" onSubmit={save} noValidate>
        <label className="field">
          <span>New password</span>
          <input type="password" autoComplete="new-password" maxLength={128} value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </label>
        <label className="field">
          <span>Confirm new password</span>
          <input type="password" autoComplete="new-password" maxLength={128} value={confirm}
            onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {message && <div className="notice notice-success" role="status">{message}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={saving || !password || !confirm}>
          {saving ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

function SignOutEverywhere() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // On success, the auth listener in App clears the session and this page
  // switches to the sign-in prompt.
  const run = async () => {
    setError("");
    setBusy(true);
    try {
      await signOutEverywhere();
    } catch (err) {
      setError(`Couldn't sign out: ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h3>Sign out everywhere</h3>
      <p className="muted small">Ends your session on every device where you're signed in, including this one.</p>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      <button className="btn btn-outline btn-block" onClick={run} disabled={busy}>
        {busy ? "Signing out…" : "Sign out everywhere"}
      </button>
    </section>
  );
}

function DeleteAccount() {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (e) => {
    e.preventDefault();
    setError("");
    if (typed !== DELETE_WORD) {
      setError(`Type ${DELETE_WORD} to confirm.`);
      return;
    }
    setBusy(true);
    try {
      await deleteOwnAccount();
    } catch (err) {
      setError(`Couldn't delete your account: ${err.message}`);
      setBusy(false);
    }
  };

  return (
    <section className="card card-danger">
      <h3>Delete account</h3>
      <p className="muted small">
        This permanently deletes your account, monitored addresses, alert preferences and alert rules. It can't be undone.
      </p>
      <form className="form" onSubmit={run} noValidate>
        <label className="field">
          <span>Type {DELETE_WORD} to confirm</span>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        {error && <div className="notice notice-error" role="alert">{error}</div>}
        <button className="btn btn-danger btn-block" type="submit" disabled={busy || typed !== DELETE_WORD}>
          {busy ? "Deleting…" : "Delete account"}
        </button>
      </form>
    </section>
  );
}
