import Icon from "./Icon.jsx";
import { isConfigured } from "../lib/supabase.js";

/** Shown in place of a signed-in page when there is no session. */
export default function SignInNeeded({ pageTitle, text, onSignIn }) {
  return (
    <section className="stack-lg">
      <div className="page-head">
        <h2>{pageTitle}</h2>
      </div>
      {!isConfigured ? (
        <div className="notice notice-info">
          <Icon name="lock" size={18} />
          <span>
            <strong>Accounts aren't connected yet.</strong> Add <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, then run the SQL files in{" "}
            <code>supabase/</code> in your Supabase project.
          </span>
        </div>
      ) : (
        <div className="card empty">
          <div className="empty-icon"><Icon name="lock" size={22} /></div>
          <h3>Sign in to continue</h3>
          <p className="muted">{text}</p>
          <button className="btn btn-primary" onClick={onSignIn}>Go to sign in</button>
        </div>
      )}
    </section>
  );
}
