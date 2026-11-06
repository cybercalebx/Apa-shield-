import { useState } from "react";
import Icon from "./Icon.jsx";
import { checkLink } from "../lib/linkCheck.js";

const TONE_CLASS = { high: "notice-error", caution: "notice-info", clear: "notice-success" };
const LEVEL_LABEL = { high: "High risk", caution: "Caution" };

export default function LinkCheck() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(null);

  const run = (e) => {
    e.preventDefault();
    setResult(checkLink(value));
  };

  return (
    <section className="card">
      <div className="card-head">
        <h3>Check a link</h3>
      </div>
      <p className="muted small">
        Paste a link to see whether it has common warning signs. This check doesn't open the link. A clean result
        doesn't prove a link is safe, so be careful with links from messages you didn't expect.
      </p>
      <form className="form" noValidate onSubmit={run}>
        <label className="field">
          <span>Link</span>
          <input maxLength={2048} value={value} onChange={(e) => { setValue(e.target.value); setResult(null); }}
            placeholder="https://example.com" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </label>
        <button className="btn btn-primary" type="submit" disabled={!value.trim()}>Check link</button>
      </form>

      {result?.error && <div className="notice notice-error" role="alert">{result.error}</div>}

      {result && !result.error && (
        <div className="link-result" role="status">
          <div className={`notice ${TONE_CLASS[result.verdict]}`}>
            <Icon name={result.verdict === "clear" ? "check" : "alert"} size={18} />
            <span>
              <strong>{result.title}</strong>
              <span className="block small">Domain: <span className="mono">{result.host}</span></span>
            </span>
          </div>
          {result.findings.length > 0 && (
            <ul className="finding-list">
              {result.findings.map((f) => (
                <li key={f.text}>
                  <span className={`status ${f.level === "high" ? "status-fail" : "status-warning"}`}>
                    {LEVEL_LABEL[f.level]}
                  </span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
