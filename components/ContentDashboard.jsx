"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell, Check, ChevronDown, CircleHelp, ExternalLink, FileText, LayoutDashboard,
  List, Menu, Plus, Search, Send, Sparkles, Video, X
} from "lucide-react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

const CONTENT_STATES = ["social_research", "script_changes_requested", "script_approval_pending"];
const STORE_KEY = "brand-perf-edit-content-team-v1";
const STATE = {
  social_research: { label: "Script queue", tone: "teal" },
  script_changes_requested: { label: "Script changes", tone: "rose" },
  script_approval_pending: { label: "Brand approval", tone: "amber" },
};
const COLUMNS = [
  ["social_research", "Script queue"],
  ["script_changes_requested", "Script changes"],
  ["script_approval_pending", "Brand approval"],
];

function briefType(task) {
  return task.briefType || (task.sourceSheet === "AI Tracker Main" || task.campaign === "AI Tracker Main" ? "ai" : "video");
}

function sourceSheet(task) {
  return task.sourceSheet || task.source?.sheet || (briefType(task) === "ai" ? "AI Tracker Main" : "Work Plan");
}

function dedupeUsers(users) {
  return [...new Map(users.map((user) => [user.id, user])).values()];
}

function formatDate(value) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function Avatar({ person, small = false }) {
  return <span className={`avatar ${small ? "small" : ""}`}>{person?.initials || "CT"}</span>;
}

function Priority({ value }) {
  return <span className={`priority priority-${String(value).toLowerCase()}`}>{value}</span>;
}

function BriefBadge({ task }) {
  const isAi = briefType(task) === "ai";
  return <span className={`brief-badge ${isAi ? "ai" : "video"}`}>{isAi ? <Sparkles size={12} /> : <Video size={12} />}{isAi ? "AI brief" : "Video brief"}</span>;
}

function Status({ state }) {
  const meta = STATE[state] || { label: state, tone: "gray" };
  return <span className={`status ${meta.tone}`}><i />{meta.label}</span>;
}

function WorkflowGuide() {
  const steps = ["Brand requirements", "Content script", "Brand script approval", "Video production", "Brand video approval", "Perf go-live", "Status Live"];
  return <section className="workflow-guide"><div className="workflow-copy"><strong>How work moves</strong><span>Follow the highlighted step for this team</span></div><ol>{steps.map((step, index) => <li className={index === 1 ? "active" : ""} key={step}><span>{index + 1}</span><b>{step}</b></li>)}</ol></section>;
}

function OwnerSelect({ task, writers, onChange, compact = false }) {
  return <select className={`owner-select ${compact ? "compact" : ""}`} value={task.scriptOwnerId || task.contentOwnerId || ""} onClick={(event) => event.stopPropagation()} onChange={(event) => onChange(task.id, event.target.value)} aria-label={`Assign writer for ${task.title}`}><option value="">Unassigned</option>{writers.map((writer) => <option value={writer.id} key={writer.id}>{writer.name}</option>)}</select>;
}

function TaskCard({ task, writers, users, onOpen, onAssign }) {
  const writer = users.find((person) => person.id === (task.scriptOwnerId || task.contentOwnerId));
  return <button className="task-card" onClick={() => onOpen(task)}><div className="task-card-top"><div className="tag-row"><Priority value={task.priority} /><BriefBadge task={task} /></div><Status state={task.state} /></div><h3>{task.title}</h3><p>{task.product} <i /> {task.category} <i /> {task.contentType}</p><div className="requirement-preview"><b>Brand requirements</b><span>{task.summary || "No additional requirements provided."}</span></div><div className="card-assignment"><span><b>Assigned writer</b><span className="owner"><Avatar person={writer} small />{writer?.name || "Unassigned"}</span></span><OwnerSelect task={task} writers={writers} onChange={onAssign} compact /></div><div className="task-card-foot"><span>{task.id}</span><span>{formatDate(task.targetDate)}</span></div></button>;
}

function Board({ tasks, writers, users, onOpen, onAssign }) {
  return <div className="kanban content-kanban">{COLUMNS.map(([state, label]) => {
    const items = tasks.filter((task) => task.state === state);
    return <section className="kanban-column" key={state}><header><span className={`column-dot ${STATE[state].tone}`} /><strong>{label}</strong><b>{items.length}</b></header><label className="column-search"><Search size={15} /><span>Search {label.toLowerCase()}</span></label><div className="column-cards">{items.map((task) => <TaskCard key={task.id} task={task} writers={writers} users={users} onOpen={onOpen} onAssign={onAssign} />)}{!items.length && <div className="column-empty"><Check size={19} /><span>No tasks here</span></div>}</div></section>;
  })}</div>;
}

