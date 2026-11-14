-- Add one PDF syllabus per course and semester to an existing Department Hub database.
-- Run after supabase/schema.sql so public.profiles and public.is_staff() exist.

do $$
begin
  if to_regclass('public.profiles') is null or to_regprocedure('public.is_staff()') is null then
    raise exception 'Run supabase/schema.sql first.';
  end if;
end;
$$;

create table if not exists public.course_syllabi (
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

alter table public.course_syllabi enable row level security;
grant select, insert, update, delete on public.course_syllabi to authenticated;

drop policy if exists "members read course syllabi" on public.course_syllabi;
create policy "members read course syllabi"
  on public.course_syllabi for select to authenticated
  using (true);

drop policy if exists "staff add course syllabi" on public.course_syllabi;
create policy "staff add course syllabi"
  on public.course_syllabi for insert to authenticated
  with check (public.is_staff() and uploader_id = auth.uid());

drop policy if exists "staff update course syllabi" on public.course_syllabi;
create policy "staff update course syllabi"
  on public.course_syllabi for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "staff delete course syllabi" on public.course_syllabi;
create policy "staff delete course syllabi"
  on public.course_syllabi for delete to authenticated
  using (public.is_staff());

notify pgrst, 'reload schema';
