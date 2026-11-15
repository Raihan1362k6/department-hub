-- Run this in the Supabase Dashboard -> SQL Editor.
-- It adds the extended metadata columns the Study Materials feature saves
-- (without them, the first insert attempt fails and the code relies on a
-- narrower fallback insert that loses category/file metadata).

alter table public.materials
  add column if not exists course_name text,
  add column if not exists category text,
  add column if not exists file_name text;

-- Backfill: keep course_name consistent with subject for existing rows.
update public.materials
set course_name = subject
where course_name is null;

-- Keep row-level security consistent with the base schema.
drop policy if exists "Allow public read access to materials" on public.materials;
create policy "Allow public read access to materials"
  on public.materials for select
  using (true);

drop policy if exists "Allow authenticated staff to insert materials" on public.materials;
create policy "Allow authenticated staff to insert materials"
  on public.materials for insert
  to authenticated
  with check (uploader_id = auth.uid());

drop policy if exists "Allow authenticated staff to update materials" on public.materials;
create policy "Allow authenticated staff to update materials"
  on public.materials for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Allow authenticated staff to delete materials" on public.materials;
create policy "Allow authenticated staff to delete materials"
  on public.materials for delete
  to authenticated
  using (true);
