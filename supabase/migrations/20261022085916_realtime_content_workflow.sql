+-- Content workflow backend: authenticated, realtime, and storage-aware.
create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(full_name) between 2 and 120),
  initials text not null check (length(initials) between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team text not null check (team in ('brand', 'content', 'video', 'performance', 'administrator')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_workspace_idx
  on public.workspace_members (user_id, workspace_id);

create table public.tasks (
  id text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  brand text,
  product text not null,
  campaign text,
  brief_type text not null check (brief_type in ('video', 'ai')),
  source_sheet text,
  category text,
  content_type text not null,
  priority text not null check (priority in ('P0', 'P1', 'P2', 'R0')),
  state text not null check (state in (
    'draft', 'social_research', 'script_changes_requested', 'script_approval_pending',
    'editing_queue', 'editing_in_progress', 'approval_pending', 'changes_requested',
    'approved', 'ready_for_performance', 'publishing_in_progress',
    'publishing_failed', 'published', 'on_hold', 'blocked', 'cancelled'
  )),
  summary text,
  platform text,
  target_date date,
  script_owner_id uuid references auth.users(id) on delete set null,
  editor_id uuid references auth.users(id) on delete set null,
  publisher_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_workspace_state_updated_idx
  on public.tasks (workspace_id, state, updated_at desc);
create index tasks_script_owner_idx on public.tasks (script_owner_id) where script_owner_id is not null;
create index tasks_editor_idx on public.tasks (editor_id) where editor_id is not null;
create index tasks_publisher_idx on public.tasks (publisher_id) where publisher_id is not null;

create table public.task_assets (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  asset_type text not null check (asset_type in ('reference', 'script', 'video', 'drive_link', 'live_link')),
  label text not null,
  url text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  status text not null default 'provided' check (status in ('provided', 'pending', 'approved', 'changes_requested', 'live')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint task_assets_location_check check (url is not null or storage_path is not null),
  constraint task_assets_https_check check (url is null or url ~ '^https://')
);

create index task_assets_task_created_idx on public.task_assets (task_id, created_at desc);
create index task_assets_workspace_idx on public.task_assets (workspace_id);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id text not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  approval_type text not null check (approval_type in ('script', 'video', 'publish')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested')),
  requested_by uuid not null references auth.users(id),
  decided_by uuid references auth.users(id),
  request_comment text,
  decision_comment text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint approvals_decision_check check (
    (status = 'pending' and decided_by is null and decided_at is null)
    or (status <> 'pending' and decided_by is not null and decided_at is not null)
  )
);

create unique index approvals_one_pending_type_idx
  on public.approvals (task_id, approval_type) where status = 'pending';
create index approvals_workspace_status_idx
  on public.approvals (workspace_id, status, requested_at desc);
create index approvals_task_idx on public.approvals (task_id);

create table public.task_activity (
  id bigint generated always as identity primary key,
  task_id text not null references public.tasks(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index task_activity_task_created_idx
  on public.task_activity (task_id, created_at desc);
create index task_activity_workspace_created_idx
  on public.task_activity (workspace_id, created_at desc);

create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.workspace_role(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select team from public.workspace_members
  where workspace_id = p_workspace_id
    and (select auth.uid()) is not null
    and user_id = (select auth.uid())
  limit 1;
$$;

revoke all on function private.is_workspace_member(uuid) from public, anon;
revoke all on function private.workspace_role(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.workspace_role(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.profiles enable row level security;
alter table public.workspace_members enable row level security;
alter table public.tasks enable row level security;
alter table public.task_assets enable row level security;
alter table public.approvals enable row level security;
alter table public.task_activity enable row level security;

create policy "profiles_read_workspace_peers" on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.workspace_members mine
    join public.workspace_members peer on peer.workspace_id = mine.workspace_id
    where mine.user_id = (select auth.uid()) and peer.user_id = profiles.id
  )
);

create policy "profiles_insert_self" on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy "profiles_update_self" on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "workspaces_read_members" on public.workspaces
for select to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.workspace_members
    where workspace_id = workspaces.id and user_id = (select auth.uid())
  )
);

create policy "workspaces_create_authenticated" on public.workspaces
for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "workspace_members_read_members" on public.workspace_members
for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy "workspace_members_manage_admin" on public.workspace_members
for all to authenticated
using (
  (select private.workspace_role(workspace_id)) = 'administrator'
  or exists (
    select 1 from public.workspaces
    where id = workspace_members.workspace_id and created_by = (select auth.uid())
  )
)
with check (
  (select private.workspace_role(workspace_id)) = 'administrator'
  or exists (
    select 1 from public.workspaces
    where id = workspace_members.workspace_id and created_by = (select auth.uid())
  )
);

create policy "tasks_read_members" on public.tasks
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members
    where workspace_id = tasks.workspace_id and user_id = (select auth.uid())
  )
);

create policy "tasks_create_brand_admin" on public.tasks
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.workspace_members
    where workspace_id = tasks.workspace_id
      and user_id = (select auth.uid())
      and team in ('brand', 'administrator')
  )
);

create policy "tasks_update_by_workflow_team" on public.tasks
for update to authenticated
using (
  exists (
    select 1 from public.workspace_members
    where workspace_id = tasks.workspace_id
      and user_id = (select auth.uid())
      and (
        team = 'administrator'
        or (team = 'brand' and tasks.state in ('draft', 'script_approval_pending', 'approval_pending', 'approved'))
        or (team = 'content' and tasks.state in ('social_research', 'script_changes_requested', 'script_approval_pending'))
        or (team = 'video' and tasks.state in ('editing_queue', 'editing_in_progress', 'changes_requested'))
        or (team = 'performance' and tasks.state in ('ready_for_performance', 'publishing_in_progress', 'publishing_failed', 'published'))
      )
  )
)
with check (
  exists (
    select 1 from public.workspace_members
    where workspace_id = tasks.workspace_id
      and user_id = (select auth.uid())
      and (
        team = 'administrator'
        or (team = 'brand' and tasks.state in ('draft', 'social_research', 'script_changes_requested', 'editing_queue', 'approval_pending', 'changes_requested', 'ready_for_performance'))
        or (team = 'content' and tasks.state in ('social_research', 'script_changes_requested', 'script_approval_pending'))
        or (team = 'video' and tasks.state in ('editing_queue', 'editing_in_progress', 'approval_pending', 'changes_requested'))
        or (team = 'performance' and tasks.state in ('ready_for_performance', 'publishing_in_progress', 'publishing_failed', 'published', 'changes_requested'))
      )
  )
);

create policy "task_assets_read_members" on public.task_assets
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members
    where workspace_id = task_assets.workspace_id and user_id = (select auth.uid())
  )
);

