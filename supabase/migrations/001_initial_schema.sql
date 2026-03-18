-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create status enum
create type project_status as enum (
  'draft',
  'extracting',
  'review',
  'generating',
  'complete',
  'archived'
);

-- Create projects table
create table if not exists projects (
  id              uuid primary key default uuid_generate_v4(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text not null,
  status          project_status not null default 'draft',
  bid_deadline    timestamptz,
  source_url      text,
  extracted_data  jsonb,
  source_files    text[],
  output_files    jsonb,
  social_copy     jsonb,
  internal_notes  text,
  team_tips       jsonb,
  client_contacts jsonb
);

-- Enable Row Level Security
alter table projects enable row level security;

-- RLS policy: users can only see their own projects
create policy "Users can view their own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- Index for faster user queries
create index projects_user_id_idx on projects(user_id);
create index projects_status_idx on projects(status);
create index projects_bid_deadline_idx on projects(bid_deadline);

-- Storage bucket for project source files
insert into storage.buckets (id, name, public)
  values ('project-files', 'project-files', false)
  on conflict (id) do nothing;

-- Storage RLS policies
create policy "Users can upload their own project files"
  on storage.objects for insert
  with check (
    bucket_id = 'project-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own project files"
  on storage.objects for select
  using (
    bucket_id = 'project-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete their own project files"
  on storage.objects for delete
  using (
    bucket_id = 'project-files'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
