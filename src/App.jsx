import { useEffect, useState } from "react";
import Icon from "./components/Icon.jsx";
import { LOGO_SRC } from "./logo.js";
import NotifySection from "./sections/NotifySection.jsx";
import AlertsSection from "./sections/AlertsSection.jsx";
import SettingsSection from "./sections/SettingsSection.jsx";
import HelpSection from "./sections/HelpSection.jsx";
import SignInNeeded from "./components/SignInNeeded.jsx";
import { getSession, isConfigured, onAuthChange } from "./lib/supabase.js";
import {
  TONE,
  TYPE_LABEL,
  checkSplit,
  runDemoScan,
  scoreStatus,
  toCsv,
  validateDomain,
  validateEmail,
} from "./lib/scan.js";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "scan", label: "Scan", icon: "scan" },
  { id: "reports", label: "Reports", icon: "chart" },
  { id: "alerts", label: "Alerts", icon: "bell" },
  { id: "notifications", label: "Notifications", icon: "send" },
  { id: "settings", label: "Settings", icon: "gear" },
  { id: "help", label: "Help & Support", icon: "help" },
];

const SCAN_MODES = [
  { id: "email", icon: "mail", label: "Email Scan", desc: "Check whether an email appeared in a data breach" },
  { id: "domain", icon: "globe", label: "Domain Scan", desc: "Audit SPF, DKIM, DMARC, SSL and DNSSEC" },
  { id: "both", icon: "shield", label: "Full Scan", desc: "Email breach check plus full domain audit" },
];

const formatWhen = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Lagos",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ---------- Shared pieces ---------- */

function Badge({ priority }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}

function StatusPill({ status }) {
  const label = status === "pass" ? "Pass" : status === "warning" ? "Warning" : "Fail";
  return <span className={`status status-${status}`}>{label}</span>;
}

function Gauge({ score }) {
  const r = 54;
  const C = 2 * Math.PI * r;
  const color = TONE[scoreStatus(score).key];
  return (
    <div className="gauge">
      <svg viewBox="0 0 140 140" aria-hidden="true">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#ECEAF5" strokeWidth="10" />
        <circle
          cx="70" cy="70" r={r} fill="none" strokeWidth="10" strokeLinecap="round"
          style={{ stroke: color }}
          strokeDasharray={`${(score / 100) * C} ${C}`}
          transform="rotate(-90 70 70)"
        />
      </svg>
      <div className="gauge-center">
        <strong style={{ color }}>{score}</strong>
        <span>/ 100</span>
      </div>
    </div>
  );
}