function TaskList({ tasks, writers, onOpen, onAssign }) {
  return <section className="task-list panel"><table><thead><tr><th>Task</th><th>Brief</th><th>Writer</th><th>Priority</th><th>Content type</th><th>Target date</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} onClick={() => onOpen(task)}><td><strong>{task.title}</strong><span>{task.id} · {task.product}</span></td><td><BriefBadge task={task} /><span className="source">{sourceSheet(task)}</span></td><td><OwnerSelect task={task} writers={writers} onChange={onAssign} compact /></td><td><Priority value={task.priority} /></td><td>{task.contentType}</td><td>{formatDate(task.targetDate)}</td><td><Status state={task.state} /></td></tr>)}</tbody></table>{!tasks.length && <div className="empty-results"><Search size={22} /><strong>No matching tasks</strong><span>Try another search or clear a filter.</span></div>}</section>;
}

function ScriptForm({ task, onSubmit, inline = false }) {
  const [link, setLink] = useState(task?.scriptLink || "");
  const [comments, setComments] = useState("");
  return <form className={inline ? "script-form inline" : "script-form"} onSubmit={(event) => { event.preventDefault(); onSubmit(task, link, comments); }}><label><span>Google Docs script link</span><input type="url" required value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://docs.google.com/document/d/..." /></label><label><span>Note for Brand <small>(optional)</small></span><input value={comments} onChange={(event) => setComments(event.target.value)} placeholder="What should the approver check?" /></label><button className="button primary" type="submit"><Send size={15} />Send script to Brand Team</button></form>;
}

