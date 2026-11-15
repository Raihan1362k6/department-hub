-- Migration: Add optional PDF attachment columns to public.assignments
alter table public.assignments
  add column if not exists attachment_url text,
  add column if not exists file_name text;
