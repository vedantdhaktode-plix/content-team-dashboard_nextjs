import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";
import { mapTask } from "@/lib/workflow/data";

const schema = z.object({ liveUrl: z.string().url().startsWith("https://"), comment: z.string().max(4000).optional().default("") });

export async function POST(request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError("A valid HTTPS live URL is required");
  const { data, error } = await supabase.rpc("record_go_live", { p_task_id: id, p_live_url: parsed.data.liveUrl, p_comment: parsed.data.comment });
  if (error) return apiError(error);
  return NextResponse.json({ task: mapTask(data) });
}
