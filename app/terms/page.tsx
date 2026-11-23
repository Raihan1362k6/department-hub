import type { Metadata } from "next";
import LegalShell from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms of Service | IIEST EE'30",
  description:
    "The rules for using the IIEST EE'30 department hub, including accounts, acceptable use and uploaded content.",
  alternates: { canonical: "/terms" },
};

export default function TermsOfServicePage() {
  return (
    <LegalShell title="Terms of Service" updated="23 November 2026">
      <p>
        These terms are the agreement between you and {"IIEST EE'30"} (&ldquo;the hub&rdquo;), a student-run website
        for the Electrical Engineering batch of 2030 at IIEST Shibpur. By creating an account or using the site you
        accept them. If you do not accept them, please do not use the site.
      </p>

      <h2>1. What the hub is</h2>
      <p>
        The hub is a private, non-commercial study space built by students, for students. It is not an official
        service of IIEST Shibpur, the Department of Electrical Engineering, or any university authority, and nothing
        on it should be treated as an official notice, result, schedule or academic record.
      </p>

      <h2>2. Who can use it</h2>
      <p>
        Accounts are limited to students of the IIEST Shibpur Electrical Engineering batch of 2030 who have a working{" "}
        <i>@students.iiests.ac.in</i> address, or a college Google account in that domain. Sign-ups from other email
        domains are rejected. One account per person; do not create accounts for other people or share your login.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>Give accurate details (real name, working college email) and keep them current.</li>
        <li>Choose a password you do not use anywhere else and keep it private.</li>
        <li>You are responsible for anything done through your account.</li>
        <li>Tell an admin immediately if you think someone else has accessed your account.</li>
      </ul>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>
          Upload or share copyrighted textbooks, paid course material, pirated PDFs, or any file you do not have the
          right to distribute.
        </li>
        <li>Upload malware, or files that are illegal, abusive, hateful, harassing or unrelated to coursework.</li>
        <li>
          Upload, generate or share AI-generated non-consensual intimate imagery (AI NCII), sexually explicit content,
          deepfakes, or any synthetic image, audio or video of a real person without their consent.
        </li>
        <li>Attempt to access other members&rsquo; accounts, admin-only features, the database, or the server&rsquo;s credentials.</li>
        <li>Scrape, mirror or bulk-download the archive, or use the site to send spam.</li>
        <li>Interfere with the site&rsquo;s operation, probe it for vulnerabilities without permission, or overload it.</li>
        <li>Post another person&rsquo;s private information without their consent.</li>
      </ul>

      <h2>5. Content you upload</h2>
      <p>
        You keep ownership of what you upload. By posting it you give the hub permission to store, display and let
        other signed-in batch members download it for study purposes. Only upload material you wrote, material you
        have permission to share, or links to legally available resources. Files are stored in the hub&rsquo;s private
        Google Drive folder rather than your own Drive.
      </p>

      <h2>6. Moderation</h2>
      <p>
        Admins and monitors can edit, move, unpublish or delete any item, and can suspend or remove an account, if the
        content breaks these terms, infringes copyright, or is reported as inaccurate or harmful. Where possible we
        will tell you why. Repeated or serious breaches can end your access without notice.
      </p>

      <h2>7. Availability and changes</h2>
      <p>
        The hub is a volunteer project. Features may change, break or be withdrawn, data may need to be reorganised,
        and the site may be offline without notice, especially around exams. We do not guarantee uptime, permanent
        storage, or that any particular file will stay available — keep your own copy of anything important.
      </p>

      <h2>8. No warranty</h2>
      <p>
        The site and all material on it are provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without
        warranties of any kind, express or implied, including accuracy, fitness for a particular purpose and
        non-infringement. Notes and previous-year papers are shared by students and may contain errors — always rely
        on the official syllabus, textbooks and departmental instructions.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, the hub, its student maintainers, admins and monitors are not liable
        for any indirect, incidental or consequential loss, or for any academic, financial or personal loss, arising
        from use of the site, reliance on its content, or loss of uploaded files.
      </p>

      <h2>10. Ending your access</h2>
      <p>
        You may stop using the hub at any time and ask us to delete your account. We may suspend or close an account
        that breaches these terms. Sections about content ownership, moderation, disclaimers and liability survive
        the end of your access.
      </p>

      <h2>11. Copyright complaints</h2>
      <p>
        If you own rights to something posted here and want it removed, write to the contact address with the item
        title and a short description of your rights. We remove or unpublish disputed material promptly.
      </p>

      <h2>12. Google API terms</h2>
      <p>
        The hub uses Google APIs for two optional functions: Google sign-in, and storage of uploaded study files in
        the hub&rsquo;s own Google Drive folder. By using these functions you agree to comply with the{" "}
        <a href="https://developers.google.com/terms" target="_blank" rel="noreferrer">
          Google APIs Terms of Service
        </a>{" "}
        and the{" "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        . The hub uses Google user data only to provide the features described in the Privacy Policy, does not sell it
        or use it for advertising, and does not use Google APIs to create or distribute AI-generated non-consensual
        intimate imagery or any other prohibited content. If you become aware of content on the hub that breaches these
        terms, report it to the contact address below.
      </p>

      <h2>13. Governing law</h2>
      <p>
        These terms are governed by the laws of India, and disputes are subject to the jurisdiction of the courts at
        Howrah / Kolkata, West Bengal.
      </p>

      <h2>14. Contact</h2>
      <p>
        Questions about these terms:{" "}
        <a href="mailto:2026eeb061.raihan@students.iiests.ac.in">2026eeb061.raihan@students.iiests.ac.in</a>.
      </p>
    </LegalShell>
  );
}
