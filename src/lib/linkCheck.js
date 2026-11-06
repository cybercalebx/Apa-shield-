// Basic link check. It only reads the address; it never opens the link.
// A clean result does NOT prove a link is safe. These are common warning signs.

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rebrand.ly", "buff.ly", "shorturl.at"];

// Brands often copied in phishing links, and the domains they really use.
const BRANDS = [
  { name: "PayPal", token: "paypal", domain: "paypal.com" },
  { name: "Google", token: "google", domain: "google.com" },
  { name: "Microsoft", token: "microsoft", domain: "microsoft.com" },
  { name: "Apple", token: "apple", domain: "apple.com" },
  { name: "Amazon", token: "amazon", domain: "amazon.com" },
  { name: "Netflix", token: "netflix", domain: "netflix.com" },
  { name: "Facebook", token: "facebook", domain: "facebook.com" },
  { name: "Instagram", token: "instagram", domain: "instagram.com" },
  { name: "WhatsApp", token: "whatsapp", domain: "whatsapp.com" },
  { name: "Binance", token: "binance", domain: "binance.com" },
  { name: "DHL", token: "dhl", domain: "dhl.com" },
  { name: "FedEx", token: "fedex", domain: "fedex.com" },
  { name: "MTN", token: "mtn", domain: "mtn.com" },
  { name: "Airtel", token: "airtel", domain: "airtel.com" },
  { name: "OPay", token: "opay", domain: "opay.com" },
  { name: "PalmPay", token: "palmpay", domain: "palmpay.com" },
];

const PHISHING_WORDS = /(login|signin|sign-in|verify|verification|secure|account|update|banking|wallet|password|confirm|suspend|unlock)/i;
const RISKY_TLDS = ["zip", "mov", "xyz", "top", "tk", "ml", "ga", "cf", "gq"];

// Approximates the real domain (e.g. "shop.example.co.za" -> "example.co.za").
function registrable(host) {
  const parts = host.split(".");
  if (parts.length >= 3 && /^(co|com|org|net|gov|edu|ac)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function brandMatch(host) {
  const labels = host.split(/[.-]/);
  return BRANDS.find((b) => (b.token.length >= 6 ? host.includes(b.token) : labels.includes(b.token)));
}

/**
 * Returns { error } for input that isn't a web address, otherwise
 * { host, verdict: "high" | "caution" | "clear", title, findings: [{ level, text }] }.
 */
export function checkLink(raw) {
  let input = (raw || "").trim();
  if (!input) return { error: "Enter a link to check." };
  if (input.length > 2048) return { error: "That link is too long to check." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) input = "https://" + input;

  let url;
  try {
    url = new URL(input);
  } catch {
    return { error: "That doesn't look like a web address. Try a full link such as https://example.com." };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { error: "Only web links (http or https) can be checked." };
  }
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") && !host.includes(":") && host !== "localhost") {
    return { error: "That doesn't look like a web address. Try a full link such as https://example.com." };
  }

  const findings = [];
  const add = (level, text) => findings.push({ level, text });
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");

  if (url.username || url.password || input.slice(url.protocol.length + 2).split("/")[0].includes("@")) {
    add("high", "Contains an '@' sign before the domain. This can hide where the link really goes.");
  }
  if (isIp) add("high", "Uses a raw IP address instead of a website name.");
  if (url.protocol === "http:") add("caution", "Not encrypted (http, not https). Don't enter passwords or payment details on it.");

  const brand = brandMatch(host);
  if (brand && registrable(host) !== brand.domain && !host.endsWith("." + brand.domain)) {
    add("high", `Mentions ${brand.name}, but the domain isn't ${brand.domain}. This is a common phishing pattern.`);
  }
  if (host.includes("xn--")) add("caution", "Uses international characters that can disguise a name.");
  if (SHORTENERS.includes(registrable(host))) add("caution", "Shortened link. The real destination is hidden until you open it.");
  if (PHISHING_WORDS.test(host + url.pathname)) {
    add("caution", "Uses words often seen in phishing links, such as 'login', 'verify' or 'secure'.");
  }
  if (RISKY_TLDS.includes(host.split(".").pop())) add("caution", "Uses a domain ending that is often used for scams.");
  if (host.split(".").length > 4) add("caution", "Has many subdomains, which can be used to imitate a trusted name.");
  if (input.length > 200) add("caution", "Very long link, which can hide the real destination.");

  const verdict = findings.some((f) => f.level === "high") ? "high" : findings.length ? "caution" : "clear";
  const title = {
    high: "High risk: don't open this link",
    caution: "Be careful with this link",
    clear: "No warning signs found",
  }[verdict];
  return { host, verdict, title, findings };
}
