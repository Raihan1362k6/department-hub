-- Restrict department content changes to monitors and admins.
-- Run in the Supabase SQL Editor after supabase/schema.sql.

do $$
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.materials') is null
    or to_regclass('public.course_folders') is null
    or to_regclass('public.announcements') is null
    or to_regclass('public.assignments') is null then
    raise exception 'Run supabase/schema.sql first.';
  end if;
end;
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = '2026eeb061.raihan@students.iiests.ac.in'
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role in ('monitor', 'admin')
    );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = '2026eeb061.raihan@students.iiests.ac.in'
    or exists (
      select 1
      from public.profiles
      where id = auth.uid()
        and role = 'admin'
    );
$$;

alter table public.course_folders enable row level security;
alter table public.materials enable row level security;
alter table public.announcements enable row level security;
alter table public.assignments enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "staff manage course_folders" on public.course_folders;
create policy "staff manage course_folders"
  on public.course_folders for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "members upload materials" on public.materials;
drop policy if exists "staff upload materials" on public.materials;
create policy "staff upload materials"
  on public.materials for insert to authenticated
  with check (public.is_staff() and uploader_id = auth.uid());

drop policy if exists "staff update materials" on public.materials;
create policy "staff update materials"
  on public.materials for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff delete materials" on public.materials;
create policy "staff delete materials"
  on public.materials for delete to authenticated
  using (public.is_staff());

drop policy if exists "staff post announcements" on public.announcements;
create policy "staff post announcements"
  on public.announcements for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());

drop policy if exists "staff update announcements" on public.announcements;
create policy "staff update announcements"
  on public.announcements for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff delete announcements" on public.announcements;
create policy "staff delete announcements"
  on public.announcements for delete to authenticated
  using (public.is_staff());

drop policy if exists "staff post assignments" on public.assignments;
create policy "staff post assignments"
  on public.assignments for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());

drop policy if exists "staff update assignments" on public.assignments;
create policy "staff update assignments"
  on public.assignments for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff delete assignments" on public.assignments;
create policy "staff delete assignments"
  on public.assignments for delete to authenticated
  using (public.is_staff());

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles"
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "members upload department files" on storage.objects;
drop policy if exists "authenticated upload department files" on storage.objects;
drop policy if exists "staff upload department files" on storage.objects;
create policy "staff upload department files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'department-files' and public.is_staff());

drop policy if exists "staff update department files" on storage.objects;
create policy "staff update department files"
  on storage.objects for update to authenticated
  using (bucket_id = 'department-files' and public.is_staff())
  with check (bucket_id = 'department-files' and public.is_staff());

drop policy if exists "staff delete department files" on storage.objects;
create policy "staff delete department files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'department-files' and public.is_staff());

notify pgrst, 'reload schema';
