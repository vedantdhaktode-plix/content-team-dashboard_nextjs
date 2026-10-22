import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";

const ALLOWED_TYPES = new Set(["application/pdf", "video/mp4", "video/quicktime", "image/jpeg", "image/png"]);

export async function POST(request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const form = await request.formData();
  const file = form.get("file");
  const taskId = String(form.get("taskId") || "");
  const workspaceId = String(form.get("workspaceId") || "");
  const assetType = String(form.get("assetType") || "video");
  if (!(file instanceof File) || !taskId || !/^[0-9a-f-]{36}$/i.test(workspaceId)) return apiError("File, taskId, and workspaceId are required");
  if (file.size > 100 * 1024 * 1024 || !ALLOWED_TYPES.has(file.type)) return apiError("Unsupported file type or file exceeds 100 MB");
  if (!["reference", "script", "video"].includes(assetType)) return apiError("Invalid asset type");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${workspaceId}/${taskId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from("workflow-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return apiError(uploadError);
  const { data, error } = await supabase.from("task_assets").insert({
    task_id: taskId, workspace_id: workspaceId, asset_type: assetType,
    label: file.name, storage_path: path, mime_type: file.type,
    size_bytes: file.size, created_by: auth.user.id,
  }).select().single();
  if (error) {
    await supabase.storage.from("workflow-assets").remove([path]);
    return apiError(error);
  }
  return NextResponse.json({ asset: data }, { status: 201 });
}
