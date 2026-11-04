import { useState } from "react";
import Icon from "./Icon.jsx";
import { requestPasswordReset, setNewPassword, signIn, signUp } from "../lib/supabase.js";

const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

const TABS = [
  { id: "signin", label: "Sign in" },
  { id: "register", label: "Create account" },
];

/** Sign in, create account, forgot password, or set a new password after a reset link. */
export default function AuthPanel({ recovering = false, onRecoveryDone }) {
  const [mode, setMode] = useState(recovering ? "recovery" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setMessage("");
    setPassword("");
    setConfirm("");
  };

  const fail = (text) => {
    setError(text);
    setMessage("");
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (mode !== "recovery" && !validEmail(email.trim())) {
      return fail("Enter a valid email address, e.g. you@company.com");
    }
    if (mode === "signin" && !password) return fail("Enter your password.");
    if (mode === "register") {
      if (password.length < 8) return fail("Use at least 8 characters for your password.");
      if (password !== confirm) return fail("The passwords don't match.");
    }
    if (mode === "recovery") {
      if (password.length < 8) return fail("Use at least 8 characters for your new password.");
      if (password !== confirm) return fail("The passwords don't match.");
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn({ email: email.trim(), password, remember });
      } else if (mode === "register") {
        await signUp({ email: email.trim(), password });
        switchMode("signin");
        setMessage("Account created. Check your email to confirm it, then sign in.");
        setMessage("Account created. Check your email to confirm it, then sign in.");
      } else if (mode === "forgot") {
        await requestPasswordReset(email.trim());
        setMessage("If an account exists for that email, a reset link is on its way.");
      } else if (mode === "recovery") {
        await setNewPassword(password);
        setMessage("Password updated. You're signed in.");
        onRecoveryDone?.();
      }
    } catch (err) {
      fail(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const showTabs = mode === "signin" || mode === "register";

  return (
    <div className="auth">
      {showTabs && (
        <div className="auth-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={mode === t.id}
              className={mode === t.id ? "active" : ""}
              onClick={() => switchMode(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="auth-head">
        <h3>
          {mode === "signin" && "Sign in to Notify Me"}
          {mode === "register" && "Create your account"}
          {mode === "forgot" && "Reset your password"}
          {mode === "recovery" && "Choose a new password"}
        </h3>
        <p className="muted small">
          {mode === "signin" && "Sign in to connect your email and domains for alerts."}
          {mode === "register" && "Create an account to start receiving security alerts."}
          {mode === "forgot" && "Enter your account email and we'll send a reset link."}
          {mode === "recovery" && "Enter a new password for your account."}
        </p>
      </div>

      <form className="form" noValidate onSubmit={submit}>
        {mode !== "recovery" && (
          <label className="field">
            <span>Email address</span>
            <input maxLength={254} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" placeholder="you@company.com" disabled={busy} />
          </label>
        )}

        {(mode === "signin" || mode === "register" || mode === "recovery") && (
          <label className="field">
            <span>{mode === "recovery" ? "New password" : "Password"}</span>
            <span className="input-wrap">
              <input maxLength={253}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                placeholder={mode === "register" || mode === "recovery" ? "At least 8 characters" : ""}
                disabled={busy}
              />
              <button type="button" className="toggle-pw" onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? "Hide" : "Show"}
              </button>
            </span>
          </label>
        )}

        {(mode === "register" || mode === "recovery") && (
          <label className="field">
            <span>Confirm password</span>
            <input maxLength={253}
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              disabled={busy}
            />
          </label>
        )}

        {mode === "signin" && (
          <div className="auth-row">
            <label className="check">
              <input maxLength={253} type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <button type="button" className="link" onClick={() => switchMode("forgot")}>Forgot password?</button>
          </div>
        )}

        {mode === "forgot" && (
          <button type="button" className="link align-start" onClick={() => switchMode("signin")}>
            <Icon name="arrow" size={14} /> Back to sign in
          </button>
        )}

        {error && <div className="notice notice-error" role="alert">{error}</div>}
        {message && <div className="notice notice-success" role="status">{message}</div>}

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy && "Please wait…"}
          {!busy && mode === "signin" && "Sign in"}
          {!busy && mode === "register" && "Create account"}
          {!busy && mode === "forgot" && "Send reset link"}
          {!busy && mode === "recovery" && "Save new password"}
        </button>
      </form>
    </div>
  );
}
