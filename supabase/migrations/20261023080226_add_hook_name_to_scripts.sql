alter table public.tasks
  add column hook_name text
  check (hook_name is null or length(trim(hook_name)) between 1 and 200);

drop function public.submit_script(text, text, text);

create function public.submit_script(
  p_task_id text,
  p_hook_name text,
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
  if nullif(trim(p_hook_name), '') is null or length(trim(p_hook_name)) > 200 then
    raise exception 'A Hook Name between 1 and 200 characters is required';
  end if;

  if p_script_url !~ '^https://docs\.google\.com/document/' then
    raise exception 'A valid Google Docs document URL is required';
  end if;

  update public.tasks
  set
    hook_name = trim(p_hook_name),
    state = 'script_approval_pending',
    updated_at = now()
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
    task_id, workspace_id, actor_id, event_type, message, metadata
  ) values (
    v_task.id, v_task.workspace_id, (select auth.uid()), 'script_submitted',
    format('Submitted hook “%s” to Brand Team for approval.', trim(p_hook_name)),
    jsonb_build_object('hook_name', trim(p_hook_name), 'url', p_script_url, 'comment', p_comment)
  );

  return v_task;
end;
$$;

revoke all on function public.submit_script(text, text, text, text) from public, anon;
grant execute on function public.submit_script(text, text, text, text) to authenticated;
