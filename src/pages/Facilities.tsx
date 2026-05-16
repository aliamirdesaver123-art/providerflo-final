import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, MapPin, Phone, Users, Edit2, Trash2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const API = "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("pf_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function useFacilities() {
  return useQuery({
    queryKey: ["facilities"],
    queryFn: () =>
      fetch(`${API}/api/facilities`, { headers: authHeaders() }).then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error ?? "Failed to load facilities");
        return Array.isArray(json) ? json : [];
      }),
  });
}
function useCreateFacility() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => fetch(`${API}/api/facilities`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(data) }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }) });
}
function useDeleteFacility() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: number) => fetch(`${API}/api/facilities/${id}`, { method: "DELETE", headers: authHeaders() }), onSuccess: () => qc.invalidateQueries({ queryKey: ["facilities"] }) });
}

const TYPES = ["residential", "day_program", "community", "supported_independent", "respite"];
const TYPE_LABELS: Record<string, string> = { residential: "Residential", day_program: "Day Program", community: "Community", supported_independent: "Supported Independent Living", respite: "Respite" };
const TYPE_COLORS: Record<string, string> = { residential: "bg-blue-100 text-blue-700", day_program: "bg-green-100 text-green-700", community: "bg-purple-100 text-purple-700", supported_independent: "bg-orange-100 text-orange-700", respite: "bg-teal-100 text-teal-700" };

export default function Facilities() {
  const { data: apiData = [], isLoading } = useFacilities();
  const createFacility = useCreateFacility();
  const deleteFacility = useDeleteFacility();
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [form, setForm] = useState({ name: "", type: "residential", address: "", suburb: "", state: "NSW", postcode: "", phone: "", email: "", capacity: "", manager: "" });

  const allFacilities = (apiData as any[]);
  const filtered = filterType === "all" ? allFacilities : allFacilities.filter(f => f.type === filterType);

  const stats = {
    total: allFacilities.length,
    active: allFacilities.filter(f => f.status === "active").length,
    totalCapacity: allFacilities.reduce((sum, f) => sum + (f.capacity ?? 0), 0),
    totalOccupancy: allFacilities.reduce((sum, f) => sum + (f.currentOccupancy ?? 0), 0),
  };

  const handleCreate = () => {
    if (!form.name) return;
    createFacility.mutate({ ...form, capacity: form.capacity ? parseInt(form.capacity) : null }, {
      onSuccess: () => { setShowCreate(false); setForm({ name: "", type: "residential", address: "", suburb: "", state: "NSW", postcode: "", phone: "", email: "", capacity: "", manager: "" }); }
    });
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Facilities</h1>
          <p className="pf-page-desc">{stats.total} facilities · {stats.totalOccupancy}/{stats.totalCapacity} capacity used</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" />Add Facility</Button>
      </div>

      <div className="pf-grid pf-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Facilities",    value: stats.total,                            sub: `${stats.active} active` },
          { label: "Total Capacity",       value: stats.totalCapacity,                    sub: "beds/places" },
          { label: "Current Occupancy",    value: stats.totalOccupancy,                   sub: `${Math.round((stats.totalOccupancy / (stats.totalCapacity || 1)) * 100)}% full` },
          { label: "Vacancies",            value: stats.totalCapacity - stats.totalOccupancy, sub: "available places" },
        ].map(s => (
          <div key={s.label} className="pf-card" style={{ padding: "14px 16px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)" }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em", margin: "4px 0 2px" }}>{s.value}</p>
            <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="pf-filter-bar" style={{ marginBottom: 14 }}>
        <button onClick={() => setFilterType("all")} className={cn("pf-tab", filterType === "all" && "active")}>All Types</button>
        {TYPES.map(t => (
          <button key={t} onClick={() => setFilterType(t)} className={cn("pf-tab", filterType === t && "active")}>{TYPE_LABELS[t]}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="pf-grid pf-grid-2">
          {[...Array(4)].map((_, i) => <div key={i} className="pf-card" style={{ height: 140 }}><div className="pf-skeleton" style={{ height: "100%", borderRadius: 10 }} /></div>)}
        </div>
      ) : (
        <div className="pf-grid pf-grid-2">
          {filtered.map(f => (
            <div key={f.id} className="pf-card" style={{ cursor: "pointer" }} onClick={() => setSelected(f)}>
              <div className="pf-card-body">
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="pf-metric-icon" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }}>
                      <Building2 style={{ width: 18, height: 18, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--pf-text)" }}>{f.name}</h3>
                      <span className="pf-chip" style={{ marginTop: 3, display: "inline-block" }}>{TYPE_LABELS[f.type] ?? f.type}</span>
                    </div>
                  </div>
                  <span className={cn("pf-chip", f.status === "active" ? "pf-chip-success" : "")}>{f.status}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {f.address && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pf-muted)" }}><MapPin style={{ width: 12, height: 12 }} /><span>{f.address}{f.suburb ? `, ${f.suburb}` : ""}</span></div>}
                  {f.phone && <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pf-muted)" }}><Phone style={{ width: 12, height: 12 }} /><span>{f.phone}</span></div>}
                  {f.capacity != null && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--pf-muted)" }}>
                      <Users style={{ width: 12, height: 12 }} />
                      <span>{f.currentOccupancy ?? 0}/{f.capacity} occupied</span>
                      <div style={{ flex: 1, background: "var(--pf-border)", borderRadius: 9999, height: 4 }}>
                        <div style={{ background: "var(--pf-primary)", height: 4, borderRadius: 9999, width: `${Math.min(100, ((f.currentOccupancy ?? 0) / f.capacity) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                  {f.manager && <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>Manager: <span style={{ fontWeight: 700, color: "var(--pf-text-soft)" }}>{f.manager}</span></p>}
                </div>
                {f.notes && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--pf-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>{f.notes?.slice(0, 50)}{f.notes?.length > 50 ? "..." : ""}</span>
                    <ChevronRight style={{ width: 14, height: 14, color: "var(--pf-muted)" }} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setShowCreate(false)}>
          <div className="pf-card" style={{ maxWidth: 520, width: "100%", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div className="pf-card-header"><span className="pf-card-title">Add Facility</span></div>
            <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[["Facility Name", "name", "text"], ["Manager", "manager", "text"], ["Phone", "phone", "text"], ["Email", "email", "email"], ["Address", "address", "text"], ["Suburb", "suburb", "text"], ["Postcode", "postcode", "text"], ["Capacity", "capacity", "number"]].map(([label, key, type]) => (
                <div key={key} className="pf-field"><label>{label}</label><input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="pf-input" /></div>
              ))}
              <div className="pf-field"><label>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="pf-input">
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <Button onClick={handleCreate} disabled={!form.name || createFacility.isPending}>{createFacility.isPending ? "Creating..." : "Create Facility"}</Button>
                <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
