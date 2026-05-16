import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Eye, Trash2, Copy, CheckCircle, Clock, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const API = "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pf_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useForms() { return useQuery({ queryKey: ["forms"], queryFn: () => fetch(`${API}/api/forms`, { headers: authHeaders() }).then(r => r.json()) }); }
function useCreateForm() { const qc = useQueryClient(); return useMutation({ mutationFn: (d: any) => fetch(`${API}/api/forms`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(d) }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }) }); }

const CATEGORIES = ["intake", "assessment", "consent", "incident", "feedback", "general", "review"];
const CAT_COLORS: Record<string, string> = { intake: "bg-blue-100 text-blue-700", assessment: "bg-purple-100 text-purple-700", consent: "bg-green-100 text-green-700", incident: "bg-red-100 text-red-700", feedback: "bg-yellow-100 text-yellow-700", general: "bg-gray-100 text-gray-700", review: "bg-teal-100 text-teal-700" };

export default function Forms() {
  const { data: apiForms = [] } = useForms();
  const createForm = useCreateForm();
  const [showCreate, setShowCreate] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [form, setForm] = useState({ title: "", category: "general", description: "" });

  const allForms = (apiForms as any[]);
  const filtered = allForms.filter(f => {
    if (filterCategory !== "all" && f.category !== filterCategory) return false;
    if (filterActive === "active" && !f.isActive) return false;
    if (filterActive === "inactive" && f.isActive) return false;
    return true;
  });

  const stats = { total: allForms.length, active: allForms.filter(f => f.isActive).length, totalResponses: allForms.reduce((s, f) => s + (f.responseCount ?? 0), 0) };

  const handleCreate = () => {
    if (!form.title) return;
    createForm.mutate(form, { onSuccess: () => { setShowCreate(false); setForm({ title: "", category: "general", description: "" }); } });
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Forms</h1>
          <p className="pf-page-desc">{stats.total} templates · {stats.totalResponses} total responses</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />New Form</Button>
      </div>

      <div className="pf-grid pf-grid-3" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Forms",      value: stats.total,          icon: FileText,    sub: `${stats.active} active` },
          { label: "Total Responses",  value: stats.totalResponses, icon: Users,       sub: "all time" },
          { label: "Active Forms",     value: stats.active,         icon: CheckCircle, sub: "available for use" },
        ].map(s => (
          <div key={s.label} className="pf-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
            <div className="pf-metric-icon" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
              <s.icon style={{ width: 16, height: 16, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{s.label} · {s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pf-filter-bar" style={{ marginBottom: 14 }}>
        {["all", ...CATEGORIES].map(c => (
          <button key={c} onClick={() => setFilterCategory(c)} className={cn("pf-tab", filterCategory === c && "active")} style={{ textTransform: "capitalize" }}>{c === "all" ? "All" : c}</button>
        ))}
        <div style={{ width: 1, background: "var(--pf-border)", height: 20, margin: "0 4px" }} />
        {[["all", "All"], ["active", "Active"], ["inactive", "Inactive"]].map(([v, l]) => (
          <button key={v} onClick={() => setFilterActive(v)} className={cn("pf-tab", filterActive === v && "active")}>{l}</button>
        ))}
      </div>

      <div className="pf-grid pf-grid-2">
        {filtered.map(f => (
          <div key={f.id} className="pf-card">
            <div className="pf-card-body">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div className="pf-metric-icon" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}>
                    <FileText style={{ width: 16, height: 16, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--pf-text)" }}>{f.title}</h3>
                    <span className="pf-chip" style={{ textTransform: "capitalize", marginTop: 4, display: "inline-block" }}>{f.category}</span>
                  </div>
                </div>
                <span className={cn("pf-chip", f.isActive ? "pf-chip-success" : "")}>{f.isActive ? "Active" : "Inactive"}</span>
              </div>
              {f.description && <p style={{ fontSize: 12, color: "var(--pf-muted)", marginBottom: 10, lineHeight: 1.5 }}>{f.description}</p>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--pf-border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--pf-muted)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users style={{ width: 11, height: 11 }} />{f.responseCount ?? 0} responses</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock style={{ width: 11, height: 11 }} />{f.createdAt ? format(parseISO(f.createdAt), "d MMM yyyy") : "Unknown"}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"><Eye className="w-3 h-3" />View</Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"><Copy className="w-3 h-3" />Duplicate</Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowCreate(false)}>
          <div className="pf-card" style={{ maxWidth: 440, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div className="pf-card-header"><span className="pf-card-title">New Form Template</span></div>
            <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="pf-field"><label>Form Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="pf-input" /></div>
              <div className="pf-field"><label>Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="pf-input">{CATEGORIES.map(c => <option key={c} value={c} style={{ textTransform: "capitalize" }}>{c}</option>)}</select></div>
              <div className="pf-field"><label>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="pf-input" style={{ resize: "none" }} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={handleCreate} disabled={!form.title || createForm.isPending}>{createForm.isPending ? "Creating..." : "Create Form"}</Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