create policy "task_assets_create_members" on public.task_assets
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.workspace_members
    where workspace_id = task_assets.workspace_id and user_id = (select auth.uid())
  )
);

create policy "task_assets_update_own_or_admin" on public.task_assets
for update to authenticated
using (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.workspace_members
    where workspace_id = task_assets.workspace_id
      and user_id = (select auth.uid()) and team = 'administrator'
  )
)
with check (
  created_by = (select auth.uid())
  or exists (
    select 1 from public.workspace_members
    where workspace_id = task_assets.workspace_id
      and user_id = (select auth.uid()) and team = 'administrator'
  )
);

create policy "approvals_read_members" on public.approvals
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members
    where workspace_id = approvals.workspace_id and user_id = (select auth.uid())
  )
);

create policy "approvals_create_members" on public.approvals
for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and exists (
    select 1 from public.workspace_members
    where workspace_id = approvals.workspace_id and user_id = (select auth.uid())
  )
);

create policy "approvals_decide_brand_admin" on public.approvals
for update to authenticated
using (
  exists (
    select 1 from public.workspace_members
    where workspace_id = approvals.workspace_id
      and user_id = (select auth.uid()) and team in ('brand', 'administrator')
  )
)
with check (
  decided_by = (select auth.uid())
  and exists (
    select 1 from public.workspace_members
    where workspace_id = approvals.workspace_id
      and user_id = (select auth.uid()) and team in ('brand', 'administrator')
  )
);

create policy "activity_read_members" on public.task_activity
for select to authenticated
using (
  exists (
    select 1 from public.workspace_members
    where workspace_id = task_activity.workspace_id and user_id = (select auth.uid())
  )
);

create policy "activity_create_members" on public.task_activity
for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and exists (
    select 1 from public.workspace_members
    where workspace_id = task_activity.workspace_id and user_id = (select auth.uid())
  )
);

