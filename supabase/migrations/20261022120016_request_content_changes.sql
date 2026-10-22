create or replace function public.request_script_changes(
  p_task_id text,
  p_comment text
)
returns public.tasks
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.tasks;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_comment), '') is null then
    raise exception 'Change request comments are required';
  end if;

  update public.tasks
  set state = 'script_changes_requested', updated_at = now()
  where id = p_task_id
    and state in ('social_research', 'script_changes_requested')
  returning * into v_task;

  if not found then
    raise exception 'Task is not available for a change request';
  end if;

  insert into public.task_activity (
    task_id, workspace_id, actor_id, event_type, message, metadata
  ) values (
    v_task.id,
    v_task.workspace_id,
    (select auth.uid()),
    'content_change_requested',
    format('Requested changes from Brand Team: %s', trim(p_comment)),
    jsonb_build_object('comment', trim(p_comment))
  );

  return v_task;
end;
$$;

revoke execute on function public.request_script_changes(text, text) from public, anon;
grant execute on function public.request_script_changes(text, text) to authenticated;
