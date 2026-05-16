import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, isPast, isToday } from "date-fns";
import { Plus, Circle, CheckCircle2, Clock, AlertCircle, Trash2 } from "lucide-react";

const API = "";
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pf_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useTasks() { return useQuery({ queryKey: ["tasks"], queryFn: () => fetch(`${API}/api/tasks`, { headers: authHeaders() }).then(r => r.json()) }); }
function useCreateTask() { const qc = useQueryClient(); return useMutation({ mutationFn: (d: any) => fetch(`${API}/api/tasks`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(d) }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) }); }
function useUpdateTask() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...d }: any) => fetch(`${API}/api/tasks/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(d) }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) }); }
function useDeleteTask() { const qc = useQueryClient(); return useMutation({ mutationFn: (id: number) => fetch(`${API}/api/tasks/${id}`, { method: "DELETE", headers: authHeaders() }), onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }) }); }

const PRIORITIES = ["urgent", "high", "medium", "low"];
const CATEGORIES = ["admin", "clinical", "compliance", "scheduling", "finance", "other"];
const STATUSES   = ["pending", "in_progress", "completed", "cancelled"];

const PRIORITY_CHIP: Record<string, string> = {
  urgent: "pf-chip pf-chip-error",
  high:   "pf-chip pf-chip-error",
  medium: "pf-chip pf-chip-warning",
  low:    "pf-chip pf-chip-success",
};

export default function Tasks() {
  const { data: apiTasks = [] } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", dueDate: "", category: "admin" });

  const allTasks = (apiTasks as any[]);
  const filtered = allTasks.filter(t => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const stats = {
    pending:    allTasks.filter(t => t.status === "pending").length,
    inProgress: allTasks.filter(t => t.status === "in_progress").length,
    completed:  allTasks.filter(t => t.status === "completed").length,
    overdue:    allTasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== "completed").length,
  };

  const getDueLabel = (dueDate: string, status: string) => {
    if (!dueDate || status === "completed") return null;
    const d = parseISO(dueDate);
    if (isPast(d))  return { label: "Overdue",   chipCls: "pf-chip pf-chip-error" };
    if (isToday(d)) return { label: "Due today", chipCls: "pf-chip pf-chip-warning" };
    return { label: `Due ${format(d, "d MMM")}`, chipCls: "pf-chip" };
  };

  const handleCreate = () => {
    if (!form.title) return;
    createTask.mutate(form, { onSuccess: () => { setShowCreate(false); setForm({ title: "", description: "", priority: "medium", dueDate: "", category: "admin" }); } });
  };

  const toggleComplete = (task: any) => {
    if (task.id < 0) return;
    updateTask.mutate({ id: task.id, status: task.status === "completed" ? "pending" : "completed" });
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Tasks</h1>
          <p className="pf-page-desc">
            {stats.pending} pending · {stats.inProgress} in progress
            {stats.overdue > 0 && <> · <span style={{ color: "var(--pf-error)", fontWeight: 700 }}>{stats.overdue} overdue</span></>}
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="pf-button pf-button-primary">
          <Plus style={{ width: 15, height: 15 }} />
          Add Task
        </button>
      </div>

      {/* Stat chips */}
      <div className="pf-grid pf-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Pending",     value: stats.pending,    Icon: Circle,       color: "#d97706" },
          { label: "In Progress", value: stats.inProgress, Icon: Clock,        color: "var(--pf-primary)" },
          { label: "Completed",   value: stats.completed,  Icon: CheckCircle2, color: "var(--pf-success)" },
          { label: "Overdue",     value: stats.overdue,    Icon: AlertCircle,  color: "var(--pf-error)" },
        ].map(s => (
          <div key={s.label} className="pf-card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <s.Icon style={{ width: 28, height: 28, color: s.color, strokeWidth: 1.6, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em" }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "var(--pf-muted)", fontWeight: 700 }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="pf-filter-bar">
        <div className="pf-tabs">
          {["all", ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={`pf-tab ${filterStatus === s ? "pf-tab-active" : ""}`} style={{ textTransform: "capitalize" }}>
              {s === "all" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="pf-tabs">
          {["all", ...PRIORITIES].map(p => (
            <button key={p} onClick={() => setFilterPriority(p)} className={`pf-tab ${filterPriority === p ? "pf-tab-active" : ""}`} style={{ textTransform: "capitalize" }}>
              {p === "all" ? "All Priority" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.length === 0 ? (
          <div className="pf-empty">
            <CheckCircle2 className="pf-empty-icon" />
            <p>No tasks found</p>
          </div>
        ) : filtered.map(task => {
          const dueInfo = getDueLabel(task.dueDate, task.status);
          const isCompleted = task.status === "completed";
          return (
            <div key={task.id} className="pf-card" style={{ padding: "12px 16px", display: "flex", alignItems: "flex-start", gap: 12, opacity: isCompleted ? 0.6 : 1 }}>
              <button onClick={() => toggleComplete(task)} style={{ marginTop: 1, background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                {isCompleted
                  ? <CheckCircle2 style={{ width: 18, height: 18, color: "var(--pf-success)" }} />
                  : <Circle style={{ width: 18, height: 18, color: "var(--pf-muted)" }} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)", textDecoration: isCompleted ? "line-through" : "none" }}>{task.title}</p>
                    {task.description && <p style={{ fontSize: 12, color: "var(--pf-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.description}</p>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span className={PRIORITY_CHIP[task.priority] ?? "pf-chip"} style={{ textTransform: "capitalize" }}>{task.priority}</span>
                    {task.id > 0 && (
                      <button onClick={() => deleteTask.mutate(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pf-muted)", display: "flex", padding: 4 }}>
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                  <span className="pf-chip" style={{ textTransform: "capitalize" }}>{task.category}</span>
                  {task.assignedName && <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>→ <span style={{ color: "var(--pf-text-soft)", fontWeight: 600 }}>{task.assignedName}</span></span>}
                  {task.participantName && <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>Re: <span style={{ color: "var(--pf-text-soft)", fontWeight: 600 }}>{task.participantName}</span></span>}
                  {dueInfo && <span className={dueInfo.chipCls} style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock style={{ width: 10, height: 10 }} />{dueInfo.label}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.25)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowCreate(false)}>
          <div className="pf-card" style={{ maxWidth: 460, width: "100%", borderRadius: "var(--pf-radius-modal)" }} onClick={e => e.stopPropagation()}>
            <div className="pf-card-header">
              <h3 className="pf-card-title">New Task</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--pf-muted)", padding: 4 }}>✕</button>
            </div>
            <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="pf-field">
                <label>Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="pf-input" placeholder="Task title" />
              </div>
              <div className="pf-field">
                <label>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="pf-input" style={{ height: "auto", padding: "8px 11px", resize: "none" }} />
              </div>
              <div className="pf-form-grid">
                <div className="pf-field">
                  <label>Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="pf-select" style={{ width: "100%" }}>
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div className="pf-field">
                  <label>Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="pf-select" style={{ width: "100%" }}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="pf-field">
                <label>Due Date</label>
                <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="pf-input" />
              </div>
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--pf-border)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowCreate(false)} className="pf-button pf-button-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={!form.title || createTask.isPending} className="pf-button pf-button-primary">
                {createTask.isPending ? "Creating…" : "Create Task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
