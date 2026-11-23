import type { ReactNode } from "react";

// Shared shell for the public /privacy and /terms pages. These pages stay
// outside the auth gate so they can be linked from the login screen, from the
// in-app footer, and from the Google OAuth consent screen.
export default function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="legal-page">
      <div className="legal-wrap">
        <a className="legal-head" href="/">
          <img className="legal-logo" src="/icon.png" alt="" width={44} height={44} />
          <span>
            <b>{"IIEST EE'30"}</b>
            <small>ELECTRICAL ENGINEERING, CLASS OF 2030</small>
          </span>
        </a>

        <main className="legal-card">
          <h1>{title}</h1>
          <p className="legal-updated">Last updated: {updated}</p>
          {children}
        </main>

        <div className="legal-foot">
          <span>© 2026 {"IIEST EE'30"} · Student-run department hub</span>
          <span className="legal-links">
            <a href="/">Home</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/terms">Terms of Service</a>
          </span>
        </div>
      </div>
    </div>
  );
}
