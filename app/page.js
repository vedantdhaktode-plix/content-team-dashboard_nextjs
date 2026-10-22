import ContentDashboard from "@/components/ContentDashboard";
import workbook from "@/data/workbook-data.json";
import fixture from "@/data/mock-data.json";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { mapMembers, mapTask, taskSelect } from "@/lib/workflow/data";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!isSupabaseConfigured()) {
    return <ContentDashboard fixtureTasks={fixture.tasks} workbookTasks={workbook.tasks} users={[...fixture.users, ...workbook.users]} backendEnabled={false} />;
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { count: membershipCount } = await supabase.from("workspace_members").select("workspace_id", { count: "exact", head: true });
  if (!membershipCount) redirect("/setup");
  const [{ data: taskRows, error }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from("tasks").select(taskSelect).order("updated_at", { ascending: false }),
    supabase.from("workspace_members").select("workspace_id,user_id,team"),
    supabase.from("profiles").select("id,full_name,initials"),
  ]);
  if (error) throw new Error(`Could not load workflow data: ${error.message}`);
  return <ContentDashboard fixtureTasks={(taskRows || []).map(mapTask)} workbookTasks={[]} users={mapMembers(members, profiles)} backendEnabled currentUserId={auth.user.id} />;
}
