import React, { useState, useEffect, useCallback } from "react";
import { format, addDays, startOfWeek } from "date-fns";
import { X, ChevronLeft, ChevronRight, Loader2, AlertTriangle, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ── Auth helper ───────────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem("pf_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({ error: "Unknown error" }));
  if (!res.ok) throw new Error((data as any).error ?? "Request failed");
  return data as T;
}

// ── Week selector ─────────────────────────────────────────────────────────────

function weekLabel(monday: Date): string {
  const sun = addDays(monday, 6);
  return `${format(monday, "d MMM")} – ${format(sun, "d MMM yyyy")}`;
}

function WeekNav({ label, monday, onChange }: { label: string; monday: Date; onChange: (d: Date) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(addDays(monday, -7))}
        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
        style={{ border: "1px solid #E2E8F0" }}
      >
        <ChevronLeft className="w-4 h-4" style={{ color: "#64748B" }} />
      </button>
      <div className="flex-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#94A3B8" }}>{label}</p>
        <p className="text-sm font-bold" style={{ color: "#0B1F3A" }}>{weekLabel(monday)}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(addDays(monday, 7))}
        className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
        style={{ border: "1px solid #E2E8F0" }}
      >
        <ChevronRight className="w-4 h-4" style={{ color: "#64748B" }} />
      </button>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PreviewShift {
  date: string;
  dayLabel: string;
  scheduledStart: string;
  scheduledEnd: string;
  staffId: number | null;
  participantId: number;
  serviceType: string | null;
  ndisLineItem: string | null;
  hourlyRate: string | null;
  conflicts: string[];
  hasConflict: boolean;
}

