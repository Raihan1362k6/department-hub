-- Department Hub database schema. Run in Supabase SQL Editor.
-- IMPORTANT: Change the domain below to your college's approved email domain.
create extension if not exists pgcrypto;

create type public.member_role as enum ('student', 'monitor', 'admin');
create type public.material_kind as enum ('file', 'link');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.member_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.course_folders (
  id uuid primary key default gen_random_uuid(),
  semester int not null check (semester between 1 and 8),
  name text not null,
  created_at timestamptz not null default now(),
  unique (semester, name)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  semester int not null check (semester between 1 and 8),
  subject text not null,
  kind public.material_kind not null,
  url text not null,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.course_syllabi (
  id uuid primary key default gen_random_uuid(),
  semester int not null check (semester between 1 and 8),
  subject text not null,
  file_name text not null,
  url text not null,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (semester, subject)
);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  important boolean not null default false,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  subject text not null,
  due_date date not null,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.assignment_completions (
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, student_id)
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = '2026eeb061.raihan@students.iiests.ac.in'
    or exists (
      select 1 from profiles
      where id = auth.uid() and role in ('monitor', 'admin')
    );
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = '2026eeb061.raihan@students.iiests.ac.in'
    or exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    );
$$;

-- Create a profile after verified signup. Domain allowlist is enforced server-side too.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare allowed_domain text := lower(coalesce(current_setting('app.settings.allowed_email_domain', true), 'students.iiests.ac.in'));
begin
  if lower(split_part(new.email, '@', 2)) <> allowed_domain then
    raise exception 'Only approved department email addresses may register';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'full_name',
    case
      when lower(new.email) = '2026eeb061.raihan@students.iiests.ac.in' then 'admin'::public.member_role
      else 'student'::public.member_role
    end
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.protect_fixed_admin_profile()
returns trigger
language plpgsql
set search_path = public
as $$
declare fixed_admin_email constant text := '2026eeb061.raihan@students.iiests.ac.in';
begin
  if tg_op = 'DELETE' then
    if lower(old.email) = fixed_admin_email then
      raise exception 'The fixed admin account cannot be removed';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
    and lower(old.email) = fixed_admin_email
    and lower(new.email) <> fixed_admin_email then
    raise exception 'The fixed admin account email cannot be changed';
  end if;

  if lower(new.email) = fixed_admin_email and new.role <> 'admin' then
    raise exception 'The fixed admin account must remain an admin';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_fixed_admin_profile on public.profiles;
create trigger protect_fixed_admin_profile
before insert or update or delete on public.profiles
for each row execute procedure public.protect_fixed_admin_profile();

alter table public.profiles enable row level security;
alter table public.course_folders enable row level security;
alter table public.materials enable row level security;
alter table public.course_syllabi enable row level security;
alter table public.announcements enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_completions enable row level security;

-- Authenticated department members only. Profiles are readable by members; only admins change roles.
create policy "members can read profiles" on public.profiles for select to authenticated using (true);
create policy "admins update profiles" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "members read course_folders" on public.course_folders for select to authenticated using (true);
create policy "staff manage course_folders" on public.course_folders for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "members read materials" on public.materials for select to authenticated using (true);
create policy "staff upload materials" on public.materials for insert to authenticated with check (public.is_staff() and uploader_id = auth.uid());
create policy "staff update materials" on public.materials for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete materials" on public.materials for delete to authenticated using (public.is_staff());
grant select, insert, update, delete on public.course_syllabi to authenticated;
create policy "members read course syllabi" on public.course_syllabi for select to authenticated using (true);
create policy "staff add course syllabi" on public.course_syllabi for insert to authenticated with check (public.is_staff() and uploader_id = auth.uid());
create policy "staff update course syllabi" on public.course_syllabi for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete course syllabi" on public.course_syllabi for delete to authenticated using (public.is_staff());
create policy "members read announcements" on public.announcements for select to authenticated using (true);
create policy "staff post announcements" on public.announcements for insert to authenticated with check (public.is_staff() and author_id = auth.uid());
create policy "staff update announcements" on public.announcements for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete announcements" on public.announcements for delete to authenticated using (public.is_staff());
create policy "members read assignments" on public.assignments for select to authenticated using (true);
create policy "staff post assignments" on public.assignments for insert to authenticated with check (public.is_staff() and author_id = auth.uid());
create policy "staff update assignments" on public.assignments for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff delete assignments" on public.assignments for delete to authenticated using (public.is_staff());
create policy "students read own completion" on public.assignment_completions for select to authenticated using (student_id = auth.uid());
create policy "students create own completion" on public.assignment_completions for insert to authenticated with check (student_id = auth.uid());
create policy "students update own completion" on public.assignment_completions for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());
create policy "students delete own completion" on public.assignment_completions for delete to authenticated using (student_id = auth.uid());

-- Storage bucket for PDFs, Word DOCX, presentations and notes (25 MB limit).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'department-files',
  'department-files',
  true,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update set file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "members upload department files" on storage.objects;
drop policy if exists "authenticated upload department files" on storage.objects;
drop policy if exists "staff upload department files" on storage.objects;
create policy "staff upload department files" on storage.objects for insert to authenticated
with check (bucket_id='department-files' and public.is_staff());
drop policy if exists "staff update department files" on storage.objects;
create policy "staff update department files" on storage.objects for update to authenticated
using (bucket_id='department-files' and public.is_staff())
with check (bucket_id='department-files' and public.is_staff());

drop policy if exists "members read department files" on storage.objects;
drop policy if exists "anyone read department files" on storage.objects;
create policy "anyone read department files" on storage.objects for select to public
using (bucket_id='department-files');

drop policy if exists "staff delete department files" on storage.objects;
create policy "staff delete department files" on storage.objects for delete to authenticated
using (bucket_id='department-files' and public.is_staff());

-- Bootstrap the first admin after creating/verifying the account:
-- The fixed admin email above is promoted automatically.
-- For a different bootstrap admin, update that account's role manually.
