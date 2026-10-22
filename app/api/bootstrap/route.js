import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";

const schema = z.object({
  workspaceName: z.string().trim().min(2).max(120),
  fullName: z.string().trim().min(2).max(120),
  initials: z.string().trim().min(1).max(4),
});

export async function POST(request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid setup details");
  const { data, error } = await supabase.rpc("bootstrap_workspace", {
    p_workspace_name: parsed.data.workspaceName,
    p_full_name: parsed.data.fullName,
    p_initials: parsed.data.initials,
  });
  if (error) return apiError(error);
  return NextResponse.json({ workspace: data }, { status: 201 });
}