interface PreviewResult {
  shifts: PreviewShift[];
  summary: { total: number; valid: number; conflicted: number };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: any[];
  staff: any[];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CopyWeekModal({ open, onClose, onSuccess, participants, staff }: Props) {
  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [sourceMonday, setSourceMonday] = useState<Date>(thisMonday);
  const [destMonday, setDestMonday]     = useState<Date>(addDays(thisMonday, 7));
  const [filterParticipant, setFilterParticipant] = useState<string>("all");
  const [filterStaff, setFilterStaff]             = useState<string>("all");
  const [skipConflicts, setSkipConflicts]         = useState(true);

  const [preview, setPreview]             = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]   = useState("");
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState("");
  const [toast, setToast]                 = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
      setSourceMonday(mon);
      setDestMonday(addDays(mon, 7));
      setFilterParticipant("all");
      setFilterStaff("all");
      setSkipConflicts(true);
      setPreview(null);
      setPreviewError("");
      setCreateError("");
    }
  }, [open]);

  // Clear preview when inputs change
  useEffect(() => { setPreview(null); setPreviewError(""); }, [sourceMonday, destMonday, filterParticipant, filterStaff]);

  const weeksAreSame = format(sourceMonday, "yyyy-MM-dd") === format(destMonday, "yyyy-MM-dd");

  const handlePreview = useCallback(async () => {
    if (weeksAreSame) return;
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      const data = await apiPost<PreviewResult>("/api/shifts/copy-week", {
        sourceWeekStart: format(sourceMonday, "yyyy-MM-dd"),
        destWeekStart:   format(destMonday,   "yyyy-MM-dd"),
        participantId: filterParticipant !== "all" ? parseInt(filterParticipant, 10) : undefined,
        staffId:       filterStaff !== "all"       ? parseInt(filterStaff, 10)       : undefined,
        preview: true,
      });
      setPreview(data);
    } catch (e: any) {
      setPreviewError(e.message ?? "Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [sourceMonday, destMonday, filterParticipant, filterStaff, weeksAreSame]);

  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      const result: any = await apiPost("/api/shifts/copy-week", {
        sourceWeekStart: format(sourceMonday, "yyyy-MM-dd"),
        destWeekStart:   format(destMonday,   "yyyy-MM-dd"),
        participantId: filterParticipant !== "all" ? parseInt(filterParticipant, 10) : undefined,
        staffId:       filterStaff !== "all"       ? parseInt(filterStaff, 10)       : undefined,
        skipConflicts,
        preview: false,
      });
      setToast(`✓ ${result.created} shifts copied${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`);
      setTimeout(() => { setToast(""); onSuccess(); onClose(); }, 1800);
    } catch (e: any) {
      setCreateError(e.message ?? "Failed to copy shifts");
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col"
        style={{ maxHeight: "88vh", border: "1px solid #E5EAF2" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <div className="flex items-center gap-2.5">
            <Copy className="w-5 h-5" style={{ color: "#0B2F6B" }} />
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0B1F3A" }}>Copy Week</h2>
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>Duplicate all shifts from one week to another</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors">
            <X className="w-4 h-4" style={{ color: "#94A3B8" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Week selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <WeekNav label="Copy FROM" monday={sourceMonday} onChange={d => { setSourceMonday(d); }} />
            </div>
            <div className="rounded-xl p-4" style={{ background: "#EFF6FF", border: "1px solid #D7E8FF" }}>
              <WeekNav label="Copy TO" monday={destMonday} onChange={d => { setDestMonday(d); }} />
            </div>
          </div>

          {weeksAreSame && (
            <div className="rounded-xl p-3 flex items-center gap-2 text-sm"
              style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "#DC2626" }} />
              <span style={{ color: "#B91C1C" }}>Source and destination weeks must be different</span>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#94A3B8" }}>Filter by Client</label>
              <Select value={filterParticipant} onValueChange={setFilterParticipant}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {participants.map((p: any) => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#94A3B8" }}>Filter by Staff</label>
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {staff.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview button */}
          {!preview && !previewLoading && (
            <Button
              variant="outline" className="w-full rounded-xl h-10"
              onClick={handlePreview}
              disabled={weeksAreSame}
            >
              {previewLoading
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading…</>
                : "Preview Shifts"}
            </Button>
          )}

          {previewLoading && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#0B2F6B" }} />
              <p className="text-sm" style={{ color: "#64748B" }}>Loading preview…</p>
            </div>
          )}

          {previewError && (
            <div className="rounded-xl p-4 flex items-start gap-2.5" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>Preview failed</p>
                <p className="text-xs mt-0.5" style={{ color: "#B91C1C" }}>{previewError}</p>
                <button onClick={handlePreview} className="text-xs mt-1 font-medium underline" style={{ color: "#DC2626" }}>Retry</button>
              </div>
            </div>
          )}

          {/* Preview results */}
          {preview && !previewLoading && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total",    value: preview.summary.total,      color: "#0B2F6B", bg: "#EFF6FF" },
                  { label: "No Conflict", value: preview.summary.valid,   color: "#059669", bg: "#ECFDF5" },
                  { label: "Conflicts", value: preview.summary.conflicted, color: "#DC2626", bg: "#FEF2F2" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${color}25` }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
                    <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</p>
                  </div>
                ))}
              </div>

              {/* Skip conflicts toggle */}
              {preview.summary.conflicted > 0 && (
                <label className="flex items-center gap-2.5 cursor-pointer rounded-xl p-3.5"
                  style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                  <input type="checkbox" checked={skipConflicts} onChange={e => setSkipConflicts(e.target.checked)} className="accent-[#0B2F6B] w-4 h-4" />
                  <span className="text-sm font-medium" style={{ color: "#92400E" }}>
                    Skip {preview.summary.conflicted} conflicting shifts
                  </span>
                </label>
              )}

              {/* Shift table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5EAF2" }}>
                <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: "#F8FAFC" }}>
                      <tr>
                        {["Date", "Time", "Service Type", "Status"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold"
                            style={{ color: "#64748B", borderBottom: "1px solid #E5EAF2" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.shifts.map((s, i) => (
                        <tr key={i} className="border-b last:border-b-0"
                          style={{ borderColor: "#F1F5F9", background: s.hasConflict ? "#FEF9F9" : i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                          <td className="px-3 py-2 font-medium" style={{ color: "#0B1F3A" }}>{s.dayLabel}</td>
                          <td className="px-3 py-2" style={{ color: "#374151" }}>
                            {s.scheduledStart.slice(11, 16)}–{s.scheduledEnd.slice(11, 16)}
                          </td>
                          <td className="px-3 py-2" style={{ color: "#64748B" }}>
                            {s.serviceType ?? <span style={{ color: "#CBD5E1" }}>—</span>}
                          </td>
                          <td className="px-3 py-2">
                            {s.hasConflict ? (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" style={{ color: "#DC2626" }} />
                                <span style={{ color: "#DC2626", fontWeight: 600 }}>Conflict</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" style={{ color: "#10B981" }} />
                                <span style={{ color: "#10B981", fontWeight: 600 }}>OK</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Conflict detail tooltip text */}
              {preview.shifts.some(s => s.hasConflict) && (
                <details className="text-xs cursor-pointer" style={{ color: "#64748B" }}>
                  <summary className="font-medium" style={{ color: "#DC2626" }}>Show conflict details</summary>
                  <ul className="mt-2 space-y-1 pl-3">
                    {preview.shifts.filter(s => s.hasConflict).map((s, i) => (
                      <li key={i}>
                        <span className="font-medium" style={{ color: "#0B1F3A" }}>{s.dayLabel} {s.scheduledStart.slice(11,16)}</span>
                        {" — "}{s.conflicts[0]}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {/* Re-preview button */}
              <button
                onClick={() => { setPreview(null); handlePreview(); }}
                className="text-xs font-medium underline"
                style={{ color: "#64748B" }}
              >
                Refresh preview
              </button>

              {createError && (
                <div className="rounded-xl p-3 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>
                  {createError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button
            className="rounded-xl gap-1.5"
            style={{ background: "#0B2F6B" }}
            disabled={!preview || creating || weeksAreSame || (preview.summary.valid === 0 && skipConflicts)}
            onClick={handleCreate}
          >
            {creating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Copying…</>
            ) : preview ? (
              <>Copy {skipConflicts ? preview.summary.valid : preview.summary.total} Shifts</>
            ) : "Copy Shifts"}
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl"
          style={{ background: "#0B2F6B", color: "#FFFFFF" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
