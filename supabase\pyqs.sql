-- Add the PYQ library to an existing Department Hub database.
-- Run supabase/schema.sql first so public.profiles exists.
create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.profiles') is null then
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

create table if not exists public.pyq_course_folders (
  id uuid primary key default gen_random_uuid(),
  semester int not null check (semester between 1 and 8),
  name text not null,
  created_at timestamptz not null default now(),
  unique (semester, name)
);

create table if not exists public.pyq_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.pyq_course_folders(id) on delete cascade,
  exam_type text not null default 'End-Sem' check (exam_type in ('Mid-Sem', 'End-Sem')),
  title text not null,
  file_name text not null,
  url text not null,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.pyq_materials
  add column if not exists exam_type text not null default 'End-Sem'
  check (exam_type in ('Mid-Sem', 'End-Sem'));

alter table public.pyq_course_folders enable row level security;
alter table public.pyq_materials enable row level security;

grant select, insert, update, delete on public.pyq_course_folders to authenticated;
grant select, insert, update, delete on public.pyq_materials to authenticated;

drop policy if exists "members read pyq courses" on public.pyq_course_folders;
create policy "members read pyq courses"
  on public.pyq_course_folders for select to authenticated
  using (true);

drop policy if exists "staff manage pyq courses" on public.pyq_course_folders;
create policy "staff manage pyq courses"
  on public.pyq_course_folders for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "members read pyq materials" on public.pyq_materials;
create policy "members read pyq materials"
  on public.pyq_materials for select to authenticated
  using (true);

drop policy if exists "staff manage pyq materials" on public.pyq_materials;
drop policy if exists "staff create pyq materials" on public.pyq_materials;
create policy "staff create pyq materials"
  on public.pyq_materials for insert to authenticated
  with check (public.is_staff() and uploader_id = auth.uid());

drop policy if exists "staff update pyq materials" on public.pyq_materials;
create policy "staff update pyq materials"
  on public.pyq_materials for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff delete pyq materials" on public.pyq_materials;
create policy "staff delete pyq materials"
  on public.pyq_materials for delete to authenticated
  using (public.is_staff());

notify pgrst, 'reload schema';
