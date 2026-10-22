import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, requireUser } from "@/lib/workflow/http";

export async function GET(_request, context) {
  const { id } = await context.params;
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if (auth.error) return apiError(auth.error, auth.status);
  const { data: asset, error } = await supabase.from("task_assets").select("id,label,url,storage_path,mime_type,size_bytes").eq("id", id).single();
  if (error) return apiError(error, 404);
  if (asset.url) return NextResponse.json({ asset, url: asset.url });
  const { data, error: signedError } = await supabase.storage.from("workflow-assets").createSignedUrl(asset.storage_path, 300);
  if (signedError) return apiError(signedError);
  return NextResponse.json({ asset, url: data.signedUrl, expiresIn: 300 });
}