create or replace function public.submit_script(
  p_task_id text,
  p_script_url text,
  p_comment text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if p_script_url !~ '^https://docs\.google\.com/document/' then
    raise exception 'A valid Google Docs document URL is required';
  end if;

  update public.tasks
  set state = 'script_approval_pending', updated_at = now()
  where id = p_task_id
    and state in ('social_research', 'script_changes_requested')
  returning * into v_task;

  if not found then
    raise exception 'Task is not available for script submission';
  end if;

  insert into public.task_assets (
    task_id, workspace_id, asset_type, label, url, status, created_by
  ) values (
    v_task.id, v_task.workspace_id, 'script', 'Google Docs script',
    p_script_url, 'pending', (select auth.uid())
  );

  insert into public.approvals (
    task_id, workspace_id, approval_type, requested_by, request_comment
  ) values (
    v_task.id, v_task.workspace_id, 'script', (select auth.uid()), nullif(trim(p_comment), '')
  )
  on conflict (task_id, approval_type) where status = 'pending'
  do update set
    requested_by = excluded.requested_by,
    request_comment = excluded.request_comment,
    requested_at = now();

  insert into public.task_activity (
    task_id, workspace_id, actor_id, event_type, message,
    metadata
  ) values (
    v_task.id, v_task.workspace_id, (select auth.uid()), 'script_submitted',
    'Submitted the Google Docs script to Brand Team for approval.',
    jsonb_build_object('url', p_script_url, 'comment', p_comment)
  );

  return v_task;
end;
$$;

create or replace function public.bootstrap_workspace(
  p_workspace_name text,
  p_full_name text,
  p_initials text
)
returns public.workspaces
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workspace public.workspaces;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles (id, full_name, initials)
  values ((select auth.uid()), trim(p_full_name), upper(trim(p_initials)))
  on conflict (id) do update set
    full_name = excluded.full_name,
    initials = excluded.initials,
    updated_at = now();

  insert into public.workspaces (name, created_by)
  values (trim(p_workspace_name), (select auth.uid()))
  returning * into v_workspace;

  insert into public.workspace_members (workspace_id, user_id, team)
  values (v_workspace.id, (select auth.uid()), 'administrator');

  return v_workspace;
end;
$$;

create or replace function public.submit_video(
  p_task_id text,
  p_drive_url text,
  p_comment text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if p_drive_url !~ '^https://drive\.google\.com/' then
    raise exception 'A valid Google Drive URL is required';
  end if;

  update public.tasks
  set state = 'approval_pending', updated_at = now()
  where id = p_task_id
    and state in ('editing_queue', 'editing_in_progress', 'changes_requested')
  returning * into v_task;

  if not found then
    raise exception 'Task is not available for video submission';
  end if;

  insert into public.task_assets (
    task_id, workspace_id, asset_type, label, url, status, created_by
  ) values (
    v_task.id, v_task.workspace_id, 'drive_link', 'Completed video',
    p_drive_url, 'pending', (select auth.uid())
  );

  insert into public.approvals (
    task_id, workspace_id, approval_type, requested_by, request_comment
  ) values (
    v_task.id, v_task.workspace_id, 'video', (select auth.uid()), nullif(trim(p_comment), '')
  )
  on conflict (task_id, approval_type) where status = 'pending'
  do update set
    requested_by = excluded.requested_by,
    request_comment = excluded.request_comment,
    requested_at = now();

  insert into public.task_activity (
    task_id, workspace_id, actor_id, event_type, message, metadata
  ) values (
    v_task.id, v_task.workspace_id, (select auth.uid()), 'video_submitted',
    'Submitted the completed video to Brand Team for approval.',
    jsonb_build_object('url', p_drive_url, 'comment', p_comment)
  );

  return v_task;
end;
$$;

create or replace function public.decide_approval(
  p_approval_id uuid,
  p_decision text,
  p_comment text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_approval public.approvals;
  v_task public.tasks;
  v_next_state text;
begin
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Decision must be approved or changes_requested';
  end if;

  update public.approvals
  set status = p_decision,
      decided_by = (select auth.uid()),
      decision_comment = nullif(trim(p_comment), ''),
      decided_at = now()
  where id = p_approval_id and status = 'pending'
  returning * into v_approval;

  if not found then
    raise exception 'Pending approval not found';
  end if;

  v_next_state := case
    when v_approval.approval_type = 'script' and p_decision = 'approved' then 'editing_queue'
    when v_approval.approval_type = 'script' then 'script_changes_requested'
    when v_approval.approval_type = 'video' and p_decision = 'approved' then 'ready_for_performance'
    when v_approval.approval_type = 'video' then 'changes_requested'
    when v_approval.approval_type = 'publish' and p_decision = 'approved' then 'published'
    else 'publishing_failed'
  end;

  update public.tasks
  set state = v_next_state, updated_at = now()
  where id = v_approval.task_id
  returning * into v_task;

  insert into public.task_activity (
    task_id, workspace_id, actor_id, event_type, message, metadata
  ) values (
    v_task.id, v_task.workspace_id, (select auth.uid()), 'approval_decided',
    case when p_decision = 'approved' then 'Approved the ' else 'Requested changes to the ' end
      || v_approval.approval_type || '.',
    jsonb_build_object('approval_id', p_approval_id, 'decision', p_decision, 'comment', p_comment)
  );

  return v_task;
end;
$$;

create or replace function public.record_go_live(
  p_task_id text,
  p_live_url text,
  p_comment text default null
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if p_live_url !~ '^https://' then
    raise exception 'A valid HTTPS live URL is required';
  end if;

  update public.tasks
  set state = 'published', updated_at = now()
  where id = p_task_id
    and state in ('ready_for_performance', 'publishing_in_progress', 'publishing_failed')
  returning * into v_task;

  if not found then
    raise exception 'Task is not available for publishing';
  end if;

  insert into public.task_assets (
    task_id, workspace_id, asset_type, label, url, status, created_by
  ) values (
    v_task.id, v_task.workspace_id, 'live_link', 'Live placement',
    p_live_url, 'live', (select auth.uid())
  );

  insert into public.task_activity (
    task_id, workspace_id, actor_id, event_type, message, metadata
  ) values (
    v_task.id, v_task.workspace_id, (select auth.uid()), 'went_live',
    'Recorded the final Live status.',
    jsonb_build_object('url', p_live_url, 'comment', p_comment)
  );

  return v_task;
end;
$$;

revoke all on function public.submit_script(text, text, text) from public, anon;
revoke all on function public.bootstrap_workspace(text, text, text) from public, anon;
revoke all on function public.submit_video(text, text, text) from public, anon;
revoke all on function public.decide_approval(uuid, text, text) from public, anon;
revoke all on function public.record_go_live(text, text, text) from public, anon;
grant execute on function public.submit_script(text, text, text) to authenticated;
grant execute on function public.bootstrap_workspace(text, text, text) to authenticated;
grant execute on function public.submit_video(text, text, text) to authenticated;
grant execute on function public.decide_approval(uuid, text, text) to authenticated;
grant execute on function public.record_go_live(text, text, text) to authenticated;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.workspaces, public.workspace_members to authenticated;
grant select, insert, update on public.tasks, public.task_assets, public.approvals to authenticated;
grant select, insert on public.task_activity to authenticated;
grant usage, select on sequence public.task_activity_id_seq to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workflow-assets', 'workflow-assets', false, 104857600,
  array['application/pdf', 'video/mp4', 'video/quicktime', 'image/jpeg', 'image/png', 'application/vnd.google-apps.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "workflow_assets_read_members" on storage.objects
for select to authenticated
using (
  bucket_id = 'workflow-assets'
  and exists (
    select 1 from public.workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
      and user_id = (select auth.uid())
  )
);

create policy "workflow_assets_insert_members" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'workflow-assets'
  and owner_id = (select auth.uid()::text)
  and exists (
    select 1 from public.workspace_members
    where workspace_id::text = (storage.foldername(name))[1]
      and user_id = (select auth.uid())
  )
);

create policy "workflow_assets_update_owner" on storage.objects
for update to authenticated
using (
  bucket_id = 'workflow-assets' and owner_id = (select auth.uid()::text)
)
with check (
  bucket_id = 'workflow-assets' and owner_id = (select auth.uid()::text)
);

create policy "workflow_assets_delete_owner_or_admin" on storage.objects
for delete to authenticated
using (
  bucket_id = 'workflow-assets'
  and (
    owner_id = (select auth.uid()::text)
    or exists (
      select 1 from public.workspace_members
      where workspace_id::text = (storage.foldername(name))[1]
        and user_id = (select auth.uid())
        and team = 'administrator'
    )
  )
);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_assets'
  ) then
    alter publication supabase_realtime add table public.task_assets;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'approvals'
  ) then
    alter publication supabase_realtime add table public.approvals;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'task_activity'
  ) then
    alter publication supabase_realtime add table public.task_activity;
  end if;
end $$;
