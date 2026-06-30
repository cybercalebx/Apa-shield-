import { useState } from "react";

const SHIELD_GREEN = "#00C48C";
const SHIELD_DARK = "#0A0F1E";
const SHIELD_NAVY = "#0D1B2A";
const SHIELD_CARD = "#111827";
const SHIELD_BORDER = "#1E2D3D";
const SHIELD_AMBER = "#F59E0B";
const SHIELD_RED = "#EF4444";
const SHIELD_BLUE = "#3B82F6";

function ScoreRing({ score }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? SHIELD_GREEN : score >= 60 ? SHIELD_AMBER : SHIELD_RED;
  return (
    <div style={{ position: "relative", width: 140, height: 140, margin: "0 auto" }}>
      <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={70} cy={70} r={r} fill="none" stroke={SHIELD_BORDER} strokeWidth={10} />
        <circle cx={70} cy={70} r={r} fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s ease" }} />
      </svg>
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "monospace" }}>{score}</span>
        <span style={{ fontSize: 11, color: "#6B7280", letterSpacing: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

function Badge({ priority }) {
  const map = {
    critical: { bg: "#3B0A0A", color: SHIELD_RED, label: "CRITICAL" },
    high: { bg: "#3B2500", color: SHIELD_AMBER, label: "HIGH" },
    medium: { bg: "#1A2A3B", color: SHIELD_BLUE, label: "MEDIUM" },
    low: { bg: "#0F2A1A", color: SHIELD_GREEN, label: "LOW" },
  };
  const s = map[priority];
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700,
      letterSpacing: 1.5, padding: "2px 8px", borderRadius: 4, fontFamily: "monospace", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

function StatusDot({ status }) {
  const color = status === "pass" ? SHIELD_GREEN : status === "warning" ? SHIELD_AMBER : SHIELD_RED;
  const label = status === "pass" ? "PASS" : status === "warning" ? "WARN" : "FAIL";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "monospace" }}>{label}</span>
    </span>
  );
}

