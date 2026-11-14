-- Repair an existing project when public.announcements has not been created.
-- Run in the Supabase SQL Editor after public.profiles exists.
create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Run supabase/schema.sql first so public.profiles exists.';
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
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('monitor', 'admin')
  );
$$;

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  important boolean not null default false,
  author_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
grant select, insert, update, delete on public.announcements to authenticated;

drop policy if exists "members read announcements" on public.announcements;
create policy "members read announcements"
  on public.announcements for select to authenticated
  using (true);

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

notify pgrst, 'reload schema';
