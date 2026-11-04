// Scan logic for APA Shield.
//
// IMPORTANT: this is still demo mode. Results are simulated from the input
// until the breach-lookup and DNS-check APIs are connected. Every record is
// tagged source: "simulated" so the UI can say so.

export const TYPE_LABEL = {
  email: "Email Scan",
  domain: "Domain Scan",
  both: "Full Scan",
};

export const TONE = {
  green: "#14A36B",
  amber: "#E8900C",
  red: "#E0444F",
  blue: "#3B6FE0",
};

const BREACH_POOL = [
  { breach: "LinkedIn 2021", date: "2021-04-08", severity: "high" },
  { breach: "Adobe 2019", date: "2019-10-04", severity: "medium" },
  { breach: "Dropbox 2012", date: "2012-07-01", severity: "low" },
  { breach: "RockYou2024", date: "2024-06-01", severity: "critical" },
  { breach: "Facebook 2019", date: "2019-09-28", severity: "high" },
];

const DOMAIN_LABELS = {
  spf: "SPF record",
  dkim: "DKIM signing",
  dmarc: "DMARC policy",
  ssl: "SSL certificate",
  dnssec: "DNSSEC",
};

const hash = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0);

export const validateEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
export const validateDomain = (d) => /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(d);

export function scoreStatus(score) {
  if (score >= 80) return { key: "green", label: "Good" };
  if (score >= 60) return { key: "amber", label: "Needs attention" };
  return { key: "red", label: "At risk" };
}

function emailFindings(email) {
  const count = hash(email) % 3;
  const breaches = BREACH_POOL.slice(0, count).map((b) => ({ ...b, email }));
  const score = Math.max(45, 100 - count * 18);
  return {
    score,
    breaches,
    checks: [
      {
        label: "Known data breaches",
        status: count > 0 ? "fail" : "pass",
      },
    ],
    recommendations: [
      ...(count > 0
        ? [{ priority: "critical", title: `Reset ${count} compromised password(s)`, detail: `${email} was found in known data breaches. Change your password immediately.` }]
        : []),
      { priority: "high", title: "Enable MFA on this account", detail: "Multi-factor authentication stops most automated account attacks." },
      { priority: "medium", title: "Use a unique password", detail: "Never reuse passwords across different platforms." },
      { priority: "low", title: "Set up a breach alert", detail: "Monitor this email for future breach notifications." },
    ],
  };
}

function domainFindings(domain) {
  const h = hash(domain);
  const hasDmarc = h % 3 === 0;
  const hasDkim = h % 2 === 0;
  const issues = (hasDmarc ? 0 : 1) + (hasDkim ? 0 : 1) + 1;
  const score = Math.max(40, 100 - issues * 14);
  const domainChecks = {
    spf: { status: "pass" },
    dkim: { status: hasDkim ? "pass" : "fail" },
    dmarc: { status: hasDmarc ? "pass" : "fail" },
    ssl: { status: "pass" },
    dnssec: { status: "warning" },
  };
  return {
    score,
    domainChecks,
    checks: Object.entries(domainChecks).map(([key, v]) => ({
      label: DOMAIN_LABELS[key],
      status: v.status,
    })),
    recommendations: [
      ...(!hasDmarc ? [{ priority: "critical", title: "Configure DMARC policy", detail: "No DMARC record found, so anyone can spoof your email domain." }] : []),
      ...(!hasDkim ? [{ priority: "high", title: "Enable DKIM signing", detail: "DKIM is missing. Enable it in your DNS and email provider settings." }] : []),
      { priority: "medium", title: "Configure DNSSEC", detail: "Prevents DNS hijacking attacks on your domain." },
      { priority: "low", title: "Schedule a full security audit", detail: "Review all DNS records and SSL certificate renewal dates." },
    ],
  };
}

/** Runs the simulated scan and returns one history record. */
export function runDemoScan({ mode, email, domain }) {
  const parts = [];
  let breaches = [];
  let domainChecks = null;
  let recommendations = [];
  let score;

  if (mode === "email" || mode === "both") {
    const e = emailFindings(email);
    parts.push(...e.checks);
    breaches = e.breaches;
    recommendations.push(...e.recommendations);
    score = e.score;
  }
  if (mode === "domain" || mode === "both") {
    const d = domainFindings(domain);
    parts.push(...d.checks);
    domainChecks = d.domainChecks;
    recommendations.push(...d.recommendations);
    score = mode === "both" ? Math.round((score + d.score) / 2) : d.score;
  }

  recommendations = recommendations.filter(
    (r, i, arr) => arr.findIndex((x) => x.title === r.title) === i,
  );

  const domainFails = domainChecks
    ? Object.values(domainChecks).filter((v) => v.status === "fail").length
    : 0;

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: mode,
    email: mode === "domain" ? null : email,
    domain: mode === "email" ? null : domain,
    score,
    breaches,
    domainChecks,
    checks: parts,
    recommendations,
    threats: breaches.length + domainFails,
    date: new Date().toISOString(),
    source: "simulated",
  };
}

/** Percent split of a record's checks: pass / warning / fail. */
export function checkSplit(record) {
  const total = record.checks.length || 1;
  const count = (s) => record.checks.filter((c) => c.status === s).length;
  return {
    secure: Math.round((count("pass") / total) * 100),
    risk: Math.round((count("warning") / total) * 100),
    critical: Math.round((count("fail") / total) * 100),
  };
}

export function toCsv(history) {
  // Cells starting with = + - @ or a tab/CR can run as formulas in Excel or Sheets.
  // Prefix those with an apostrophe so the value is read as plain text.
  const safe = (v) => {
    const text = String(v ?? "");
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  };
  const esc = (v) => `"${safe(v).replace(/"/g, '""')}"`;
  const rows = [["Date (WAT)", "Type", "Target", "Score", "Threats", "Source"]];
  for (const r of history) {
    rows.push([
      new Date(r.date).toLocaleString("en-GB", { timeZone: "Africa/Lagos" }),
      TYPE_LABEL[r.type],
      r.email || r.domain,
      r.score,
      r.threats,
      r.source,
    ]);
  }
  return rows.map((row) => row.map(esc).join(",")).join("\n");
}
