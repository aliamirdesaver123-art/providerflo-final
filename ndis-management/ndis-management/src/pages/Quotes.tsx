import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListParticipants } from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { FileText, Plus, Send, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const API = "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pf_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useQuotes() { return useQuery({ queryKey: ["quotes"], queryFn: () => fetch(`${API}/api/quotes`, { headers: authHeaders() }).then(r => r.json()) }); }
function useCreateQuote() { const qc = useQueryClient(); return useMutation({ mutationFn: (d: any) => fetch(`${API}/api/quotes`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(d) }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }) }); }
function useUpdateQuote() { const qc = useQueryClient(); return useMutation({ mutationFn: ({ id, ...d }: any) => fetch(`${API}/api/quotes/${id}`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(d) }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["quotes"] }) }); }

const STATUSES = ["draft", "sent", "accepted", "declined", "expired"];
const STATUS_STYLES: Record<string, { cls: string; icon: any }> = {
  draft: { cls: "bg-gray-100 text-gray-600", icon: FileText },
  sent: { cls: "bg-blue-100 text-blue-700", icon: Send },
  accepted: { cls: "bg-green-100 text-green-700", icon: CheckCircle },
  declined: { cls: "bg-red-100 text-red-700", icon: XCircle },
  expired: { cls: "bg-orange-100 text-orange-700", icon: Clock },
};

export default function Quotes() {
  const { data: apiQuotes = [] } = useQuotes();
  const { data: participants = [] } = useListParticipants();
  const createQuote = useCreateQuote();
  const updateQuote = useUpdateQuote();
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [form, setForm] = useState({ participantId: "", title: "", description: "", totalAmount: "", validUntil: "" });

  const allQuotes = (apiQuotes as any[]);
  const filtered = filterStatus === "all" ? allQuotes : allQuotes.filter(q => q.status === filterStatus);

  const stats = {
    total: allQuotes.length,
    accepted: allQuotes.filter(q => q.status === "accepted"),
    pending: allQuotes.filter(q => q.status === "sent").length,
    totalValue: allQuotes.filter(q => q.status === "accepted").reduce((s, q) => s + (q.totalAmount ?? 0), 0),
  };

  const handleCreate = () => {
    if (!form.participantId || !form.title) return;
    createQuote.mutate({ participantId: parseInt(form.participantId), title: form.title, description: form.description, totalAmount: parseFloat(form.totalAmount) || 0, validUntil: form.validUntil }, { onSuccess: () => { setShowCreate(false); setForm({ participantId: "", title: "", description: "", totalAmount: "", validUntil: "" }); } });
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Quotes</h1>
          <p className="pf-page-desc">{stats.total} quotes · {stats.pending} awaiting response</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />New Quote</Button>
      </div>

      <div className="pf-grid pf-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Quotes",      value: stats.total },
          { label: "Accepted",          value: stats.accepted.length },
          { label: "Pending Response",  value: stats.pending },
          { label: "Accepted Value",    value: `$${stats.totalValue.toLocaleString()}` },
        ].map(s => (
          <div key={s.label} className="pf-card" style={{ padding: "14px 16px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)" }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em", margin: "4px 0 0" }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="pf-filter-bar" style={{ marginBottom: 14 }}>
        {["all", ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={cn("pf-tab", filterStatus === s && "active")} style={{ textTransform: "capitalize" }}>{s === "all" ? "All" : s}</button>
        ))}
      </div>

      <div className="pf-card" style={{ overflow: "hidden" }}>
        <table className="pf-table">
          <thead>
            <tr>
              <th>Quote #</th><th>Participant</th><th>Title</th><th>Amount</th><th>Valid Until</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(q => {
              const S = STATUS_STYLES[q.status] ?? STATUS_STYLES.draft;
              const Icon = S.icon;
              return (
                <tr key={q.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{q.quoteNumber}</td>
                  <td style={{ fontWeight: 700, fontSize: 13 }}>{q.participantName}</td>
                  <td style={{ maxWidth: 200 }}>
                    <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>{q.title}</p>
                    {q.description && <p style={{ fontSize: 11, color: "var(--pf-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.description}</p>}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: 13 }}>${(q.totalAmount ?? 0).toLocaleString()}</td>
                  <td style={{ fontSize: 12, color: "var(--pf-muted)" }}>{q.validUntil ? format(parseISO(q.validUntil), "d MMM yyyy") : "—"}</td>
                  <td>
                    <span className="pf-chip" style={{ display: "inline-flex", alignItems: "center", gap: 4, textTransform: "capitalize" }}>
                      <Icon style={{ width: 10, height: 10 }} />{q.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {q.status === "draft" && <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => q.id > 0 && updateQuote.mutate({ id: q.id, status: "sent" })}><Send className="w-3 h-3" />Send</Button>}
                      {q.status === "sent" && <>
                        <Button size="sm" className="h-7 text-xs gap-1" style={{ background: "var(--pf-success)" }} onClick={() => q.id > 0 && updateQuote.mutate({ id: q.id, status: "accepted" })}><CheckCircle className="w-3 h-3" />Accept</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" style={{ color: "var(--pf-error)", borderColor: "var(--pf-error)" }} onClick={() => q.id > 0 && updateQuote.mutate({ id: q.id, status: "declined" })}><XCircle className="w-3 h-3" />Decline</Button>
                      </>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowCreate(false)}>
          <div className="pf-card" style={{ maxWidth: 440, width: "100%" }} onClick={e => e.stopPropagation()}>
            <div className="pf-card-header"><span className="pf-card-title">New Quote</span></div>
            <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="pf-field"><label>Participant *</label>
                <select value={form.participantId} onChange={e => setForm(f => ({ ...f, participantId: e.target.value }))} className="pf-input">
                  <option value="">Select participant...</option>
                  {(participants as any[]).map((p: any) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
                </select>
              </div>
              <div className="pf-field"><label>Quote Title *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="pf-input" /></div>
              <div className="pf-field"><label>Description</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="pf-input" style={{ resize: "none" }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="pf-field"><label>Total Amount ($)</label><input type="number" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} className="pf-input" /></div>
                <div className="pf-field"><label>Valid Until</label><input type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} className="pf-input" /></div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={handleCreate} disabled={!form.participantId || !form.title || createQuote.isPending}>{createQuote.isPending ? "Creating..." : "Create Quote"}</Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