function Drawer({ task, users, writers, onClose, onAssign, onSubmit }) {
  const [tab, setTab] = useState("overview");
  if (!task) return null;
  const writer = users.find((person) => person.id === (task.scriptOwnerId || task.contentOwnerId));
  return <><button className="drawer-backdrop" onClick={onClose} aria-label="Close task details" /><aside className="drawer"><header className="drawer-head"><div><span className="eyebrow">{task.id} · {task.category}</span><h2>{task.title}</h2><p>{task.contentType} · {task.product}</p></div><button className="close-button" onClick={onClose}><X /></button></header><nav className="drawer-tabs">{["overview", "activity"].map((item) => <button className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item}</button>)}</nav><div className="drawer-body">
    {tab === "overview" && <><section className="detail-section"><div className="section-title"><h3>Script handoff</h3><Status state={task.state} /></div>{task.state === "script_approval_pending" ? <div className="submitted-script"><Check size={18} /><div><strong>Sent for Brand approval</strong>{task.scriptLink ? <a href={task.scriptLink} target="_blank" rel="noreferrer">Open Google Doc <ExternalLink size={13} /></a> : <span>Script link recorded</span>}</div></div> : <ScriptForm task={task} onSubmit={onSubmit} />}</section><section className="detail-section"><div className="section-title"><h3>Requirements from Brand Team</h3><BriefBadge task={task} /></div><p className="summary">{task.summary || "No additional requirements were provided."}</p><div className="deliverables">{(task.deliverables || []).map((item) => <span key={item}><Check size={13} />{item}</span>)}</div></section><section className="detail-section"><div className="section-title"><h3>Assignment</h3></div><div className="detail-grid"><div><label>Content writer</label><OwnerSelect task={task} writers={writers} onChange={onAssign} /></div><div><label>Current owner</label><span className="inline-owner"><Avatar person={writer} small />{writer?.name || "Unassigned"}</span></div><div><label>Priority</label><Priority value={task.priority} /></div><div><label>Target date</label><span>{formatDate(task.targetDate)}</span></div><div><label>Source</label><span>{sourceSheet(task)}</span></div><div><label>Platform</label><span>{task.platform || "Unassigned"}</span></div></div></section><section className="detail-section"><div className="section-title"><h3>References</h3><span className="eyebrow">{(task.references || []).length} attached</span></div><div className="references">{(task.references || []).map((ref, index) => /^https:\/\//i.test(ref) ? <a href={ref} target="_blank" rel="noreferrer" key={`${ref}-${index}`}><ExternalLink size={14} />Open reference</a> : <span key={`${ref}-${index}`}><FileText size={14} />{ref}</span>)}</div></section></>}
    {tab === "activity" && <section className="detail-section"><div className="section-title"><h3>Activity</h3></div>{(task.activity || []).map((item, index) => <article className="activity-row" key={`${item.at}-${index}`}><span className="activity-dot" /><div><strong>{item.actor}</strong><p>{item.text}</p><time>{formatDateTime(item.at)}</time></div></article>)}</section>}
  </div></aside></>;
}

function NewBriefModal({ tasks, onClose, onSubmit }) {
  const eligible = tasks.filter((task) => ["social_research", "script_changes_requested"].includes(task.state));
  const [taskId, setTaskId] = useState(eligible[0]?.id || "");
  const [link, setLink] = useState("");
  const [comments, setComments] = useState("");
  const selected = tasks.find((task) => task.id === taskId);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={(event) => { event.preventDefault(); onSubmit(selected, link, comments); }}><header><div><span className="eyebrow">Content Team</span><h2>Submit a script brief</h2></div><button type="button" className="close-button" onClick={onClose}><X /></button></header><div className="modal-body"><label><span>Brand brief</span><select value={taskId} onChange={(event) => setTaskId(event.target.value)} required>{eligible.map((task) => <option value={task.id} key={task.id}>{task.title} — {task.product}</option>)}</select><small>Select the Brand Team request this script answers.</small></label><label><span>Google Docs link</span><input value={link} onChange={(event) => setLink(event.target.value)} type="url" required placeholder="https://docs.google.com/document/d/..." /></label><label><span>Additional comments</span><textarea value={comments} onChange={(event) => setComments(event.target.value)} placeholder="Add context or instructions for Brand approval" /></label></div><footer><button type="button" className="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={!eligible.length}><Send size={15} />Send script to Brand Team</button></footer></form></div>;
}

export default function ContentDashboard({ fixtureTasks, workbookTasks, users: rawUsers, backendEnabled = false, currentUserId }) {
  const initialTasks = useMemo(() => [...fixtureTasks, ...workbookTasks].filter((task, index, items) => CONTENT_STATES.includes(task.state) && items.findIndex((item) => item.id === task.id) === index), [fixtureTasks, workbookTasks]);
  const users = useMemo(() => dedupeUsers(rawUsers), [rawUsers]);
  const writers = users.filter((person) => person.role === "content");
  const currentUser = users.find((person) => person.id === currentUserId) || users.find((person) => person.id === "usr-himani") || writers[0];
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState(""); const [brief, setBrief] = useState("video"); const [priority, setPriority] = useState("all"); const [status, setStatus] = useState("all"); const [view, setView] = useState("board");
  const [selectedId, setSelectedId] = useState(null); const [modalOpen, setModalOpen] = useState(false); const [notificationsOpen, setNotificationsOpen] = useState(false); const [toast, setToast] = useState(null);

  useEffect(() => { if (backendEnabled) return; try { const saved = JSON.parse(localStorage.getItem(STORE_KEY)); if (Array.isArray(saved)) setTasks(saved); } catch {} }, [backendEnabled]);
  useEffect(() => { if (!backendEnabled) localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); }, [tasks, backendEnabled]);
  useEffect(() => { const handler = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); document.querySelector("#global-search")?.focus(); } if (event.key === "Escape") { setSelectedId(null); setModalOpen(false); } }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);

  useEffect(() => {
    if (!backendEnabled) return;
    const supabase = createSupabaseClient();
    if (!supabase) return;
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(async () => {
        const response = await fetch("/api/tasks", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json();
        setTasks((payload.tasks || []).filter((task) => CONTENT_STATES.includes(task.state)));
      }, 80);
    };
    const channel = supabase.channel("content-workflow-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assets" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "task_activity" }, refresh)
      .subscribe();
    return () => { window.clearTimeout(timer); supabase.removeChannel(channel); };
  }, [backendEnabled]);

  const filtered = useMemo(() => tasks.filter((task) => { const haystack = [task.id, task.title, task.product, task.category, task.contentType].join(" ").toLowerCase(); return briefType(task) === brief && (priority === "all" || task.priority === priority) && (status === "all" || task.state === status) && (!search || haystack.includes(search.toLowerCase())); }), [tasks, search, brief, priority, status]);
  const selected = tasks.find((task) => task.id === selectedId);
  const showToast = (message) => { setToast(message); window.setTimeout(() => setToast(null), 2600); };
  const assignWriter = async (taskId, writerId) => {
    const previous = tasks;
    setTasks((items) => items.map((task) => task.id === taskId ? { ...task, scriptOwnerId: writerId, contentOwnerId: writerId, updatedAt: new Date().toISOString() } : task));
    if (backendEnabled) {
      const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scriptOwnerId: writerId || null }) });
      if (!response.ok) { const payload = await response.json(); setTasks(previous); return showToast(payload.error || "Could not update assignment"); }
    }
    showToast("Writer assignment updated");
  };
  const submitScript = async (task, link, comments) => {
    if (!task) return;
    try { const url = new URL(link); if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !url.pathname.startsWith("/document/")) return showToast("Use a valid Google Docs link"); } catch { return showToast("Use a valid Google Docs link"); }
    if (backendEnabled) {
      const response = await fetch(`/api/tasks/${encodeURIComponent(task.id)}/script`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scriptUrl: link, comment: comments }) });
      const payload = await response.json();
      if (!response.ok) return showToast(payload.error || "Could not submit script");
      setTasks((items) => items.map((item) => item.id === task.id ? { ...item, ...payload.task } : item));
    } else {
      const now = new Date().toISOString();
      setTasks((items) => items.map((item) => item.id === task.id ? { ...item, state: "script_approval_pending", scriptLink: link, references: item.references?.includes(link) ? item.references : [...(item.references || []), link], updatedAt: now, activity: [{ at: now, actor: currentUser?.name || "Content Team", team: "Content Team", text: comments ? `Submitted the script to Brand Team. Note: ${comments}` : "Submitted the Google Docs script to Brand Team for approval." }, ...(item.activity || [])] } : item));
    }
    setModalOpen(false); setSelectedId(null); showToast("Script sent to Brand Team");
  };

  const readyCount = filtered.filter((task) => task.state === "social_research").length; const changesCount = filtered.filter((task) => task.state === "script_changes_requested").length;
  return <div className="app-shell"><aside className="sidebar"><div className="brand"><span>B</span><div><strong>Brand Perf Edit</strong><small>Content operations</small></div></div><div className="workspace"><label>Workspace</label><button><span><strong>Creative studio</strong><small>Content workspace</small></span><ChevronDown size={15} /></button></div><nav><label>Team</label><button className="active"><FileText size={20} /><span>Content Team</span></button></nav><div className="sidebar-foot"><i />Safe prototype<span>Local dashboard data</span></div></aside><div className="main-shell"><header className="topbar"><button className="mobile-menu"><Menu /></button><label className="global-search"><Search size={20} /><input id="global-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, campaigns, or products" /><kbd>⌘ K</kbd></label><div className="top-actions"><button><CircleHelp /></button><button onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell /><i /></button><button className="user-button"><Avatar person={currentUser} /><span><strong>{currentUser?.name || "Content Team"}</strong><small>Content Team</small></span><ChevronDown size={15} /></button></div>{notificationsOpen && <div className="notifications"><header><strong>Notifications</strong><button onClick={() => setNotificationsOpen(false)}><X size={16} /></button></header><article><i className="teal" /><div><strong>{readyCount} scripts to prepare</strong><span>Brand requirements are ready</span></div></article><article><i className="rose" /><div><strong>{changesCount} change requests</strong><span>Brand feedback needs action</span></div></article></div>}</header><main><div className="page-head"><div><span className="eyebrow">Thursday, 22 October</span><h1>Content Team scripts</h1><p>Submit Google Docs scripts and send them to the Brand Team for approval.</p></div><button className="button primary new-brief" onClick={() => setModalOpen(true)}><Plus size={16} />New brief</button></div><WorkflowGuide /><div className="hero-grid"><section className="queue-card"><span className="eyebrow">Content desk</span><h2>Prepare and send scripts</h2><p>Content Team receives Brand requirements, prepares the script, and sends it to Brand for approval.</p><div className="queue-stats"><div><strong>{filtered.length}</strong><span>Visible tasks</span></div><div><strong>{filtered.filter((task) => task.updatedAt).length}</strong><span>With recorded time</span></div></div></section><div className="mini-grid"><article><span>Scripts to prepare</span><strong>{readyCount}</strong></article><article><span>Script changes</span><strong>{changesCount}</strong></article><article><span>Brand approval</span><strong>{filtered.filter((task) => task.state === "script_approval_pending").length}</strong></article><article><span>P0 priority</span><strong>{filtered.filter((task) => task.priority === "P0").length}</strong></article></div></div><section className="toolbar panel"><div className="queue-tabs"><button className={brief === "video" ? "active" : ""} onClick={() => setBrief("video")}>Video brief queue</button><button className={brief === "ai" ? "active" : ""} onClick={() => setBrief("ai")}>AI brief queue</button></div><div className="filter"><select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option>{["P0", "P1", "P2", "R0"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="filter"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All statuses</option>{COLUMNS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div><span className="result-count">{filtered.length} {brief === "ai" ? "AI" : "video"} tasks</span><div className="view-toggle"><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List size={18} />List</button><button className={view === "board" ? "active" : ""} onClick={() => setView("board")}><LayoutDashboard size={18} />Board</button></div></section>{view === "board" ? <Board tasks={filtered} writers={writers} users={users} onOpen={(task) => setSelectedId(task.id)} onAssign={assignWriter} /> : <TaskList tasks={filtered} writers={writers} onOpen={(task) => setSelectedId(task.id)} onAssign={assignWriter} />}</main></div><Drawer task={selected} users={users} writers={writers} onClose={() => setSelectedId(null)} onAssign={assignWriter} onSubmit={submitScript} />{modalOpen && <NewBriefModal tasks={tasks} onClose={() => setModalOpen(false)} onSubmit={submitScript} />}{toast && <div className="toast"><Check size={17} />{toast}</div>}</div>;
}
