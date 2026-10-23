import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";
import { mapTask } from "@/lib/workflow/data";

const schema = z.object({
  hookName: z.string().trim().min(1).max(200),
  scriptUrl: z.string().url().startsWith("https://docs.google.com/document/"),
  comment: z.string().max(4000).optional().default(""),
});

export async function POST(request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Hook Name and a valid Google Docs document URL are required");
  const { data, error } = await supabase.rpc("submit_script", { p_task_id: id, p_hook_name: parsed.data.hookName, p_script_url: parsed.data.scriptUrl, p_comment: parsed.data.comment });
  if (error) return apiError(error);
  return NextResponse.json({ task: mapTask(data) });
}
