import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy Policy | IIEST EE'30",
  description:
    "How IIEST EE'30 collects, uses and protects student information, including data received from Google APIs.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="23 November 2026">
      <p>
        {"IIEST EE'30"} (&ldquo;the hub&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a student-run website for the Electrical
        Engineering batch of 2030 at IIEST Shibpur. It is not an official IIEST Shibpur platform. This page explains
        what we store, why we store it, who can see it, and how you can have it removed.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <b>Account details</b> — your full name, college email address (<i>@students.iiests.ac.in</i>), role
          (student, monitor or admin), semester and the date the account was created.
        </li>
        <li>
          <b>Password</b> — handled entirely by Supabase Auth. Passwords are hashed and are never visible to us, to
          admins, or to anyone else using the site.
        </li>
        <li>
          <b>Content you post</b> — titles and descriptions of study material, subject folders, previous-year question
          papers, syllabus files, announcements, assignments and the files attached to them, plus assignment
          completion ticks.
        </li>
        <li>
          <b>Basic technical data</b> — the date an item was uploaded or edited, and the account that uploaded it.
          We do not run advertising or analytics trackers.
        </li>
      </ul>

      <h2>2. Signing in with Google</h2>
      <p>
        If you choose &ldquo;Continue with Google&rdquo;, Google shares your name, primary email address and basic
        profile information (such as your profile picture) with us. We only accept Google accounts that belong to
        the same college domain; any other Google account is rejected and no profile is created. We do not receive
        your Google password, contacts, calendar, Gmail, or any other Google data through sign-in.
      </p>

      <h2>3. Files stored in Google Drive</h2>
      <p>
        Uploaded study material is kept in a private Google Drive folder owned by the hub&rsquo;s own Google account,
        not in your personal Drive. The website server accesses only that single folder, using credentials stored as
        encrypted environment variables on our hosting provider. Nobody outside the hub gains access to that Google
        account&rsquo;s other files through this site.
      </p>
      <div className="legal-note">
        <p>
          {"IIEST EE'30"}&rsquo;s use of information received from Google APIs adheres to the{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. We do not use Google user data for advertising, we do not sell
          it, and we do not transfer it to third parties except as necessary to run the features described above.
        </p>
      </div>

      <h2>4. Cookies and local storage</h2>
      <p>
        We store a sign-in session token in your browser&rsquo;s local storage so you stay logged in, and a small
        preference value for light or dark mode. There are no advertising, tracking or third-party analytics cookies.
        Signing out clears the session from your browser.
      </p>

      <h2>5. How we use your information</h2>
      <ul>
        <li>To create and secure your account and let you sign in.</li>
        <li>To show material relevant to your semester, and to attribute uploads to the right person.</li>
        <li>To let monitors and admins moderate content and manage the batch member list.</li>
        <li>To keep the site working, prevent abuse, and fix faults.</li>
      </ul>

      <h2>6. Who can see your information</h2>
      <p>
        Your name, email, semester and role are visible to signed-in batch members where the interface shows them
        (for example the member list). Files and posts you publish are visible to signed-in batch members. Admins and
        monitors can see the uploader of each item so they can moderate it. We never publish your information
        publicly, and no part of the hub is indexed by search engines.
      </p>

      <h2>7. Service providers</h2>
      <ul>
        <li><b>Supabase</b> — database and authentication.</li>
        <li><b>Vercel</b> — website hosting.</li>
        <li><b>Google</b> — Drive storage and optional Google sign-in.</li>
      </ul>
      <p>
        These providers process data on our behalf and have their own privacy policies. We do not sell your data,
        and we do not share it for advertising.
      </p>

      <h2>8. Security</h2>
      <p>
        The site runs over HTTPS. Database access is restricted row-by-row so that only signed-in batch members can
        read batch content, and administrative keys are kept server-side and never sent to browsers. No system is
        perfectly secure, so please use a unique password and tell us immediately if you suspect your account has
        been accessed by someone else.
      </p>

      <h2>9. Keeping and deleting data</h2>
      <p>
        Account details and uploads are kept while the hub is running and useful to the batch. You can ask us to
        delete your account, your profile details and the items you uploaded at any time by writing to the contact
        address below; we will act within a reasonable period. Some material may be retained if it has become part
        of the shared study archive, and we will tell you if that is the case before deleting anything.
      </p>

      <h2>10. Your choices</h2>
      <ul>
        <li>Ask for a copy of the profile information we hold about you.</li>
        <li>Ask us to correct your name, semester or role.</li>
        <li>Ask us to delete your account and content.</li>
        <li>Delete a file or post yourself, where the interface allows it.</li>
      </ul>

      <h2>11. Children</h2>
      <p>
        The hub is intended for students of the IIEST Shibpur Electrical Engineering batch of 2030 and is not
        directed at children under 13. Accounts are created only with a college email address.
      </p>

      <h2>12. Changes to this policy</h2>
      <p>
        If this policy changes, the &ldquo;last updated&rdquo; date at the top of this page will change as well.
        Continued use of the hub after an update means you accept the revised policy.
      </p>

      <h2>13. Contact</h2>
      <p>
        Questions, corrections or deletion requests:{" "}
        <a href="mailto:2026eeb061.raihan@students.iiests.ac.in">2026eeb061.raihan@students.iiests.ac.in</a>.
      </p>
    </LegalShell>
  );
}