function Donut({ split, score }) {
  const r = 58;
  const C = 2 * Math.PI * r;
  let offset = 0;
  const segments = split
    ? [
        [split.secure, TONE.green],
        [split.risk, TONE.amber],
        [split.critical, TONE.red],
      ]
    : [];
  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" aria-hidden="true">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#ECEAF5" strokeWidth="16" />
        {segments.map(([pct, color], i) => {
          const len = (pct / 100) * C;
          const el = (
            <circle
              key={i}
              cx="80" cy="80" r={r} fill="none" strokeWidth="16"
              style={{ stroke: color }}
              strokeDasharray={`${len} ${C}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 80 80)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="donut-center">
        <strong>{score ?? "—"}</strong>
        <span>{score == null ? "No scans" : "Score"}</span>
      </div>
    </div>
  );
}

function Sparkline({ values }) {
  if (values.length < 2) {
    return <p className="muted small">Run two or more scans to see your score history.</p>;
  }
  const w = 300, h = 90, pad = 8;
  const min = Math.min(...values) - 5;
  const max = Math.max(...values) + 5;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
    return [x, y];
  });
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Security score history">
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none" stroke={TONE.blue} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="4" fill="#fff" stroke={TONE.blue} strokeWidth="2" />
      ))}
    </svg>
  );
}

function EmptyState({ icon, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={22} /></div>
      <strong>{title}</strong>
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

/* ---------- Scan results ---------- */

function BreachList({ breaches, email }) {
  const [open, setOpen] = useState(null);
  if (breaches.length === 0) {
    return (
      <EmptyState
        icon="check"
        title="No breaches found"
        text={`${email} wasn't found in the breach sources checked (simulated).`}
      />
    );
  }
  return (
    <ul className="list">
      {breaches.map((b, i) => (
        <li key={b.breach}>
          <button className="list-row list-button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>
            <div>
              <div className="row-title">{b.breach}</div>
              <div className="muted small">{b.date}</div>
            </div>
            <Badge priority={b.severity} />
          </button>
          {open === i && (
            <p className="callout">
              <strong>Action required:</strong> reset this password immediately, check whether it was reused elsewhere,
              and turn on MFA.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

function ScanResult({ record }) {
  const st = scoreStatus(record.score);
  const urgent = record.recommendations.filter((r) => r.priority === "critical" || r.priority === "high").length;
  const passed = record.domainChecks
    ? Object.values(record.domainChecks).filter((c) => c.status === "pass").length
    : null;
  return (
    <div className="stack">
      <div className="summary-grid">
        <div className="summary-card" style={{ borderTopColor: TONE[st.key] }}>
          <span className="label">Security score</span>
          <strong style={{ color: TONE[st.key] }}>{record.score}/100</strong>
          <span className="muted small">{st.label}</span>
        </div>
        {record.breaches && (
          <div className="summary-card" style={{ borderTopColor: record.breaches.length ? TONE.red : TONE.green }}>
            <span className="label">Breaches found</span>
            <strong style={{ color: record.breaches.length ? TONE.red : TONE.green }}>{record.breaches.length}</strong>
            <span className="muted small wrap">{record.email}</span>
          </div>
        )}
        {passed !== null && (
          <div className="summary-card" style={{ borderTopColor: TONE.blue }}>
            <span className="label">Domain checks passed</span>
            <strong style={{ color: TONE.blue }}>{passed}/5</strong>
            <span className="muted small wrap">{record.domain}</span>
          </div>
        )}
        <div className="summary-card" style={{ borderTopColor: TONE.amber }}>
          <span className="label">Urgent actions</span>
          <strong style={{ color: TONE.amber }}>{urgent}</strong>
          <span className="muted small">critical or high priority</span>
        </div>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Overall score</h3>
          <Gauge score={record.score} />
          <p className="muted small center">
            {record.type === "email" && `Based on breach exposure for ${record.email}`}
            {record.type === "domain" && `Based on domain security checks for ${record.domain}`}
            {record.type === "both" && `Full scan of ${record.email} and ${record.domain}`}
          </p>
        </section>

        <section className="card">
          <h3>Checks</h3>
          <ul className="list">
            {record.checks.map((c) => (
              <li key={c.label} className="list-row">
                <span className="row-title">{c.label}</span>
                <StatusPill status={c.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      {record.breaches && (
        <section className="card">
          <h3>Breach details</h3>
          <BreachList breaches={record.breaches} email={record.email} />
        </section>
      )}

      <section className="card">
        <h3>Recommendations</h3>
        <ul className="list">
          {record.recommendations.map((r) => (
            <li key={r.title} className="list-row rec">
              <div>
                <div className="rec-head">
                  <span className="row-title">{r.title}</span>
                  <Badge priority={r.priority} />
                </div>
                <div className="muted small">{r.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Pages ---------- */

function Dashboard({ history, latest, onScan, onReports, onAlerts, onNotify }) {
  const threats = history.reduce((n, r) => n + r.threats, 0);
  const domains = new Set(history.map((r) => r.domain).filter(Boolean)).size;
  const split = latest ? checkSplit(latest) : null;
  const recent = history.slice().reverse().slice(0, 4);
  const status = latest ? scoreStatus(latest.score) : null;

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero-text">
          <span className="pill">
            <Icon name="check" size={14} /> Trusted · Secure · Reliable
          </span>
          <h1>
            Smart Security.
            <br />
            <span className="accent">Stronger Protection.</span>
          </h1>
          <p className="hero-sub">
            Scan for email breaches, domain vulnerabilities, and security issues in one powerful platform.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={onNotify}>
              <Icon name="bell" size={18} /> Notify Me <Icon name="arrow" size={16} />
            </button>
            <button className="btn btn-outline" onClick={() => onScan("both")}>
              <Icon name="play" size={16} /> Start a scan
            </button>
          </div>
          <p className="fine">
            <Icon name="lock" size={14} /> Get notified when it's ready
          </p>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orb" />
          <img src={LOGO_SRC} alt="" className="hero-logo" />
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2><Icon name="chart" size={20} /> Dashboard</h2>
          <span className="muted small">This session · Lagos time</span>
        </div>
        <div className="stats">
          <StatCard icon="shield" tone="purple" label="Security Status"
            value={latest ? `${latest.score}/100` : "—"}
            hint={status ? status.label : "Run a scan to see your status"} />
          <StatCard icon="scan" tone="purple" label="Total Scans"
            value={history.length} hint={history.length ? "Completed this session" : "No scans yet"} />
          <StatCard icon="alert" tone="red" label="Threats Found"
            value={threats} hint={threats ? "Across all scans" : "None detected so far"} />
          <StatCard icon="globe" tone="blue" label="Domains Monitored"
            value={domains} hint={domains ? "Domains scanned" : "Add a domain scan"} />
        </div>
      </section>

      <section className="row-3">
        <div className="card">
          <div className="card-head">
            <h3>Recent Activity</h3>
            <button className="link" onClick={onReports}>View all</button>
          </div>
          {recent.length === 0 ? (
            <EmptyState icon="scan" title="No activity yet" text="Completed scans will appear here." />
          ) : (
            <ul className="list">
              {recent.map((r) => (
                <li key={r.id} className="list-row activity-row">
                  <div className="activity">
                    <span className="activity-icon"><Icon name="check" size={16} /></span>
                    <div>
                      <div className="row-title">{TYPE_LABEL[r.type]} Completed</div>
                      <div className="muted small">{r.email || r.domain}</div>
                    </div>
                  </div>
                  <span className="muted small nowrap">{formatWhen(r.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Security Overview</h3>
          </div>
          {split ? (
            <div className="overview">
              <Donut split={split} score={latest.score} />
              <ul className="legend">
                <li><i style={{ background: TONE.green }} /> Secure <b>{split.secure}%</b></li>
                <li><i style={{ background: TONE.amber }} /> At risk <b>{split.risk}%</b></li>
                <li><i style={{ background: TONE.red }} /> Critical <b>{split.critical}%</b></li>
              </ul>
              <p className="muted small center">From your latest scan of {latest.email || latest.domain}.</p>
            </div>
          ) : (
            <EmptyState icon="shield" title="No overview yet" text="Run a scan to see secure, at-risk and critical checks." />
          )}
        </div>

        <div className="promo">
          <img src={LOGO_SRC} alt="" className="promo-logo" />
          <span className="promo-kicker">Automation Prime Africa</span>
          <h3>Building a safer digital ecosystem.</h3>
          <span className="promo-foot">Powered by <a href="https://www.automationprimeafrica.com/" target="_blank" rel="noopener noreferrer">Automation Prime Africa</a></span>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h3>Quick Actions</h3>
        </div>
        <div className="actions-grid">
          <QuickAction icon="mail" label="Email Scan" onClick={() => onScan("email")} />
          <QuickAction icon="globe" label="Domain Scan" onClick={() => onScan("domain")} />
          <QuickAction icon="shield" label="Full Scan" onClick={() => onScan("both")} />
          <QuickAction icon="chart" label="View Reports" onClick={onReports} />
          <QuickAction icon="bell" label="Manage Alerts" onClick={onAlerts} />
          <QuickAction icon="send" label="Notify Me" onClick={onNotify} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, tone, label, value, hint }) {
  return (
    <div className="stat">
      <span className={`stat-icon tone-${tone}`}><Icon name={icon} size={22} /></span>
      <div className="stat-body">
        <span className="label">{label}</span>
        <strong>{value}</strong>
        <span className="muted small">{hint}</span>
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }) {
  return (
    <button className="action" onClick={onClick}>
      <span className="action-icon"><Icon name={icon} size={20} /></span>
      <span>{label}</span>
    </button>
  );
}

function ScanPage({ scanMode, setScanMode, inputEmail, setInputEmail, inputDomain, setInputDomain, error, running, progress, onRun, record }) {
  const needEmail = scanMode === "email" || scanMode === "both";
  const needDomain = scanMode === "domain" || scanMode === "both";
  return (
    <div className="stack-lg">
      <div className="page-head">
        <h2>Scan</h2>
        <p className="muted">Choose a scan, enter a target, and run it.</p>
      </div>

      <div className="notice notice-info" role="note">
        <Icon name="lab" size={18} />
        <span>
          <strong>Demo mode.</strong> Results are simulated until the breach-lookup and DNS-check services are connected.
          Don't use them as real findings.
        </span>
      </div>

      <section className="card">
        <div className="mode-grid" role="group" aria-label="Scan type">
          {SCAN_MODES.map((m) => (
            <button
              key={m.id}
              className={`mode ${scanMode === m.id ? "active" : ""}`}
              aria-pressed={scanMode === m.id}
              onClick={() => setScanMode(m.id)}
            >
              <span className="mode-icon"><Icon name={m.icon} size={20} /></span>
              <span>
                <span className="row-title">{m.label}</span>
                <span className="muted small block">{m.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <form className="form" noValidate onSubmit={(e) => { e.preventDefault(); onRun(); }}>
          {needEmail && (
            <label className="field">
              <span>Email address</span>
              <input maxLength={254} type="email" placeholder="you@yourcompany.com" value={inputEmail}
                onChange={(e) => setInputEmail(e.target.value)} disabled={running} autoComplete="email" />
            </label>
          )}
          {needDomain && (
            <label className="field">
              <span>Domain</span>
              <input maxLength={253} type="text" placeholder="yourcompany.com" value={inputDomain}
                onChange={(e) => setInputDomain(e.target.value)} disabled={running} autoCapitalize="none" />
            </label>
          )}

          {error && <div className="notice notice-error" role="alert">{error}</div>}

          <button type="submit" className="btn btn-primary btn-block" disabled={running}>
            {running ? `Scanning… ${progress}%` : "Run scan"}
          </button>

          {running && (
            <div className="progress" aria-label="Scan progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          )}
          {running && (
            <ul className="muted small steps">
              {needEmail && <li>Simulated breach lookup…</li>}
              {needDomain && <li>Simulated DNS checks (SPF, DKIM, DMARC, SSL, DNSSEC)…</li>}
              <li>Calculating score…</li>
            </ul>
          )}
        </form>
      </section>

      {record ? (
        <section className="stack">
          <div className="page-head">
            <h3>Results · {TYPE_LABEL[record.type]}</h3>
            <p className="muted small">{formatWhen(record.date)} (WAT) · Simulated</p>
          </div>
          <ScanResult record={record} />
        </section>
      ) : (
        !running && (
          <EmptyState icon="scan" title="No results yet" text="Run a scan above and the results will appear here." />
        )
      )}
    </div>
  );
}

function ReportsPage({ history, selected, onSelect, onExport, onScan }) {
  const scores = history.map((r) => r.score);
  return (
    <div className="stack-lg">
      <div className="page-head page-head-row">
        <div>
          <h2>Reports</h2>
          <p className="muted">Scans completed this session. Reports reset when the page is reloaded.</p>
        </div>
        <button className="btn btn-outline" onClick={onExport} disabled={history.length === 0}>
          <Icon name="download" size={16} /> Export CSV
        </button>
      </div>

      {history.length === 0 ? (
        <EmptyState
          icon="chart"
          title="No reports yet"
          text="Run a scan and its report will be listed here."
          action={<button className="btn btn-primary" onClick={() => onScan("both")}>Start a scan</button>}
        />
      ) : (
        <>
          <section className="card">
            <h3>Security score history</h3>
            <Sparkline values={scores} />
          </section>

          <section className="card card-flush">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date (WAT)</th>
                    <th>Type</th>
                    <th>Target</th>
                    <th>Score</th>
                    <th>Threats</th>
                    <th>Status</th>
                    <th><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice().reverse().map((r) => (
                    <tr key={r.id} className={selected?.id === r.id ? "selected" : ""}>
                      <td className="nowrap">{formatWhen(r.date)}</td>
                      <td>{TYPE_LABEL[r.type]}</td>
                      <td className="mono">{r.email || r.domain}</td>
                      <td className="mono">{r.score}</td>
                      <td>{r.threats}</td>
                      <td><span className="status status-pass">Completed</span></td>
                      <td>
                        <button className="link" onClick={() => onSelect(r.id)}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {selected && (
            <section className="stack">
              <div className="page-head">
                <h3>Report details · {TYPE_LABEL[selected.type]}</h3>
                <p className="muted small">{selected.email || selected.domain} · Simulated</p>
              </div>
              <ScanResult record={selected} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- App shell ---------- */

function Sidebar({ page, onNavigate, open, onClose }) {
  return (
    <>
      <div className={`scrim ${open ? "show" : ""}`} onClick={onClose} aria-hidden="true" />
      <aside className={`sidebar ${open ? "open" : ""}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-logo"><img src={LOGO_SRC} alt="" /></span>
          <div>
            <div className="brand-name">APA <span>SHIELD</span></div>
            <div className="brand-sub">Automation Prime Africa</div>
          </div>
          <button className="icon-btn close-btn" onClick={onClose} aria-label="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon name={item.icon} size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-card">
          <Icon name="shield" size={26} />
          <p>Securing a safer digital world together</p>
        </div>
      </aside>
    </>
  );
}

function TopBar({ onMenu, onSearch, onBell, accountLabel }) {
  const [q, setQ] = useState("");
  return (
    <header className="topbar">
      <button className="icon-btn menu-btn" onClick={onMenu} aria-label="Open menu">
        <Icon name="menu" size={20} />
      </button>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); onSearch(q.trim()); }}>
        <Icon name="search" size={18} />
        <input maxLength={253} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search an email or domain, e.g. name@company.com" aria-label="Search" />
      </form>
      <div className="topbar-right">
        <button className="icon-btn" onClick={onBell} aria-label="Notifications">
          <Icon name="bell" size={20} />
        </button>
        <div className="account">
          <span className="avatar">AP</span>
          <span className="account-text">
            <strong>{accountLabel ? "Signed in" : "Guest"}</strong>
            <span>{accountLabel || "Demo mode"}</span>
          </span>
        </div>
      </div>
    </header>
  );
}

// Set when the user comes back from a verification link (?verify=ok or ?verify=failed).
// Read once per page load, outside effects, so it survives React's development re-runs.
const VERIFY_RESULT = new URLSearchParams(window.location.search).get("verify");

const VERIFY_NOTICE = {
  ok: { tone: "success", text: "Your email address is verified. You'll receive alerts for it once alert sending is connected." },
  failed: { tone: "error", text: "That verification link is invalid or has expired. Request a new one on the Notify Me page." },
};

export default function App() {
  const [page, setPage] = useState(VERIFY_RESULT ? "notifications" : "dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [notice, setNotice] = useState(VERIFY_NOTICE[VERIFY_RESULT] ?? null);
  const [history, setHistory] = useState([]);
  const [scanMode, setScanMode] = useState("email");
  const [inputEmail, setInputEmail] = useState("");
  const [inputDomain, setInputDomain] = useState("");
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isConfigured);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (VERIFY_RESULT) window.history.replaceState({}, "", window.location.pathname);
  }, []);

  useEffect(() => {
    if (!isConfigured) return undefined;
    let active = true;
    getSession()
      .then((s) => active && setSession(s))
      .catch(() => {})
      .finally(() => active && setAuthReady(true));
    const unsubscribe = onAuthChange((event, s) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const latest = history[history.length - 1] ?? null;
  const selected = history.find((r) => r.id === selectedId) ?? latest;

  const go = (p) => {
    setPage(p);
    setNavOpen(false);
    setNotice(null);
  };

  const openScan = (mode) => {
    setScanMode(mode);
    setError("");
    go("scan");
  };

  const handleSearch = (q) => {
    if (validateEmail(q)) {
      setInputEmail(q);
      openScan("email");
    } else if (validateDomain(q)) {
      setInputDomain(q.toLowerCase());
      openScan("domain");
    } else {
      setNotice({
        tone: "info",
        text: "Search takes an email address or a domain, such as name@company.com or company.com.",
      });
    }
  };

  const runScan = () => {
    setError("");
    const email = inputEmail.trim();
    const domain = inputDomain.trim().toLowerCase();
    const needEmail = scanMode === "email" || scanMode === "both";
    const needDomain = scanMode === "domain" || scanMode === "both";
    if (needEmail && !validateEmail(email)) {
      setError("Enter a valid email address, e.g. you@company.com");
      return;
    }
    if (needDomain && !validateDomain(domain)) {
      setError("Enter a valid domain, e.g. company.com");
      return;
    }
    setRunning(true);
    setProgress(0);
    let step = 0;
    const tick = () => {
      step += 1;
      setProgress(Math.min(100, step * 4));
      if (step < 25) {
        setTimeout(tick, 60);
        return;
      }
      const record = runDemoScan({ mode: scanMode, email, domain });
      setHistory((h) => [...h, record]);
      setSelectedId(record.id);
      setRunning(false);
      setProgress(0);
    };
    setTimeout(tick, 60);
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(history)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "apa-shield-reports.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  let body;
  if (page === "dashboard") {
    body = (
      <Dashboard
        history={history}
        latest={latest}
        onScan={openScan}
        onReports={() => go("reports")}
        onAlerts={() => go("alerts")}
        onNotify={() => go("notifications")}
      />
    );
  } else if (page === "scan") {
    body = (
      <ScanPage
        scanMode={scanMode}
        setScanMode={(m) => { setScanMode(m); setError(""); }}
        inputEmail={inputEmail}
        setInputEmail={setInputEmail}
        inputDomain={inputDomain}
        setInputDomain={setInputDomain}
        error={error}
        running={running}
        progress={progress}
        onRun={runScan}
        record={selected}
      />
    );
  } else if (page === "reports") {
    body = (
      <ReportsPage
        history={history}
        selected={selected}
        onSelect={setSelectedId}
        onExport={exportCsv}
        onScan={openScan}
      />
    );
  } else if (page === "notifications") {
    body = authReady ? (
      <NotifySection
        session={session}
        recovering={recovering}
        onRecoveryDone={() => setRecovering(false)}
        onGoHome={() => go("dashboard")}
      />
    ) : (
      <p className="muted">Checking your session…</p>
    );
  } else if (page === "alerts" || page === "settings") {
    const label = NAV.find((n) => n.id === page).label;
    if (!authReady) {
      body = <p className="muted">Checking your session…</p>;
    } else if (!session || recovering || !isConfigured) {
      body = (
        <SignInNeeded
          pageTitle={label}
          text={
            page === "alerts"
              ? "Sign in to set alert rules for the addresses and domains you monitor."
              : "Sign in to change your password, account details and signed-in devices."
          }
          onSignIn={() => go("notifications")}
        />
      );
    } else {
      body = page === "alerts" ? <AlertsSection session={session} /> : <SettingsSection session={session} />;
    }
  } else {
    body = <HelpSection />;
  }

  return (
    <div className="app">
      <Sidebar page={page} onNavigate={go} open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="main">
        <TopBar
          onMenu={() => setNavOpen(true)}
          onSearch={handleSearch}
          onBell={() => go("notifications")}
          accountLabel={session?.user?.email}
        />
        <main className="content">
          {notice && (
            <div className={`notice notice-${notice.tone}`} role="status">
              <span>{notice.text}</span>
              <button className="icon-btn" onClick={() => setNotice(null)} aria-label="Dismiss">
                <Icon name="close" size={16} />
              </button>
            </div>
          )}
          {body}
          <footer className="site-footer">
            <span>Powered by <a className="brand-link" href="https://www.automationprimeafrica.com/" target="_blank" rel="noopener noreferrer">Automation Prime Africa</a></span>
            <span>© 2026 APA SHIELD. All rights reserved.</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
