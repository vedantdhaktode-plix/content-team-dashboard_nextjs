import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";
import { mapMembers, mapTask, taskSelect } from "@/lib/workflow/data";

const createTaskSchema = z.object({
  id: z.string().min(3).max(50),
  workspaceId: z.string().uuid(),
  title: z.string().min(2).max(240),
  product: z.string().min(1).max(240),
  briefType: z.enum(["video", "ai"]),
  contentType: z.string().min(1).max(120),
  priority: z.enum(["P0", "P1", "P2", "R0"]),
  summary: z.string().max(10000).optional().default(""),
  category: z.string().max(120).optional().nullable(),
  targetDate: z.string().date().optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);

  const [{ data: tasks, error }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from("tasks").select(taskSelect).order("updated_at", { ascending: false }),
    supabase.from("workspace_members").select("workspace_id,user_id,team"),
    supabase.from("profiles").select("id,full_name,initials"),
  ]);
  if (error) return apiError(error);
  return NextResponse.json({ tasks: (tasks || []).map(mapTask), users: mapMembers(members, profiles) });
}

export async function POST(request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const parsed = createTaskSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid task");
  const input = parsed.data;
  const { data, error } = await supabase.from("tasks").insert({
    id: input.id, workspace_id: input.workspaceId, title: input.title,
    product: input.product, brief_type: input.briefType,
    source_sheet: input.briefType === "ai" ? "AI Tracker Main" : "Work Plan",
    content_type: input.contentType, priority: input.priority,
    state: "draft", summary: input.summary, category: input.category,
    target_date: input.targetDate, created_by: auth.user.id,
  }).select(taskSelect).single();
  if (error) return apiError(error);
  return NextResponse.json({ task: mapTask(data) }, { status: 201 });
}
