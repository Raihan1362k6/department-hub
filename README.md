# Department Hub

A responsive department portal built with Next.js, TypeScript and Supabase. It includes an attractive dashboard, semester/subject material library, file and lecture-link sharing, announcements, a private assignment tracker, and role management.

## Included

- Responsive UI with subtle motion, hover states, modal forms and mobile navigation.
- Student / class monitor / admin roles.
- Supabase Auth email/password signup and login.
- Approved email-domain check in the signup UI and database trigger.
- Notes upload (PDF/JPG/PNG/WebP, max 15 MB) and YouTube/NPTEL link sharing.
- PYQ library organized by semester and course, with file-only sharing for admins and monitors.
- Announcements ordered newest-first; assignments ordered by due date, with create/edit/delete controls for admins and monitors.
- Per-student assignment completion rows protected by RLS.
- Admin member list and role promotion/demotion.
- Demo content in preview mode before Supabase is configured.

## 1. Requirements

- Node.js 18.17+ (Node 20 LTS recommended)
- A Supabase project

## 2. Install

```bash
npm install
cp .env.example .env.local
```

Fill `.env.local` with your Supabase project URL, anon/public key, department name, college name, and the approved email domain.

Example:
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEPARTMENT_NAME=Computer Science & Engineering
NEXT_PUBLIC_COLLEGE_NAME=Example College
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=example.edu
```

Do not put a Supabase service-role key in a browser app or commit `.env.local`.
To enable permanent member removal, set `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` using the Supabase project service-role key (or keep an existing server-only `SUPABASE_SECRET_KEY`). These keys must never be exposed with a `NEXT_PUBLIC_` prefix.

## 3. Configure Supabase

1. Open your Supabase project → SQL Editor.
2. Open `supabase/schema.sql`.
3. Replace the fallback `college.edu` in `handle_new_user()` with your real approved email domain.
4. Run the SQL.
5. In Authentication → URL Configuration, set your local site URL (`http://localhost:3000`) and production URL after deployment.
6. In Authentication → Providers, enable Email. Keep email confirmation enabled.
7. In Authentication → Email Templates, customize the verification email with your college/department name.

If an existing project reports that `public.announcements` is missing, run `supabase/announcements.sql` in the Supabase SQL Editor. The script creates the table and its staff-only row-level security policies and can be safely rerun.

Run `supabase/pyqs.sql` in the SQL Editor after `supabase/schema.sql` to create the PYQ course and file tables with member-read and staff-write policies. Rerun the latest version after updates; it adds Mid-Sem and End-Sem categories, authorizes the fixed Superior Admin identity, and permits monitors/admins to edit or delete any PYQ course or file.

For an existing project, run `supabase/course_syllabi.sql` after `supabase/schema.sql` to add the per-course Syllabus folder and staff-only PDF management policies. Students can view and download each course syllabus; monitors, admins, and the Superior Admin can upload, replace, and delete it.

For an existing project, run `supabase/staff_permissions.sql` in the SQL Editor to restrict material and course changes, uploads, announcements, and assignments to monitors/admins, and member management to admins.

Run `supabase/fixed_admin.sql` in the SQL Editor to promote `2026eeb061.raihan@students.iiests.ac.in` and prevent its role, profile email, or account from being changed or removed. The database role remains `admin` for permission checks, while the app displays it as `Superior Admin`. Fresh installations apply the same protection from `supabase/schema.sql`. Set or reset the account password in Supabase Authentication; do not put production credentials in SQL or client-side code.

The signup form checks the configured domain before sending the request. The database trigger also rejects other domains. Supabase's email-confirmation flow is what grants a verified login session.

## 4. Create the first admin

Register using the first department admin email and verify it. Then run this once in the Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.edu';
```

Replace the email with the actual account. After that, admins can manage roles in the app.

## 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000.

Build check:
```bash
npm run build
```

## 6. Deploy

Deploy to Vercel (or another Next.js host):
1. Import this project repository.
2. Add the same `NEXT_PUBLIC_*` environment variables in project settings.
3. Deploy.
4. Add the production URL to Supabase Auth → URL Configuration.

## Security notes / production checklist

- Row-level security is enabled for every application table. Completion status is readable/writable only by its owner.
- Role updates are limited to admins. Staff-only content creation and moderation are enforced by RLS, not just hidden UI controls.
- Permanent member removal is handled by a server-side endpoint that verifies the caller is an admin; authored announcements or assignments must be reassigned or deleted first.
- The anon key is intended for browser use; never expose a service-role key.
- This starter makes the Storage bucket public so members can open shared files using simple URLs. If your department requires strict file confidentiality, switch the bucket to private and use authenticated downloads or short-lived signed URLs.
- The signup trigger uses a fixed SQL domain value. Update it in `schema.sql` before deployment. For multiple approved domains, adjust the trigger condition to an explicit allowlist.
- Consider requiring college SSO, adding CAPTCHA/rate limits, audit logs for role changes, and a staff approval workflow before real institutional rollout.
- Add content moderation/reporting and backups according to department policy.
- The demo records shown before Supabase is configured are sample UI data, not live department records.

## Project structure

```text
department-hub/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── supabase.ts
├── supabase/
│   └── schema.sql
├── .env.example
├── next.config.mjs
├── package.json
├── tsconfig.json
└── README.md
```

## Current scope

This is a functional starter application, not a hosted production service. Real sign-in, data persistence, uploads and role enforcement become active after you create/configure the Supabase project and deploy the SQL policies. The department name and branding can be changed in the environment variables and UI.
