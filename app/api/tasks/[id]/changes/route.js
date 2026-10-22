import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";
import { mapTask, taskSelect } from "@/lib/workflow/data";

const schema = z.object({
  comment: z.string().trim().min(1, "Change request comments are required").max(4000),
});

export async function POST(request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Change request comments are required");

  const { error } = await supabase.rpc("request_script_changes", {
    p_task_id: id,
    p_comment: parsed.data.comment,
  });
  if (error) return apiError(error);

  const { data: task, error: readError } = await supabase.from("tasks").select(taskSelect).eq("id", id).single();
  if (readError) return apiError(readError);
  return NextResponse.json({ task: mapTask(task) });
}