function MiniSparkline({ scores, labels }) {
  const max = Math.max(...scores);
  const min = Math.min(...scores) - 4;
  const w = 260, h = 60;
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w;
    const y = h - ((s - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg width={w} height={h + 30} style={{ overflow: "visible", display: "block" }}>
        <polyline points={pts} fill="none" stroke={SHIELD_GREEN} strokeWidth={2} strokeLinejoin="round" />
        {scores.map((s, i) => {
          const x = (i / (scores.length - 1)) * w;
          const y = h - ((s - min) / (max - min)) * h;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={4} fill={SHIELD_GREEN} />
              <text x={x} y={h + 16} textAnchor="middle" fontSize={10} fill="#6B7280">{labels[i]}</text>
              <text x={x} y={y - 8} textAnchor="middle" fontSize={10} fill={SHIELD_GREEN}>{s}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function generateEmailResult(email) {
  const breachPool = [
    { breach: "LinkedIn 2021", date: "2021-04-08", severity: "high" },
    { breach: "Adobe 2019", date: "2019-10-04", severity: "medium" },
    { breach: "Dropbox 2012", date: "2012-07-01", severity: "low" },
    { breach: "RockYou2024", date: "2024-06-01", severity: "critical" },
    { breach: "Facebook 2019", date: "2019-09-28", severity: "high" },
  ];
  const hash = email.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const breachCount = hash % 3;
  const breaches = breachPool.slice(0, breachCount).map(b => ({ ...b, email }));
  const score = Math.max(45, 100 - breachCount * 18);
  return {
    type: "email", email, overallScore: score, breaches,
    scoreHistory: [score - 8, score - 5, score - 7, score - 3, score - 5, score],
    scoreLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    recommendations: [
      ...(breachCount > 0 ? [{ priority: "critical", title: `Reset ${breachCount} compromised password(s)`, detail: `${email} was found in known data breaches. Change your password immediately.`, icon: "🔑" }] : []),
      { priority: "high", title: "Enable MFA on this account", detail: "Multi-factor authentication stops 99% of automated attacks.", icon: "🔐" },
      { priority: "medium", title: "Use a unique password", detail: "Never reuse passwords across different platforms.", icon: "🛡️" },
      { priority: "low", title: "Set up a breach alert", detail: "Monitor this email for future breach notifications.", icon: "🔔" },
    ],
  };
}

function generateDomainResult(domain) {
  const domainHash = domain.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const hasDmarc = domainHash % 3 === 0;
  const hasDkim = domainHash % 2 === 0;
  const issues = (hasDmarc ? 0 : 1) + (hasDkim ? 0 : 1) + 1;
  const score = Math.max(40, 100 - issues * 14);
  return {
    type: "domain", domain, overallScore: score,
    domain_checks: {
      spf: { status: "pass" }, dkim: { status: hasDkim ? "pass" : "fail" },
      dmarc: { status: hasDmarc ? "pass" : "fail" }, ssl: { status: "pass" }, dnssec: { status: "warning" },
    },
    scoreHistory: [score - 10, score - 7, score - 9, score - 4, score - 6, score],
    scoreLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    recommendations: [
      ...(!hasDmarc ? [{ priority: "critical", title: "Configure DMARC policy", detail: "No DMARC record found — anyone can spoof your email domain.", icon: "📧" }] : []),
      ...(!hasDkim ? [{ priority: "high", title: "Enable DKIM signing", detail: "DKIM is missing. Enable it in your DNS and email provider settings.", icon: "✍️" }] : []),
      { priority: "medium", title: "Configure DNSSEC", detail: "Prevents DNS hijacking attacks on your domain.", icon: "🌐" },
      { priority: "low", title: "Schedule a full security audit", detail: "Review all DNS records and SSL certificate renewal dates.", icon: "📋" },
    ],
  };
}

function generateBothResult(email, domain) {
  const emailResult = generateEmailResult(email);
  const domainResult = generateDomainResult(domain);
  const score = Math.round((emailResult.overallScore + domainResult.overallScore) / 2);
  return {
    type: "both", email, domain, overallScore: score,
    breaches: emailResult.breaches, domain_checks: domainResult.domain_checks,
    scoreHistory: [score - 10, score - 7, score - 9, score - 4, score - 6, score],
    scoreLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    recommendations: [...emailResult.recommendations, ...domainResult.recommendations]
      .filter((r, i, arr) => arr.findIndex(x => x.title === r.title) === i),
  };
}

export default function APAShield() {
  const [scanMode, setScanMode] = useState("email");
  const [activeTab, setActiveTab] = useState("overview");
  const [scanRunning, setScanRunning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showBreach, setShowBreach] = useState(null);
  const [scanData, setScanData] = useState(null);
  const [inputEmail, setInputEmail] = useState("");
  const [inputDomain, setInputDomain] = useState("");
  const [error, setError] = useState("");
  const [hasScanned, setHasScanned] = useState(false);

  const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const validateDomain = (d) => /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d);

  const runScan = () => {
    setError("");
    if ((scanMode === "email" || scanMode === "both") && !validateEmail(inputEmail)) {
      setError("Please enter a valid email address e.g. you@company.com"); return;
    }
    if ((scanMode === "domain" || scanMode === "both") && !validateDomain(inputDomain)) {
      setError("Please enter a valid domain e.g. yourcompany.com"); return;
    }
    setScanRunning(true); setScanProgress(0); setHasScanned(false);
    const iv = setInterval(() => {
      setScanProgress(p => {
        if (p >= 100) {
          clearInterval(iv); setScanRunning(false);
          if (scanMode === "email") setScanData(generateEmailResult(inputEmail));
          else if (scanMode === "domain") setScanData(generateDomainResult(inputDomain));
          else setScanData(generateBothResult(inputEmail, inputDomain));
          setHasScanned(true); setActiveTab("overview"); return 100;
        }
        return p + 3;
      });
    }, 60);
  };

  const d = scanData;
  const scoreColor = d ? (d.overallScore >= 80 ? SHIELD_GREEN : d.overallScore >= 60 ? SHIELD_AMBER : SHIELD_RED) : SHIELD_GREEN;
  const scoreLabel = d ? (d.overallScore >= 80 ? "Good" : d.overallScore >= 60 ? "Needs Attention" : "At Risk") : "";

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(d && (d.type === "email" || d.type === "both") ? [{ id: "breaches", label: `Breaches (${d.breaches?.length ?? 0})` }] : []),
    ...(d && (d.type === "domain" || d.type === "both") ? [{ id: "domain", label: "Domain" }] : []),
    { id: "actions", label: "Actions" },
  ];

  const inputStyle = {
    background: SHIELD_NAVY, border: `1px solid ${SHIELD_BORDER}`,
    borderRadius: 8, padding: "10px 14px", color: "#E5E7EB",
    fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
  };

  const modeBtn = (mode, icon, label, desc) => (
    <button onClick={() => { setScanMode(mode); setError(""); }}
      style={{
        flex: 1, background: scanMode === mode ? `${SHIELD_GREEN}15` : SHIELD_NAVY,
        border: `2px solid ${scanMode === mode ? SHIELD_GREEN : SHIELD_BORDER}`,
        borderRadius: 10, padding: "12px 10px", cursor: "pointer",
        textAlign: "left", transition: "all 0.2s", minWidth: 0,
      }}>
      <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: scanMode === mode ? SHIELD_GREEN : "#E5E7EB", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.3 }}>{desc}</div>
    </button>
  );

  return (
    <div style={{
      minHeight: "100vh", background: SHIELD_DARK, color: "#E5E7EB",
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      overflowX: "hidden", width: "100%", boxSizing: "border-box",
    }}>

      {/* Top Bar */}
      <div style={{
        background: SHIELD_NAVY, borderBottom: `1px solid ${SHIELD_BORDER}`,
        padding: "0 16px", display: "flex", alignItems: "center",
        justifyContent: "space-between", height: 70, boxSizing: "border-box", width: "100%",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* APA Logo — larger and more prominent */}
          <img
            src="data:image/jpeg;base64,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"
            alt="Automation Prime Africa"
            style={{
              height: 54,
              width: 54,
              objectFit: "contain",
              borderRadius: 10,
              background: "#ffffff",
              padding: 4,
              boxShadow: `0 0 0 1px ${SHIELD_BORDER}`,
            }}
          />
          <div style={{ width: 1, height: 36, background: SHIELD_BORDER }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", lineHeight: 1.15, letterSpacing: 0.2 }}>
              APA <span style={{ color: SHIELD_GREEN }}>Shield</span>
            </div>
            <div style={{ fontSize: 10, color: "#6B7280", letterSpacing: 1.2, textTransform: "uppercase", marginTop: 1 }}>
              Automation Prime Africa
            </div>
          </div>
        </div>
        <div style={{
          fontSize: 10, color: "#4B5563", textAlign: "right", lineHeight: 1.4,
        }}>
          Cybersecurity<br />Platform
        </div>
      </div>

      {/* Scan progress bar */}
      {scanRunning && (
        <div style={{ height: 3, background: SHIELD_BORDER }}>
          <div style={{ height: "100%", background: SHIELD_GREEN, width: `${scanProgress}%`,
            transition: "width 0.06s linear", boxShadow: `0 0 12px ${SHIELD_GREEN}` }} />
        </div>
      )}

      <div style={{ width: "100%", maxWidth: 960, margin: "0 auto", padding: "20px 12px", boxSizing: "border-box" }}>

        {/* Scan Form */}
        <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
          borderRadius: 12, padding: "20px 16px", marginBottom: 24 }}>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 4 }}>🔍 Security Scan</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Choose what you want to scan below.</div>
          </div>

          {/* Mode Selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {modeBtn("email", "📧", "Email Scan", "Check if an email was in a data breach")}
            {modeBtn("domain", "🌐", "Domain Scan", "Audit SPF, DKIM, DMARC & SSL records")}
            {modeBtn("both", "🔒", "Full Scan", "Email breach + full domain security check")}
          </div>

          {/* Input Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(scanMode === "email" || scanMode === "both") && (
              <div>
                <label style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase",
                  letterSpacing: 1, display: "block", marginBottom: 6 }}>Email Address</label>
                <input type="email" placeholder="you@yourcompany.com"
                  value={inputEmail} onChange={e => setInputEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runScan()}
                  style={inputStyle} />
              </div>
            )}
            {(scanMode === "domain" || scanMode === "both") && (
              <div>
                <label style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase",
                  letterSpacing: 1, display: "block", marginBottom: 6 }}>Domain</label>
                <input type="text" placeholder="yourcompany.com"
                  value={inputDomain} onChange={e => setInputDomain(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runScan()}
                  style={inputStyle} />
              </div>
            )}
            <button onClick={runScan} disabled={scanRunning}
              style={{
                background: scanRunning ? SHIELD_BORDER : SHIELD_GREEN,
                color: scanRunning ? "#6B7280" : "#000",
                border: "none", borderRadius: 8, padding: "12px 24px",
                fontWeight: 700, fontSize: 14, cursor: scanRunning ? "not-allowed" : "pointer",
                width: "100%", boxSizing: "border-box",
              }}>
              {scanRunning ? `Scanning… ${scanProgress}%` : "⟳ Run Scan"}
            </button>
          </div>

          {error && (
            <div style={{ marginTop: 12, fontSize: 13, color: SHIELD_RED,
              background: "#3B0A0A", padding: "8px 14px", borderRadius: 6 }}>
              ⚠️ {error}
            </div>
          )}

          {scanRunning && (
            <div style={{ marginTop: 14, fontSize: 12, color: "#6B7280", lineHeight: 1.8 }}>
              {(scanMode === "email" || scanMode === "both") && <div><span style={{ color: SHIELD_GREEN }}>●</span> Checking breach databases…</div>}
              {(scanMode === "domain" || scanMode === "both") && <div><span style={{ color: SHIELD_GREEN }}>●</span> Scanning DNS records…</div>}
              <div><span style={{ color: SHIELD_GREEN }}>●</span> Calculating security score…</div>
            </div>
          )}
        </div>

        {/* Landing */}
        {!hasScanned && !scanRunning && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⛨</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#6B7280", marginBottom: 8 }}>
              Choose a scan type above to get started
            </div>
            <div style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.6 }}>
              Scan an email for breaches, check a domain's security records, or run a full scan for complete visibility.
            </div>
          </div>
        )}

        {/* Results */}
        {hasScanned && d && (
          <>
            {/* Summary Cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10, marginBottom: 20,
            }}>
              <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${scoreColor}` }}>
                <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Security Score</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: scoreColor, fontFamily: "monospace" }}>{d.overallScore}/100</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{scoreLabel}</div>
              </div>

              {(d.type === "email" || d.type === "both") && (
                <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                  borderRadius: 10, padding: "14px 16px",
                  borderTop: `3px solid ${d.breaches.length > 0 ? SHIELD_RED : SHIELD_GREEN}` }}>
                  <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Breaches Found</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: d.breaches.length > 0 ? SHIELD_RED : SHIELD_GREEN, fontFamily: "monospace" }}>
                    {d.breaches.length}
                  </div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2, wordBreak: "break-all" }}>{d.email}</div>
                </div>
              )}

              {(d.type === "domain" || d.type === "both") && (
                <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                  borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${SHIELD_BLUE}` }}>
                  <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Domain Checks</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: SHIELD_BLUE, fontFamily: "monospace" }}>
                    {Object.values(d.domain_checks).filter(v => v.status === "pass").length}/5
                  </div>
                  <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2, wordBreak: "break-all" }}>{d.domain}</div>
                </div>
              )}

              <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                borderRadius: 10, padding: "14px 16px", borderTop: `3px solid ${SHIELD_AMBER}` }}>
                <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Actions Needed</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: SHIELD_AMBER, fontFamily: "monospace" }}>
                  {d.recommendations.filter(r => r.priority === "critical" || r.priority === "high").length}
                </div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 2 }}>critical or high priority</div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: "flex", gap: 2, borderBottom: `1px solid ${SHIELD_BORDER}`,
              marginBottom: 20, overflowX: "auto", WebkitOverflowScrolling: "touch",
            }}>
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 14px", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap",
                  color: activeTab === t.id ? SHIELD_GREEN : "#6B7280",
                  borderBottom: activeTab === t.id ? `2px solid ${SHIELD_GREEN}` : "2px solid transparent",
                  transition: "all 0.15s", flexShrink: 0,
                }}>{t.label}</button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 16 }}>Overall Security Score</div>
                  <ScoreRing score={d.overallScore} />
                  <div style={{ textAlign: "center", marginTop: 12 }}>
                    <span style={{ fontSize: 13, color: scoreColor, fontWeight: 700 }}>{scoreLabel}</span>
                    <p style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>
                      {d.type === "email" && `Based on breach exposure for ${d.email}`}
                      {d.type === "domain" && `Based on domain security checks for ${d.domain}`}
                      {d.type === "both" && `Full scan of ${d.email} and ${d.domain}`}
                    </p>
                  </div>
                </div>

                <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`, borderRadius: 10, padding: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 16 }}>Score Trend</div>
                  <MiniSparkline scores={d.scoreHistory} labels={d.scoreLabels} />
                </div>

                {(d.type === "email" || d.type === "both") && (
                  <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`, borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 12 }}>Breach Summary</div>
                    {d.breaches.length === 0 ? (
                      <div style={{ background: "#0A2318", borderRadius: 8, padding: 20, textAlign: "center" }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
                        <div style={{ color: SHIELD_GREEN, fontWeight: 700 }}>No breaches found</div>
                        <div style={{ color: "#6B7280", fontSize: 12, marginTop: 4 }}>{d.email} has no known exposure</div>
                      </div>
                    ) : (
                      d.breaches.map((b, i) => (
                        <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${SHIELD_BORDER}`,
                          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{b.breach}</div>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>{b.date}</div>
                          </div>
                          <Badge priority={b.severity} />
                        </div>
                      ))
                    )}
                  </div>
                )}

                {(d.type === "domain" || d.type === "both") && (
                  <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`, borderRadius: 10, padding: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#9CA3AF", marginBottom: 16 }}>Domain Security Status</div>
                    {Object.entries(d.domain_checks).map(([key, val]) => (
                      <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 0", borderBottom: `1px solid ${SHIELD_BORDER}` }}>
                        <span style={{ fontSize: 13, color: "#D1D5DB", textTransform: "uppercase", fontWeight: 600, fontFamily: "monospace" }}>{key}</span>
                        <StatusDot status={val.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Breaches */}
            {activeTab === "breaches" && (d.type === "email" || d.type === "both") && (
              <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: `1px solid ${SHIELD_BORDER}`,
                  display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Credential Breach Report</div>
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2, wordBreak: "break-all" }}>
                      Results for: <span style={{ color: SHIELD_GREEN, fontFamily: "monospace" }}>{d.email}</span>
                    </div>
                  </div>
                  <span style={{ background: d.breaches.length > 0 ? "#3B0A0A" : "#0A2318",
                    color: d.breaches.length > 0 ? SHIELD_RED : SHIELD_GREEN,
                    fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    {d.breaches.length > 0 ? `${d.breaches.length} FOUND` : "CLEAN ✅"}
                  </span>
                </div>
                {d.breaches.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>✅</div>
                    <div style={{ color: SHIELD_GREEN, fontWeight: 700, fontSize: 16 }}>No breaches detected</div>
                    <div style={{ color: "#6B7280", fontSize: 13, marginTop: 6 }}>
                      {d.email} was not found in any known data breach database.
                    </div>
                  </div>
                ) : (
                  d.breaches.map((b, i) => (
                    <div key={i} style={{ padding: "14px 16px", borderBottom: `1px solid ${SHIELD_BORDER}`,
                      cursor: "pointer", background: showBreach === i ? `${SHIELD_RED}08` : "transparent" }}
                      onClick={() => setShowBreach(showBreach === i ? null : i)}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace", wordBreak: "break-all" }}>{b.email}</div>
                          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                            Found in: <span style={{ color: "#9CA3AF" }}>{b.breach}</span> · {b.date}
                          </div>
                        </div>
                        <Badge priority={b.severity} />
                      </div>
                      {showBreach === i && (
                        <div style={{ marginTop: 10, background: SHIELD_NAVY, borderRadius: 6,
                          padding: "10px 14px", fontSize: 12, color: "#9CA3AF" }}>
                          🔴 <strong style={{ color: "#E5E7EB" }}>Action required:</strong> Reset this password immediately.
                          Check if it was reused on other platforms. Enable MFA if not already active.
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab: Domain */}
            {activeTab === "domain" && (d.type === "domain" || d.type === "both") && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                  borderRadius: 10, padding: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 20 }}>🌐</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Domain: <span style={{ color: SHIELD_GREEN, fontFamily: "monospace", wordBreak: "break-all" }}>{d.domain}</span></div>
                    <div style={{ fontSize: 12, color: "#6B7280" }}>Security controls audit</div>
                  </div>
                </div>
                {[
                  { key: "spf", name: "SPF Record", desc: "Prevents email spoofing by authorizing which servers can send email for your domain." },
                  { key: "dkim", name: "DKIM Signing", desc: "Adds a cryptographic signature to emails proving they have not been tampered with." },
                  { key: "dmarc", name: "DMARC Policy", desc: "Tells receiving servers what to do if SPF or DKIM fails. Critical for anti-phishing." },
                  { key: "ssl", name: "SSL Certificate", desc: "Encrypts traffic to your website. Essential for customer trust and search ranking." },
                  { key: "dnssec", name: "DNSSEC", desc: "Prevents DNS hijacking attacks that could redirect your visitors to fake pages." },
                ].map(item => {
                  const check = d.domain_checks[item.key];
                  return (
                    <div key={item.key} style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                      borderLeft: `3px solid ${check.status === "pass" ? SHIELD_GREEN : check.status === "warning" ? SHIELD_AMBER : SHIELD_RED}`,
                      borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</span>
                        <StatusDot status={check.status} />
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: Actions */}
            {activeTab === "actions" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>
                  {d.recommendations.length} recommendations · Sorted by priority
                </div>
                {d.recommendations.map((rec, i) => (
                  <div key={i} style={{ background: SHIELD_CARD, border: `1px solid ${SHIELD_BORDER}`,
                    borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ fontSize: 20, marginTop: 2, flexShrink: 0 }}>{rec.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{rec.title}</span>
                        <Badge priority={rec.priority} />
                      </div>
                      <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5 }}>{rec.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${SHIELD_BORDER}`,
          display: "flex", flexDirection: "column", gap: 4, alignItems: "center", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#4B5563" }}>APA Shield · Automation Prime Africa · Cybersecurity Health Platform</div>
          <div style={{ fontSize: 11, color: "#4B5563" }}>Phase 1 · Demo Mode · Real API integration coming in Phase 2</div>
        </div>
      </div>
    </div>
  );
}