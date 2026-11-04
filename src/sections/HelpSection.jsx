import Icon from "../components/Icon.jsx";
import { SUPPORT_EMAIL } from "../lib/config.js";

const FAQ = [
  {
    q: "What is APA SHIELD?",
    a: "APA SHIELD checks email addresses and domains for security risks and can notify you about new breaches. Scans in this version are simulated demo results, so they show how reports look, not real findings about your accounts.",
  },
  {
    q: "How do alerts work?",
    a: "You can save alert rules for each monitored address or domain on the Alerts page. Alerts aren't sent yet, because the alert service isn't connected in this version.",
  },
  {
    q: "Why does my address say Pending?",
    a: "New addresses stay pending until they're verified. Verification emails aren't connected in this version, so no address can be verified yet and no alerts will be sent to it.",
  },
  {
    q: "Is my information safe?",
    a: "We store the addresses you add, your alert preferences and rules, and your account details. Each account can only see its own data. Passwords are handled by the account service, and APA SHIELD never shows them.",
  },
  {
    q: "How do I delete my account?",
    a: "Go to Settings, open Delete account, type DELETE to confirm, and select Delete account. This removes your account, monitored addresses, preferences and alert rules. It can't be undone.",
  },
  {
    q: "How do I sign out of every device?",
    a: "Go to Settings and select Sign out everywhere. This ends your session on all devices, including the one you're using.",
  },
];

export default function HelpSection() {
  return (
    <section className="stack-lg">
      <div className="page-head">
        <h2>Help &amp; Support</h2>
        <p className="muted">Answers to common questions, and how to reach our team.</p>
      </div>

      <div className="grid-2">
        <section className="card">
          <h3>Frequently asked questions</h3>
          <div className="faq">
            {FAQ.map((item) => (
              <details key={item.q} className="faq-item">
                <summary>{item.q}</summary>
                <p className="muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="card">
          <h3>Contact support</h3>
          {SUPPORT_EMAIL ? (
            <>
              <p className="muted">Email us and include the address or domain you're asking about. Don't send passwords.</p>
              <a className="btn btn-primary btn-block" href={`mailto:${SUPPORT_EMAIL}?subject=APA%20SHIELD%20support`}>
                <Icon name="mail" size={18} /> Email support
              </a>
            </>
          ) : (
            <div className="notice notice-info">
              <span>
                The support email isn't set up yet. Add <code>VITE_SUPPORT_EMAIL</code> to{" "}
                <code>.env.local</code> to show it here.
              </span>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
