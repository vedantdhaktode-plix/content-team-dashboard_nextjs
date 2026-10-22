import { NextResponse } from "next/server";

export function apiError(error, status = 400) {
  const message = typeof error === "string" ? error : error?.message || "Request failed";
  return NextResponse.json({ error: message }, { status });
}

export async function requireUser(supabase) {
  if (!supabase) return { error: "Supabase is not configured", status: 503 };
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: "Authentication required", status: 401 };
  return { user: data.user };
}
