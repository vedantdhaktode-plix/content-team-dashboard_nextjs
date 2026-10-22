import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";
import { mapTask, taskSelect } from "@/lib/workflow/data";

const updateSchema = z.object({
  scriptOwnerId: z.string().uuid().nullable().optional(),
  editorId: z.string().uuid().nullable().optional(),
  publisherId: z.string().uuid().nullable().optional(),
  state: z.enum(["social_research", "script_changes_requested", "script_approval_pending", "editing_queue", "editing_in_progress", "approval_pending", "changes_requested", "ready_for_performance", "publishing_in_progress", "publishing_failed", "published", "on_hold"]).optional(),
});

export async function PATCH(request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid update");
  const input = parsed.data;
  const update = { updated_at: new Date().toISOString() };
  if ("scriptOwnerId" in input) update.script_owner_id = input.scriptOwnerId;
  if ("editorId" in input) update.editor_id = input.editorId;
  if ("publisherId" in input) update.publisher_id = input.publisherId;
  if (input.state) update.state = input.state;
  const { data, error } = await supabase.from("tasks").update(update).eq("id", id).select(taskSelect).single();
  if (error) return apiError(error);
  return NextResponse.json({ task: mapTask(data) });
}
