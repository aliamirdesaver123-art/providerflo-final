import React, { useState, useEffect, useCallback } from "react";
import { format, addDays } from "date-fns";
import { X, ChevronLeft, ChevronRight, Loader2, AlertTriangle, CheckCircle2, Repeat, CalendarRange, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { getSupportTypesByCategory, getCategories, DAY_RATE_LABELS, detectDayRateType, getSupportTypeById, getLineItem, type DayRateType } from "@/lib/ndis-catalogue";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

const CATEGORIES = getCategories();

// ── Types ─────────────────────────────────────────────────────────────────────

interface PreviewShift {
  date: string;
  dayLabel: string;
  scheduledStart: string;
  scheduledEnd: string;
  ndisLineItem: string | null;
  hourlyRate: number | null;
  estimatedCost: number;
  conflicts: string[];
  hasConflict: boolean;
}

interface PreviewResult {
  shifts: PreviewShift[];
  summary: { total: number; valid: number; conflicted: number };
  warnings: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: any[];
  staff: any[];
  mode: "recurring" | "bulk";
  preselectedStaffId?: number | null;
  preselectedDate?: string | null;
}

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

// ── Day toggle button ─────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_FULL   = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function DayToggle({ selected, onChange }: { selected: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) => {
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d]);
  };
  return (
    <div className="flex gap-1.5">
      {[1,2,3,4,5,6,0].map(d => (
        <button
          key={d} type="button"
          onClick={() => toggle(d)}
          className="rounded-full font-semibold transition-all select-none"
          style={{
            width: 36, height: 36, fontSize: 12,
            background: selected.includes(d) ? "#0B2F6B" : "#F1F5F9",
            color:      selected.includes(d) ? "#FFFFFF" : "#64748B",
            border:     selected.includes(d) ? "2px solid #0B2F6B" : "2px solid #E2E8F0",
          }}
        >
          {DAY_LABELS[d]}
        </button>
      ))}
    </div>
  );
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {labels.map((label, i) => {
        const n = i + 1;
        const done    = n < step;
        const current = n === step;
        return (
          <React.Fragment key={n}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="rounded-full flex items-center justify-center font-bold transition-all"
                style={{
                  width: 24, height: 24, fontSize: 11,
                  background: done ? "#10B981" : current ? "#0B2F6B" : "#E2E8F0",
                  color: done || current ? "#FFF" : "#94A3B8",
                }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: current ? "#0B1F3A" : "#94A3B8" }}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className="flex-1 h-px" style={{ background: done ? "#10B981" : "#E2E8F0", minWidth: 8 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecurringShiftModal({ open, onClose, onSuccess, participants, staff, mode, preselectedStaffId, preselectedDate }: Props) {
  const [step, setStep] = useState(1);

  // Step 1 — Shift details
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [staffId, setStaffId]             = useState<number | null>(preselectedStaffId ?? null);
  const [startDate, setStartDate]         = useState(preselectedDate ?? format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime]         = useState("09:00");
  const [endTime, setEndTime]             = useState("17:00");
  const [address, setAddress]             = useState("");
  const [notes, setNotes]                 = useState("");

  // Step 2 — Recurrence (recurring mode)
  const [recurrenceType, setRecurrenceType]       = useState<string>("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays]       = useState<number[]>([]);
  const [endCondition, setEndCondition]           = useState<"date"|"count"|"none">("none");
  const [endDate, setEndDate]                     = useState("");
  const [occurrenceCount, setOccurrenceCount]     = useState(12);

  // Step 2 — Bulk mode
  const [bulkEndDate, setBulkEndDate]     = useState("");
  const [daysOfWeek, setDaysOfWeek]       = useState<number[]>([1, 2, 3, 4, 5]);

  // Step 3 — NDIS
  const [supportTypeId, setSupportTypeId] = useState("");
  const [dayRateType, setDayRateType]     = useState("");
  const [serviceType, setServiceType]     = useState("");
  const [supportCategory, setSupportCategory] = useState("");
  const [ndisLineItem, setNdisLineItem]   = useState("");
  const [hourlyRate, setHourlyRate]       = useState<number | null>(null);

  // Step 4 — Preview
  const [preview, setPreview]           = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [creating, setCreating]         = useState(false);
  const [createError, setCreateError]   = useState("");
  const [toast, setToast]               = useState("");

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setParticipantId(null);
      setStaffId(preselectedStaffId ?? null);
      setStartDate(preselectedDate ?? format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00");
      setEndTime("17:00");
      setAddress("");
      setNotes("");
      setRecurrenceType("weekly");
      setRecurrenceInterval(1);
      setRecurrenceDays([]);
      setEndCondition("none");
      setEndDate("");
      setOccurrenceCount(12);
      setBulkEndDate(format(addDays(new Date(), 27), "yyyy-MM-dd"));
      setDaysOfWeek([1, 2, 3, 4, 5]);
      setSupportTypeId("");
      setDayRateType("");
      setServiceType("");
      setSupportCategory("");
      setNdisLineItem("");
      setHourlyRate(null);
      setPreview(null);
      setPreviewError("");
      setCreateError("");
    }
  }, [open, preselectedStaffId, preselectedDate]);

  // Auto-detect day rate type when startDate changes
  useEffect(() => {
    if (startDate) setDayRateType(detectDayRateType(startDate + "T" + startTime + ":00"));
  }, [startDate, startTime]);

  // Auto-fill NDIS line item when support type + day rate type change
  useEffect(() => {
    if (supportTypeId && dayRateType) {
      const li = getLineItem(supportTypeId, dayRateType as DayRateType);
      if (li) {
        setNdisLineItem(li.code);
        setHourlyRate(Number(li.rate));
        const st = getSupportTypeById(supportTypeId);
        if (st) {
          setServiceType(st.name);
          setSupportCategory(st.category);
        }
      }
    }
  }, [supportTypeId, dayRateType]);

  // ── Fetch preview ────────────────────────────────────────────────────────────
  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError("");
    setPreview(null);
    try {
      let data: PreviewResult;
      if (mode === "recurring") {
        data = await apiPost<PreviewResult>("/api/shifts/recurring/preview", {
          participantId, staffId: staffId ?? undefined,
          startDate, startTime, endTime,
          recurrenceType, recurrenceInterval, recurrenceDays,
          endCondition,
          endDate: endCondition === "date" ? endDate : undefined,
          occurrenceCount: endCondition === "count" ? occurrenceCount : undefined,
          ndisLineItem: ndisLineItem || undefined,
          hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined,
          supportCategory: supportCategory || undefined,
          address: address || undefined,
          notes: notes || undefined,
        });
      } else {
        data = await apiPost<PreviewResult>("/api/shifts/bulk/preview", {
          participantId, staffId: staffId ?? undefined,
          startDate, endDate: bulkEndDate, daysOfWeek,
          startTime, endTime,
          ndisLineItem: ndisLineItem || undefined,
          hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined,
          supportCategory: supportCategory || undefined,
          address: address || undefined,
          notes: notes || undefined,
        });
      }
      setPreview(data);
    } catch (e: any) {
      setPreviewError(e.message ?? "Failed to generate preview");
    } finally {
      setPreviewLoading(false);
    }
  }, [mode, participantId, staffId, startDate, startTime, endTime, recurrenceType, recurrenceInterval, recurrenceDays, endCondition, endDate, occurrenceCount, bulkEndDate, daysOfWeek, ndisLineItem, hourlyRate, serviceType, supportCategory, address, notes]);

  useEffect(() => {
    if (step === 4) void fetchPreview();
  }, [step]);

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setCreating(true);
    setCreateError("");
    try {
      let result: any;
      if (mode === "recurring") {
        result = await apiPost("/api/shifts/recurring/create", {
          participantId, staffId: staffId ?? undefined,
          startDate, startTime, endTime,
          recurrenceType, recurrenceInterval, recurrenceDays,
          endCondition,
          endDate: endCondition === "date" ? endDate : undefined,
          occurrenceCount: endCondition === "count" ? occurrenceCount : undefined,
          ndisLineItem: ndisLineItem || undefined,
          hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined,
          supportCategory: supportCategory || undefined,
          address: address || undefined,
          notes: notes || undefined,
          skipConflicts,
        });
      } else {
        result = await apiPost("/api/shifts/bulk/create", {
          participantId, staffId: staffId ?? undefined,
          startDate, endDate: bulkEndDate, daysOfWeek,
          startTime, endTime,
          ndisLineItem: ndisLineItem || undefined,
          hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined,
          supportCategory: supportCategory || undefined,
          address: address || undefined,
          notes: notes || undefined,
          skipConflicts,
        });
      }
      setToast(`✓ ${result.created} shifts created${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`);
      setTimeout(() => { setToast(""); onSuccess(); onClose(); }, 1800);
    } catch (e: any) {
      setCreateError(e.message ?? "Failed to create shifts");
    } finally {
      setCreating(false);
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const step1Valid = !!participantId && !!startDate && !!startTime && !!endTime && startTime < endTime;
  const step2Valid = mode === "bulk"
    ? !!bulkEndDate && bulkEndDate >= startDate && daysOfWeek.length > 0
    : recurrenceType === "none" || (
        endCondition !== "date" || !!endDate
      ) && (
        endCondition !== "count" || occurrenceCount > 0
      );
  const step3Valid = true; // NDIS is optional

  const steps = mode === "recurring"
    ? ["Shift Details", "Recurrence", "NDIS & Rate", "Preview"]
    : ["Shift Details", "Date Range", "NDIS & Rate", "Preview"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col"
        style={{ maxHeight: "92vh", border: "1px solid #E5EAF2" }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <div className="flex items-center gap-2.5">
            {mode === "recurring"
              ? <Repeat className="w-5 h-5" style={{ color: "#0B2F6B" }} />
              : <LayoutList className="w-5 h-5" style={{ color: "#0B2F6B" }} />}
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0B1F3A" }}>
                {mode === "recurring" ? "Create Recurring Shifts" : "Bulk Create Shifts"}
              </h2>
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>
                {mode === "recurring" ? "Set a shift pattern that repeats automatically" : "Create multiple shifts across a date range"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors">
            <X className="w-4 h-4" style={{ color: "#94A3B8" }} />
          </button>
        </div>

        {/* Step bar */}
        <div className="px-6 pt-4 shrink-0">
          <StepBar step={step} total={4} labels={steps} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2">

          {/* ── STEP 1: Shift Details ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Client <span className="text-red-500">*</span></label>
                  <Select value={participantId?.toString() ?? ""} onValueChange={v => setParticipantId(parseInt(v, 10))}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {participants.map((p: any) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Staff Member</label>
                  <Select value={staffId?.toString() ?? "unassigned"} onValueChange={v => setStaffId(v === "unassigned" ? null : parseInt(v, 10))}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((s: any) => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>
                    {mode === "recurring" ? "First Occurrence" : "Start Date"} <span className="text-red-500">*</span>
                  </label>
                  <Input type="date" className="rounded-xl h-10" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Start Time <span className="text-red-500">*</span></label>
                  <Input type="time" className="rounded-xl h-10" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>End Time <span className="text-red-500">*</span></label>
                  <Input type="time" className="rounded-xl h-10" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>

              {startTime >= endTime && startTime && endTime && (
                <p className="text-xs text-red-500">End time must be after start time</p>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Address</label>
                <AddressAutocomplete value={address} onChange={setAddress} placeholder="Search for a shift location…" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Notes</label>
                <Textarea
                  placeholder="Any special instructions or notes…"
                  className="rounded-xl resize-none" rows={2}
                  value={notes} onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* ── STEP 2a: Recurrence (recurring mode) ──────────────────────── */}
          {step === 2 && mode === "recurring" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Repeat</label>
                <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                  <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Does not repeat (single shift)</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly (every 2 weeks)</SelectItem>
                    <SelectItem value="monthly">Monthly (same date)</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {recurrenceType === "custom" && (
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: "#374151" }}>Every</span>
                  <Input
                    type="number" min={1} max={52} className="rounded-xl h-10 w-20"
                    value={recurrenceInterval}
                    onChange={e => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <span className="text-sm" style={{ color: "#374151" }}>week(s)</span>
                </div>
              )}

              {["weekly", "fortnightly", "custom"].includes(recurrenceType) && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>
                    Repeat on days
                    <span className="ml-1 font-normal text-xs" style={{ color: "#94A3B8" }}>
                      {recurrenceDays.length === 0 ? "(defaults to first occurrence day)" : ""}
                    </span>
                  </label>
                  <DayToggle selected={recurrenceDays} onChange={setRecurrenceDays} />
                  {recurrenceDays.length > 0 && (
                    <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>
                      {recurrenceDays.sort().map(d => DAY_FULL[d]).join(", ")}
                    </p>
                  )}
                </div>
              )}

              {recurrenceType !== "none" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium" style={{ color: "#374151" }}>End condition</label>
                  <div className="flex flex-col gap-2">
                    {(["none", "date", "count"] as const).map(cond => (
                      <label key={cond} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="radio" name="endCondition"
                          checked={endCondition === cond}
                          onChange={() => setEndCondition(cond)}
                          className="accent-[#0B2F6B]"
                        />
                        <span className="text-sm" style={{ color: "#374151" }}>
                          {cond === "none" ? "No end (up to 1 year)" : cond === "date" ? "By date" : "After N occurrences"}
                        </span>
                        {cond === "date" && endCondition === "date" && (
                          <Input type="date" className="rounded-xl h-9 w-44 ml-1"
                            value={endDate} onChange={e => setEndDate(e.target.value)}
                            min={startDate}
                          />
                        )}
                        {cond === "count" && endCondition === "count" && (
                          <div className="flex items-center gap-2 ml-1">
                            <Input type="number" min={1} max={365} className="rounded-xl h-9 w-20"
                              value={occurrenceCount}
                              onChange={e => setOccurrenceCount(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))}
                            />
                            <span className="text-sm" style={{ color: "#94A3B8" }}>occurrences</span>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {endCondition === "none" && recurrenceType !== "none" && (
                <div className="rounded-xl p-3 text-sm flex items-center gap-2"
                  style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                  <span style={{ color: "#92400E" }}>No end date set — shifts will be generated for up to 1 year.</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2b: Date Range (bulk mode) ───────────────────────────── */}
          {step === 2 && mode === "bulk" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Start Date <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl h-10" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>End Date <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl h-10" value={bulkEndDate}
                    onChange={e => setBulkEndDate(e.target.value)} min={startDate} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Days of week <span className="text-red-500">*</span></label>
                <DayToggle selected={daysOfWeek} onChange={setDaysOfWeek} />
                {daysOfWeek.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Select at least one day</p>
                )}
              </div>

              {startDate && bulkEndDate && daysOfWeek.length > 0 && (
                <div className="rounded-xl p-3.5" style={{ background: "#EFF6FF", border: "1px solid #D7E8FF" }}>
                  <p className="text-sm font-medium" style={{ color: "#1D4ED8" }}>
                    {daysOfWeek.sort().map(d => DAY_FULL[d]).join(", ")}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#3B82F6" }}>
                    {startDate} → {bulkEndDate} · shifts will be generated for selected days
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: NDIS & Rate ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>NDIS Support Type</label>
                  <Select value={supportTypeId} onValueChange={setSupportTypeId}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => (
                        <SelectGroup key={cat}>
                          <SelectLabel className="text-xs uppercase text-muted-foreground font-semibold py-1.5">{cat}</SelectLabel>
                          {getSupportTypesByCategory(cat).map(st => (
                            <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Day Rate Type</label>
                  <Select value={dayRateType} onValueChange={setDayRateType}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Auto-detected" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DAY_RATE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {ndisLineItem && hourlyRate && (
                <div className="rounded-xl p-4" style={{ background: "#EFF6FF", border: "1px solid #D7E8FF" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#0B1F3A" }}>{ndisLineItem}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#64748B" }}>{serviceType}</p>
                    </div>
                    <p className="font-bold text-lg" style={{ color: "#0B2F6B" }}>${hourlyRate.toFixed(2)}/hr</p>
                  </div>
                </div>
              )}

              {!supportTypeId && (
                <div className="rounded-xl p-4 text-center" style={{ background: "#F8FAFC", border: "1px dashed #E2E8F0" }}>
                  <p className="text-sm" style={{ color: "#94A3B8" }}>NDIS item & rate are optional. Shifts can be created without a line item.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Manual Rate Override</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: "#374151" }}>$</span>
                  <Input
                    type="number" step="0.01" min="0" placeholder="e.g. 67.56"
                    className="rounded-xl h-10 w-36"
                    value={hourlyRate ?? ""}
                    onChange={e => setHourlyRate(e.target.value ? parseFloat(e.target.value) : null)}
                  />
                  <span className="text-sm" style={{ color: "#94A3B8" }}>/ hr</span>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 4: Preview ───────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {previewLoading && (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0B2F6B" }} />
                  <p className="text-sm" style={{ color: "#64748B" }}>Generating preview…</p>
                </div>
              )}

              {previewError && (
                <div className="rounded-xl p-4 flex items-start gap-2.5" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#DC2626" }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#DC2626" }}>Preview failed</p>
                    <p className="text-xs mt-0.5" style={{ color: "#B91C1C" }}>{previewError}</p>
                    <button onClick={fetchPreview} className="text-xs mt-1.5 font-medium underline" style={{ color: "#DC2626" }}>Retry</button>
                  </div>
                </div>
              )}

              {preview && !previewLoading && (
                <>
                  {/* Summary strip */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Total Shifts", value: preview.summary.total, color: "#0B2F6B", bg: "#EFF6FF" },
                      { label: "No Conflicts",  value: preview.summary.valid,      color: "#059669", bg: "#ECFDF5" },
                      { label: "Conflicts",     value: preview.summary.conflicted, color: "#DC2626", bg: "#FEF2F2" },
                    ].map(({ label, value, color, bg }) => (
                      <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${color}20` }}>
                        <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
                        <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Warnings */}
                  {preview.warnings.map((w, i) => (
                    <div key={i} className="rounded-xl p-3 flex items-center gap-2 text-sm"
                      style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                      <span style={{ color: "#92400E" }}>{w}</span>
                    </div>
                  ))}

                  {/* Skip conflicts toggle */}
                  {preview.summary.conflicted > 0 && (
                    <label className="flex items-center gap-2.5 cursor-pointer rounded-xl p-3.5"
                      style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                      <input type="checkbox" checked={skipConflicts} onChange={e => setSkipConflicts(e.target.checked)} className="accent-[#0B2F6B] w-4 h-4" />
                      <span className="text-sm font-medium" style={{ color: "#92400E" }}>
                        Skip {preview.summary.conflicted} conflicting shifts (create {preview.summary.valid} valid shifts only)
                      </span>
                    </label>
                  )}

                  {/* Shift table */}
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5EAF2" }}>
                    <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0" style={{ background: "#F8FAFC" }}>
                          <tr>
                            {["Date", "Time", "NDIS Item", "Rate", "Est. Cost", "Status"].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: "#64748B", borderBottom: "1px solid #E5EAF2" }}>{h}</th>
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
                              <td className="px-3 py-2">
                                {s.ndisLineItem
                                  ? <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>{s.ndisLineItem}</span>
                                  : <span style={{ color: "#CBD5E1" }}>—</span>}
                              </td>
                              <td className="px-3 py-2" style={{ color: "#374151" }}>
                                {s.hourlyRate ? `$${Number(s.hourlyRate).toFixed(2)}/hr` : "—"}
                              </td>
                              <td className="px-3 py-2 font-semibold" style={{ color: "#0B2F6B" }}>
                                {s.estimatedCost > 0 ? `$${s.estimatedCost.toFixed(2)}` : "—"}
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

                  {createError && (
                    <div className="rounded-xl p-3 text-sm text-red-600" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
                      {createError}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <Button variant="outline" className="rounded-xl" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? "Cancel" : (
              <span className="flex items-center gap-1.5"><ChevronLeft className="w-4 h-4" /> Back</span>
            )}
          </Button>

          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button
                className="rounded-xl gap-1.5"
                disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : false}
                onClick={() => setStep(s => s + 1)}
                style={{ background: "#0B2F6B" }}
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                className="rounded-xl gap-1.5"
                disabled={creating || previewLoading || !!previewError || !preview || (preview.summary.valid === 0 && skipConflicts)}
                onClick={handleCreate}
                style={{ background: "#0B2F6B" }}
              >
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : (
                  <>Create {preview && (skipConflicts ? preview.summary.valid : preview.summary.total)} Shifts</>
                )}
              </Button>
            )}
          </div>
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
