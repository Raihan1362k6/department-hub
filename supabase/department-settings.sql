-- Department settings: shared values that staff (admins, the superior admin and
-- monitors) can change for the whole department, e.g. the current semester.
-- Run in the Supabase SQL Editor.

create table if not exists public.department_settings (
  key text primary key,
  value text not null,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.department_settings enable row level security;

-- Every department member can read the shared settings.
create policy "members read department_settings"
  on public.department_settings for select
  to authenticated
  using (true);

-- Only staff can change them (public.is_staff() covers monitor/admin/superior admin).
create policy "staff manage department_settings"
  on public.department_settings for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Seed the default current semester.
insert into public.department_settings (key, value)
values ('current_semester', '1')
on conflict (key) do nothing;
