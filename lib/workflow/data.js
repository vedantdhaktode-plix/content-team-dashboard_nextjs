export const CONTENT_STATES = ["social_research", "script_changes_requested", "script_approval_pending"];

export function mapTask(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    brand: row.brand,
    product: row.product,
    campaign: row.campaign,
    briefType: row.brief_type,
    sourceSheet: row.source_sheet,
    category: row.category,
    contentType: row.content_type,
    priority: row.priority,
    state: row.state,
    summary: row.summary,
    platform: row.platform,
    targetDate: row.target_date,
    scriptOwnerId: row.script_owner_id,
    editorId: row.editor_id,
    publisherId: row.publisher_id,
    updatedAt: row.updated_at,
    references: (row.task_assets || []).filter((asset) => ["reference", "script", "drive_link", "live_link"].includes(asset.asset_type)).map((asset) => asset.url).filter(Boolean),
    assets: row.task_assets || [],
    approvals: row.approvals || [],
    activity: (row.task_activity || []).map((item) => ({ at: item.created_at, actor: "Team member", text: item.message, type: item.event_type })),
    deliverables: [],
  };
}

export function mapMembers(members, profiles) {
  const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
  return (members || []).map((member) => {
    const profile = profileMap.get(member.user_id);
    return {
      id: member.user_id,
      name: profile?.full_name || "Team member",
      initials: profile?.initials || "TM",
      role: member.team === "video" ? "edit" : member.team,
      workspaceId: member.workspace_id,
    };
  });
}

export const taskSelect = `
  *,
  task_assets (*),
  approvals (*),
  task_activity (*)
`;
