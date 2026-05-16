import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Loader2,
  Lock,
  MapPin,
  Repeat,
  Route,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  DAY_RATE_LABELS,
  detectDayRateType,
  getCategories,
  getLineItem,
  getSupportTypeById,
  getSupportTypesByCategory,
  type DayRateType,
} from "@/lib/ndis-catalogue";
import { createPremiumShift, previewPremiumShift } from "@/lib/schedulerApi";
import type {
  LocationSource,
  PremiumShiftPayload,
  PremiumShiftPreview,
  ShiftKind,
  ShiftMode,
  ShiftPublishStatus,
} from "./schedulerTypes";

const CATEGORIES = getCategories();
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function uid() {
  return Math.random().toString(36).slice(2);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function money(value: number | null | undefined) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}
function calcHours(start: string, end: string, breakMinutes: number) {
  if (!start || !end || start >= end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - breakMinutes) / 60);
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "blue" | "green" | "amber" | "red";
}) {
  const styles = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-[#eef4ff] text-[#25498f] border-[#d7e4ff]",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function Panel({
  title,
  icon,
  children,
  subtitle,
}: {
  title: string;
  icon: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-[#163b7a]">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-extrabold tracking-tight text-slate-950">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-xs font-bold uppercase tracking-[0.08em] text-slate-500">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function DayToggle({ selected, onChange }: { selected: number[]; onChange: (v: number[]) => void }) {
  const ordered = [1, 2, 3, 4, 5, 6, 0];
  const toggle = (d: number) =>
    onChange(selected.includes(d) ? selected.filter((x) => x !== d) : [...selected, d]);

  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`h-9 w-9 rounded-full text-xs font-extrabold transition ${
            selected.includes(d)
              ? "bg-[#102e68] text-white shadow-lg shadow-blue-900/20"
              : "border border-slate-200 bg-white text-slate-500 hover:border-[#a7b8dc] hover:text-[#102e68]"
          }`}
        >
          {DAY_LABELS[d]}
        </button>
      ))}
    </div>
  );
}

function ShiftDrawerSection({
  title, sOpen, onToggle, children,
}: {
  title: string; sOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF2", borderRadius: 10, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", marginBottom: 14, overflow: "hidden" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", height: 48, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", cursor: "pointer", border: "none", textAlign: "left" as const }}
      >
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
        <ChevronDown style={{ width: 16, height: 16, color: "#6B7280", transform: sOpen ? "rotate(180deg)" : "none", transition: "transform 150ms" }} />
      </button>
      {sOpen && <div style={{ padding: 16, borderTop: "1px solid #EEF2F7" }}>{children}</div>}
    </div>
  );
}

const DEFAULT_PAYLOAD: PremiumShiftPayload = {
  mode: "single",
  participantId: null,
  staffId: null,
  publishStatus: "draft",
  shiftKind: "standard",
  startDate: todayISO(),
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 0,
  startLocationSource: "participant_home",
  endLocationSource: "participant_home",
  startAddress: "",
  endAddress: "",
  recurrenceType: "none",
  recurrenceInterval: 1,
  recurrenceDays: [],
  recurrenceEndCondition: "none",
  recurrenceEndDate: "",
  recurrenceCount: 12,
  bulkEndDate: addDaysISO(27),
  bulkDaysOfWeek: [1, 2, 3, 4, 5],
  isPublicHoliday: false,
  supportCategory: "",
  supportTypeId: "",
  dayRateType: "weekdayDaytime",
  ndisLineItem: "",
  supportDescription: "",
  hourlyRate: null,
  manualRateOverride: false,
  manualRateOverrideReason: "none",
  manualRateOverrideNote: "",
  travelTimeMinutes: 0,
  travelKilometres: 0,
  mileageRate: 0.99,
  billTravelTime: false,
  billKilometres: false,
  nonFaceToFace: false,
  workerInstructions: "",
  participantNotes: "",
  internalNotes: "",
  tasks: [],
  requireGpsClockIn: true,
  requireParticipantSignature: true,
  allowMobileNotes: true,
  skipConflicts: true,
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: any[];
  staff: any[];
  preselectedStaffId?: number | null;
  preselectedDate?: string | null;
  editShift?: any | null;
}

export default function PremiumAddShiftModal({
  open,
  onClose,
  onSuccess,
  participants,
  staff,
  preselectedStaffId,
  preselectedDate,
  editShift,
}: Props) {
  const [payload, setPayload] = useState<PremiumShiftPayload>(DEFAULT_PAYLOAD);
  const [step, setStep] = useState(1);
  const [preview, setPreview] = useState<PremiumShiftPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["client", "shift", "time", "worker"])
  );

  const selectedParticipant = participants.find((p: any) => Number(p.id) === Number(payload.participantId));
  const selectedStaff = staff.find((s: any) => Number(s.id) === Number(payload.staffId));

  const billableHours = useMemo(
    () => calcHours(payload.startTime, payload.endTime, payload.breakMinutes),
    [payload.startTime, payload.endTime, payload.breakMinutes]
  );

  const estimatedBase = billableHours * Number(payload.hourlyRate ?? 0);
  const estimatedTravel =
    (payload.billTravelTime ? (payload.travelTimeMinutes / 60) * Number(payload.hourlyRate ?? 0) : 0) +
    (payload.billKilometres ? payload.travelKilometres * payload.mileageRate : 0);
  const estimatedTotal = estimatedBase + estimatedTravel;

  function patch<K extends keyof PremiumShiftPayload>(key: K, value: PremiumShiftPayload[K]) {
    setPayload((p) => ({ ...p, [key]: value }));
    setPreview(null);
  }

  useEffect(() => {
    if (!open) return;
    setPayload({
      ...DEFAULT_PAYLOAD,
      staffId: preselectedStaffId ?? null,
      startDate: preselectedDate ?? todayISO(),
      bulkEndDate: addDaysISO(27),
      ...(editShift
        ? {
            participantId: editShift.participantId ?? null,
            staffId: editShift.staffId ?? null,
            startDate: editShift.scheduledStart?.slice(0, 10) ?? todayISO(),
            startTime: editShift.scheduledStart?.slice(11, 16) ?? "09:00",
            endTime: editShift.scheduledEnd?.slice(11, 16) ?? "17:00",
            startAddress: editShift.address ?? "",
            endAddress: editShift.endAddress ?? editShift.address ?? "",
            ndisLineItem: editShift.ndisLineItem ?? "",
            supportDescription: editShift.serviceType ?? "",
            hourlyRate: editShift.hourlyRate ? Number(editShift.hourlyRate) : null,
            workerInstructions: editShift.notes ?? "",
          }
        : {}),
    });
    setStep(1);
    setPreview(null);
    setError("");
  }, [open, preselectedStaffId, preselectedDate, editShift]);

  useEffect(() => {
    setPayload((p) => ({
      ...p,
      dayRateType: detectDayRateType(`${p.startDate}T${p.startTime}:00`, p.isPublicHoliday),
    }));
  }, [payload.startDate, payload.startTime, payload.isPublicHoliday]);

  useEffect(() => {
    if (!payload.supportTypeId || !payload.dayRateType) return;
    const li = getLineItem(payload.supportTypeId, payload.dayRateType as DayRateType);
    const supportType = getSupportTypeById(payload.supportTypeId);
    if (!li || !supportType) return;

    setPayload((p) => ({
      ...p,
      ndisLineItem: li.code,
      supportDescription: (li as any).name || supportType.name,
      supportCategory: supportType.category,
      hourlyRate: p.manualRateOverride ? p.hourlyRate : Number(li.rate),
    }));
  }, [payload.supportTypeId, payload.dayRateType, payload.manualRateOverride]);

  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!payload.participantId) issues.push("Select a participant.");
    if (!payload.startDate) issues.push("Select a shift date.");
    if (!payload.startTime || !payload.endTime) issues.push("Select start and end time.");
    if (payload.startTime >= payload.endTime) issues.push("End time must be after start time.");
    if (payload.mode === "bulk" && (!payload.bulkEndDate || payload.bulkEndDate < payload.startDate)) issues.push("Bulk end date must be after the start date.");
    if (payload.mode === "bulk" && payload.bulkDaysOfWeek.length === 0) issues.push("Select at least one bulk shift day.");
    if (payload.mode === "recurring" && payload.recurrenceType !== "none" && payload.recurrenceEndCondition === "date" && !payload.recurrenceEndDate) issues.push("Select a recurrence end date.");
    if (payload.manualRateOverride && payload.manualRateOverrideReason === "none") issues.push("Rate override reason is required.");
    return issues;
  }, [payload]);

  const canPreview = validation.length === 0;

  async function runPreview() {
    if (!canPreview) {
      setError(validation[0] ?? "Complete required fields.");
      return;
    }
    setPreviewLoading(true);
    setError("");
    try {
      const result = await previewPremiumShift(payload);
      setPreview(result);
      setStep(4);
    } catch (err: any) {
      setError(err.message ?? "Preview failed. Please check the shift details.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleCreate() {
    if (!canPreview) {
      setError(validation[0] ?? "Complete required fields.");
      return;
    }
    setCreateLoading(true);
    setError("");
    try {
      const result = await createPremiumShift(payload);
      setSuccessToast(result.message || `Created ${result.created} shift(s).`);
      window.setTimeout(() => {
        setSuccessToast("");
        onSuccess();
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message ?? "Failed to create shift.");
    } finally {
      setCreateLoading(false);
    }
  }

  if (!open) return null;

  const tog = (key: string) =>
    setOpenSections(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const sOpen = (key: string) => openSections.has(key);

  const fieldStyle: React.CSSProperties = {
    height: 38, border: "1px solid #E6EBF2", borderRadius: 6,
    background: "#FFFFFF", fontSize: 13, color: "#111827",
    width: "100%", boxShadow: "none",
  };

  const drawerLabelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 500, color: "#374151",
    display: "flex", alignItems: "center",
  };

  return (
    <>
      {/* Dim overlay */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(17,24,39,0.26)",
          zIndex: 40,
          animation: "pf-fade-in 160ms ease-out forwards",
        }}
      />

      {/* Shadow strip left of drawer */}
      <div style={{
        position: "fixed", top: 0, bottom: 0, right: 620, width: 56,
        pointerEvents: "none", zIndex: 49,
        background: "linear-gradient(to left, rgba(15,23,42,0.14), rgba(15,23,42,0.05), rgba(15,23,42,0))",
      }} />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(620px, 88vw)",
        zIndex: 50,
        background: "#FFFFFF",
        borderLeft: "1px solid #E6EBF2",
        boxShadow: "-14px 0 28px rgba(15,23,42,0.12), -4px 0 10px rgba(15,23,42,0.06)",
        display: "flex", flexDirection: "column",
        animation: "pf-slide-in 220ms cubic-bezier(0.22,1,0.36,1) forwards",
      }}>

        {/* ─── Header ─────────────────────────────────────────────── */}
        <div style={{
          height: 72, padding: "0 24px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid #E6EBF2", background: "#FFFFFF",
        }}>
          <button onClick={onClose} style={{ height: 36, padding: "0 12px", border: "1px solid #E6EBF2", borderRadius: 8, background: "#FFFFFF", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <X style={{ width: 14, height: 14 }} /> Close
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button style={{ height: 36, padding: "0 14px", border: "1px solid #E6EBF2", borderRadius: 8, background: "#FFFFFF", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Advanced edit
            </button>
            <button
              onClick={handleCreate}
              disabled={createLoading || !canPreview}
              style={{ height: 36, padding: "0 14px", border: "1px solid #E6EBF2", borderRadius: 8, background: "#FFFFFF", color: "#2563EB", fontSize: 13, fontWeight: 700, cursor: createLoading || !canPreview ? "not-allowed" : "pointer", opacity: createLoading || !canPreview ? 0.6 : 1 }}
            >
              {createLoading ? "Saving…" : "Save"}
            </button>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 8, background: "transparent", border: "none", color: "#111827", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X style={{ width: 16, height: 16 }} />
            </button>
          </div>
        </div>

        {/* ─── Title strip ─────────────────────────────────────────── */}
        <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid #EEF2F7", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
              {editShift ? "Edit Shift" : "Add Shift"}
            </h2>
            <span style={{ height: 22, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "#EFF6FF", color: "#2563EB", display: "inline-flex", alignItems: "center" }}>
              ProviderFlo Scheduler
            </span>
            <span style={{ height: 22, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: payload.publishStatus === "published" ? "#ECFDF5" : "#FFF7ED", color: payload.publishStatus === "published" ? "#047857" : "#B45309", display: "inline-flex", alignItems: "center" }}>
              {payload.publishStatus === "published" ? "Published" : "Draft"}
            </span>
          </div>
        </div>

        {/* ─── Scrollable body ────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 96px" }}>
          {error && (
            <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} /> {error}
            </div>
          )}

          {/* Shift Template */}
          <ShiftDrawerSection title="Shift Template" sOpen={sOpen("template")} onToggle={() => tog("template")}>
            <Select>
              <SelectTrigger style={fieldStyle}><SelectValue placeholder="Select a template to apply it to this shift." /></SelectTrigger>
              <SelectContent><SelectItem value="none">No template</SelectItem></SelectContent>
            </Select>
          </ShiftDrawerSection>

          {/* Facilities */}
          <ShiftDrawerSection title="Facilities" sOpen={sOpen("facilities")} onToggle={() => tog("facilities")}>
            <p style={{ fontSize: 13, color: "#6B7280", margin: 0 }}>No facilities assigned.</p>
          </ShiftDrawerSection>

          {/* Client */}
          <ShiftDrawerSection title="Client" sOpen={sOpen("client")} onToggle={() => tog("client")}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 14, columnGap: 20, alignItems: "center" }}>
              <span style={drawerLabelStyle}>Choose client</span>
              <Select value={payload.participantId?.toString() ?? ""} onValueChange={v => patch("participantId", Number(v))}>
                <SelectTrigger style={fieldStyle}><SelectValue placeholder="Type to search clients by name..." /></SelectTrigger>
                <SelectContent>
                  {participants.map((p: any) => <SelectItem key={p.id} value={String(p.id)}>{p.firstName} {p.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Price book</span>
              <Select>
                <SelectTrigger style={fieldStyle}><SelectValue placeholder="NDIS 2025–26" /></SelectTrigger>
                <SelectContent><SelectItem value="ndis">NDIS 2025–26</SelectItem></SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Funds</span>
              <Select>
                <SelectTrigger style={fieldStyle}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan">Plan Managed</SelectItem>
                  <SelectItem value="self">Self Managed</SelectItem>
                  <SelectItem value="agency">Agency Managed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedParticipant && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #D7E8FF", fontSize: 13 }}>
                <span style={{ fontWeight: 700, color: "#1E40AF" }}>{selectedParticipant.firstName} {selectedParticipant.lastName}</span>
                {(selectedParticipant as any).ndisNumber && <span style={{ marginLeft: 8, color: "#64748B", fontSize: 12 }}>NDIS: {(selectedParticipant as any).ndisNumber}</span>}
              </div>
            )}
          </ShiftDrawerSection>

          {/* Shift */}
          <ShiftDrawerSection title="Shift" sOpen={sOpen("shift")} onToggle={() => tog("shift")}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 14, columnGap: 20, alignItems: "center" }}>
              <span style={drawerLabelStyle}>Shift type</span>
              <Select value={payload.shiftKind} onValueChange={(v: ShiftKind) => patch("shiftKind", v)}>
                <SelectTrigger style={fieldStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#94A3B8", flexShrink: 0, display: "inline-block" }} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard shift</SelectItem>
                  <SelectItem value="community_access">Community access</SelectItem>
                  <SelectItem value="transport">Transport</SelectItem>
                  <SelectItem value="sleepover">Sleepover</SelectItem>
                  <SelectItem value="active_overnight">Active overnight</SelectItem>
                  <SelectItem value="telehealth">Telehealth</SelectItem>
                  <SelectItem value="non_face_to_face">Non-face-to-face</SelectItem>
                </SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Mode</span>
              <div style={{ display: "flex", gap: 6 }}>
                {(["single", "recurring", "bulk"] as ShiftMode[]).map(m => (
                  <button key={m} type="button" onClick={() => patch("mode", m)}
                    style={{ flex: 1, height: 36, borderRadius: 6, border: `1px solid ${payload.mode === m ? "#0B1736" : "#E6EBF2"}`, background: payload.mode === m ? "#0B1736" : "#FFFFFF", color: payload.mode === m ? "#FFFFFF" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" }}>
                    {m}
                  </button>
                ))}
              </div>
              <span style={drawerLabelStyle}>Additional types</span>
              <Select>
                <SelectTrigger style={fieldStyle}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem></SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Allowance</span>
              <Select>
                <SelectTrigger style={fieldStyle}><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem></SelectContent>
              </Select>
            </div>
          </ShiftDrawerSection>

          {/* Time & Location */}
          <ShiftDrawerSection title="Time & Location" sOpen={sOpen("time")} onToggle={() => tog("time")}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 14, columnGap: 20, alignItems: "start" }}>
              <span style={{ ...drawerLabelStyle, paddingTop: 8 }}>Date</span>
              <div>
                <Input type="date" value={payload.startDate} onChange={e => patch("startDate", e.target.value)} style={{ ...fieldStyle, width: "100%" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" style={{ accentColor: "#2563EB" }} />
                  Shift finishes the next day
                </label>
              </div>
              <span style={{ ...drawerLabelStyle, paddingTop: 10 }}>Time</span>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Input type="time" value={payload.startTime} onChange={e => patch("startTime", e.target.value)} style={{ ...fieldStyle, width: 140 }} />
                <span style={{ color: "#6B7280", fontSize: 13 }}>–</span>
                <Input type="time" value={payload.endTime} onChange={e => patch("endTime", e.target.value)} style={{ ...fieldStyle, width: 140 }} />
              </div>
              {payload.startTime >= payload.endTime && payload.startTime && payload.endTime && (
                <><span /><p style={{ fontSize: 12, color: "#DC2626", margin: "2px 0 0" }}>End time must be after start time</p></>
              )}
              <span style={drawerLabelStyle}>Break (mins)</span>
              <Input type="number" min={0} value={payload.breakMinutes} onChange={e => patch("breakMinutes", Number(e.target.value || 0))} style={{ ...fieldStyle, width: 100 }} />
              <span style={drawerLabelStyle}>Location source</span>
              <Select value={payload.startLocationSource} onValueChange={(v: LocationSource) => patch("startLocationSource", v)}>
                <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="participant_home">Participant home</SelectItem>
                  <SelectItem value="provider_office">Provider office</SelectItem>
                  <SelectItem value="custom">Custom location</SelectItem>
                  <SelectItem value="none">No location</SelectItem>
                </SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Address</span>
              <AddressAutocomplete
                value={payload.startAddress}
                onChange={v => { patch("startAddress", v); patch("endAddress", v); }}
                placeholder={payload.startLocationSource === "custom" ? "Search shift location…" : "Override location (optional)…"}
              />
            </div>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "10px 14px", borderRadius: 8, border: "1px solid #E6EBF2", fontSize: 13, color: "#374151", cursor: "pointer" }}>
              Public holiday rate
              <input type="checkbox" checked={payload.isPublicHoliday} onChange={e => patch("isPublicHoliday", e.target.checked)} style={{ accentColor: "#2563EB" }} />
            </label>
          </ShiftDrawerSection>

          {/* Worker */}
          <ShiftDrawerSection title="Worker" sOpen={sOpen("worker")} onToggle={() => tog("worker")}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 14, columnGap: 20, alignItems: "center" }}>
              <span style={drawerLabelStyle}>Assign worker</span>
              <Select value={payload.staffId?.toString() ?? "unassigned"} onValueChange={v => patch("staffId", v === "unassigned" ? null : Number(v))}>
                <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned shift</SelectItem>
                  {staff.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Publish status</span>
              <Select value={payload.publishStatus} onValueChange={(v: ShiftPublishStatus) => patch("publishStatus", v)}>
                <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft / unpublished</SelectItem>
                  <SelectItem value="published">Published to worker app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {selectedStaff && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 8, background: "#F8FAFC", border: "1px solid #E6EBF2", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{selectedStaff.firstName} {selectedStaff.lastName}</div>
                  <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>Selected worker</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", background: "#ECFDF5", borderRadius: 999, padding: "4px 10px" }}>Available</div>
              </div>
            )}
          </ShiftDrawerSection>

          {/* Recurrence / Bulk (conditional) */}
          {payload.mode !== "single" && (
            <ShiftDrawerSection
              title={payload.mode === "recurring" ? "Recurrence" : "Bulk Date Range"}
              sOpen={sOpen("recurrence")}
              onToggle={() => tog("recurrence")}
            >
              {payload.mode === "recurring" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, alignItems: "center" }}>
                    <span style={drawerLabelStyle}>Repeat</span>
                    <Select value={payload.recurrenceType} onValueChange={(v: any) => patch("recurrenceType", v)}>
                      <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Does not repeat</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <span style={drawerLabelStyle}>End condition</span>
                    <Select value={payload.recurrenceEndCondition} onValueChange={(v: any) => patch("recurrenceEndCondition", v)}>
                      <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No end / max 1 year</SelectItem>
                        <SelectItem value="date">By date</SelectItem>
                        <SelectItem value="count">After count</SelectItem>
                      </SelectContent>
                    </Select>
                    {payload.recurrenceEndCondition === "date" && (
                      <><span style={drawerLabelStyle}>End date</span>
                      <Input type="date" value={payload.recurrenceEndDate || ""} onChange={e => patch("recurrenceEndDate", e.target.value)} style={{ ...fieldStyle, width: "100%" }} /></>
                    )}
                    {payload.recurrenceEndCondition === "count" && (
                      <><span style={drawerLabelStyle}>Occurrences</span>
                      <Input type="number" min={1} max={365} value={payload.recurrenceCount || 12} onChange={e => patch("recurrenceCount", Number(e.target.value || 1))} style={{ ...fieldStyle, width: 100 }} /></>
                    )}
                  </div>
                  {["weekly", "fortnightly", "custom"].includes(payload.recurrenceType) && (
                    <div>
                      <p style={{ ...drawerLabelStyle, marginBottom: 8 }}>Repeat days</p>
                      <DayToggle selected={payload.recurrenceDays} onChange={v => patch("recurrenceDays", v)} />
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 14, columnGap: 20, alignItems: "start" }}>
                  <span style={drawerLabelStyle}>Bulk end date</span>
                  <Input type="date" value={payload.bulkEndDate || ""} onChange={e => patch("bulkEndDate", e.target.value)} style={{ ...fieldStyle, width: "100%" }} />
                  <span style={{ ...drawerLabelStyle, paddingTop: 6 }}>Days of week</span>
                  <DayToggle selected={payload.bulkDaysOfWeek} onChange={v => patch("bulkDaysOfWeek", v)} />
                </div>
              )}
            </ShiftDrawerSection>
          )}

          {/* Billing */}
          <ShiftDrawerSection title="Billing" sOpen={sOpen("billing")} onToggle={() => tog("billing")}>
            <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", rowGap: 14, columnGap: 20, alignItems: "center" }}>
              <span style={drawerLabelStyle}>NDIS support type</span>
              <Select value={payload.supportTypeId} onValueChange={v => patch("supportTypeId", v)}>
                <SelectTrigger style={fieldStyle}><SelectValue placeholder="Select support type…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectGroup key={cat}>
                      <SelectLabel style={{ fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: "#9CA3AF", padding: "6px 8px" }}>{cat}</SelectLabel>
                      {getSupportTypesByCategory(cat).map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Day rate type</span>
              <Select value={payload.dayRateType} onValueChange={v => patch("dayRateType", v)}>
                <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DAY_RATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              <span style={drawerLabelStyle}>Hourly rate ($)</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Input type="number" min={0} step={0.01} value={payload.hourlyRate ?? ""} onChange={e => patch("hourlyRate", e.target.value ? Number(e.target.value) : null)} style={{ ...fieldStyle, width: 120 }} />
                <span style={{ fontSize: 13, color: "#6B7280" }}>/ hr</span>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={payload.manualRateOverride} onChange={e => patch("manualRateOverride", e.target.checked)} style={{ accentColor: "#2563EB" }} />
                  Override
                </label>
              </div>
              {payload.manualRateOverride && (
                <><span style={drawerLabelStyle}>Override reason</span>
                <Select value={payload.manualRateOverrideReason} onValueChange={(v: any) => patch("manualRateOverrideReason", v)}>
                  <SelectTrigger style={fieldStyle}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select reason…</SelectItem>
                    <SelectItem value="service_agreement">Service agreement rate</SelectItem>
                    <SelectItem value="manual_adjustment">Manual adjustment</SelectItem>
                    <SelectItem value="custom_quote">Custom quote</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select></>
              )}
              <span style={drawerLabelStyle}>Travel time (min)</span>
              <Input type="number" min={0} value={payload.travelTimeMinutes} onChange={e => patch("travelTimeMinutes", Number(e.target.value || 0))} style={{ ...fieldStyle, width: 100 }} />
              <span style={drawerLabelStyle}>Kilometres</span>
              <Input type="number" min={0} step={0.1} value={payload.travelKilometres} onChange={e => patch("travelKilometres", Number(e.target.value || 0))} style={{ ...fieldStyle, width: 100 }} />
            </div>
            {payload.ndisLineItem && (
              <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #D7E8FF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1E40AF", fontFamily: "monospace" }}>{payload.ndisLineItem}</div>
                  <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{payload.supportDescription}</div>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#0B1736" }}>${Number(payload.hourlyRate ?? 0).toFixed(2)}/hr</div>
              </div>
            )}
            <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, border: "1px solid #E6EBF2", background: "#F8FAFC" }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#9CA3AF", marginBottom: 8 }}>Estimated billing</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151" }}><span>Billable hours</span><b>{billableHours.toFixed(2)}h</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#374151" }}><span>Support cost</span><b>{money(estimatedBase)}</b></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "#0B1736", borderTop: "1px solid #E6EBF2", paddingTop: 6, marginTop: 2 }}><span>Estimated total</span><b>{money(estimatedTotal)}</b></div>
              </div>
            </div>
          </ShiftDrawerSection>

          {/* Notes & Instructions */}
          <ShiftDrawerSection title="Notes & Instructions" sOpen={sOpen("notes")} onToggle={() => tog("notes")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Worker instructions</label>
                <Textarea value={payload.workerInstructions} onChange={e => patch("workerInstructions", e.target.value)} rows={3} placeholder="Describe what the worker needs to do…" style={{ borderRadius: 6, border: "1px solid #E6EBF2", fontSize: 13, width: "100%", resize: "none", background: "#FFFFFF" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Participant notes</label>
                <Textarea value={payload.participantNotes} onChange={e => patch("participantNotes", e.target.value)} rows={2} placeholder="Notes about the participant visible to the worker…" style={{ borderRadius: 6, border: "1px solid #E6EBF2", fontSize: 13, width: "100%", resize: "none", background: "#FFFFFF" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 6 }}>Internal notes (admin only)</label>
                <Textarea value={payload.internalNotes} onChange={e => patch("internalNotes", e.target.value)} rows={2} placeholder="Internal admin notes — not shown to workers…" style={{ borderRadius: 6, border: "1px solid #E6EBF2", fontSize: 13, width: "100%", resize: "none", background: "#FFFFFF" }} />
              </div>
            </div>
          </ShiftDrawerSection>

          {/* Mobile Controls */}
          <ShiftDrawerSection title="Mobile Controls" sOpen={sOpen("mobile")} onToggle={() => tog("mobile")}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "GPS clock-in required",           key: "requireGpsClockIn" as const,          value: payload.requireGpsClockIn },
                { label: "Participant signature required",  key: "requireParticipantSignature" as const, value: payload.requireParticipantSignature },
                { label: "Allow mobile notes",             key: "allowMobileNotes" as const,            value: payload.allowMobileNotes },
              ].map(({ label, key, value }) => (
                <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 8, border: "1px solid #E6EBF2", fontSize: 13, color: "#374151", cursor: "pointer", background: "#FFFFFF" }}>
                  {label}
                  <input type="checkbox" checked={value} onChange={e => patch(key, e.target.checked)} style={{ accentColor: "#2563EB", width: 16, height: 16 }} />
                </label>
              ))}
            </div>
          </ShiftDrawerSection>

          {/* Preview & Validation */}
          <ShiftDrawerSection title="Preview & Validation" sOpen={sOpen("preview")} onToggle={() => tog("preview")}>
            {!preview && !previewLoading && (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 12 }}>
                  {canPreview ? "Click Preview to see shift schedule, conflicts and estimated cost." : validation[0]}
                </p>
                <button
                  onClick={runPreview}
                  disabled={!canPreview || previewLoading}
                  style={{ height: 38, padding: "0 18px", borderRadius: 8, background: canPreview ? "#0B1736" : "#E2E8F0", border: "none", color: canPreview ? "#FFFFFF" : "#9CA3AF", fontSize: 13, fontWeight: 600, cursor: canPreview ? "pointer" : "not-allowed" }}
                >
                  Run Preview
                </button>
              </div>
            )}
            {previewLoading && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 0", color: "#6B7280", fontSize: 13 }}>
                <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Generating preview…
              </div>
            )}
            {preview && !previewLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Total shifts",  value: preview.summary.totalShifts,     color: "#0B1736", bg: "#EFF6FF" },
                    { label: "Valid",         value: preview.summary.validShifts,      color: "#059669", bg: "#ECFDF5" },
                    { label: "Conflicts",     value: preview.summary.conflictedShifts, color: "#DC2626", bg: "#FEF2F2" },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ padding: 10, borderRadius: 8, background: bg, textAlign: "center" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
                      <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {preview.warnings.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: w.severity === "critical" ? "#FEF2F2" : "#FFF7ED", border: `1px solid ${w.severity === "critical" ? "#FECACA" : "#FDE7B2"}`, fontSize: 13, color: w.severity === "critical" ? "#DC2626" : "#92400E" }}>
                    <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} /> {w.message}
                  </div>
                ))}
                {preview.summary.conflictedShifts > 0 && (
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, border: "1px solid #FDE7B2", background: "#FFF7ED", fontSize: 13, color: "#92400E", cursor: "pointer" }}>
                    <input type="checkbox" checked={payload.skipConflicts} onChange={e => patch("skipConflicts", e.target.checked)} style={{ accentColor: "#0B1736" }} />
                    Skip {preview.summary.conflictedShifts} conflicting shifts
                  </label>
                )}
                <div style={{ borderRadius: 8, border: "1px solid #E6EBF2", overflow: "hidden" }}>
                  <div style={{ overflowY: "auto", maxHeight: 240 }}>
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E6EBF2" }}>
                          {["Date", "Time", "Hours", "Line item", "Est. cost", "Status"].map(h => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#64748B" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.shifts.map((s, i) => (
                          <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: s.hasConflict ? "#FEF9F9" : i % 2 === 0 ? "#FFF" : "#FAFAFA" }}>
                            <td style={{ padding: "8px 10px", fontWeight: 500, color: "#111827" }}>{s.date}</td>
                            <td style={{ padding: "8px 10px", color: "#374151" }}>{s.start}–{s.end}</td>
                            <td style={{ padding: "8px 10px", color: "#374151" }}>{s.billableHours.toFixed(1)}h</td>
                            <td style={{ padding: "8px 10px" }}>
                              {s.lineItem ? <span style={{ fontFamily: "monospace", fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "#EFF6FF", color: "#1D4ED8" }}>{s.lineItem}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}
                            </td>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0B1736" }}>{s.estimatedCost > 0 ? `$${s.estimatedCost.toFixed(2)}` : "—"}</td>
                            <td style={{ padding: "8px 10px" }}>
                              {s.hasConflict
                                ? <span style={{ color: "#DC2626", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle style={{ width: 12, height: 12 }} /> Conflict</span>
                                : <span style={{ color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle2 style={{ width: 12, height: 12 }} /> OK</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </ShiftDrawerSection>
        </div>

        {/* ─── Sticky footer ───────────────────────────────────────── */}
        <div style={{
          height: 72, padding: "0 24px", flexShrink: 0,
          borderTop: "1px solid #E6EBF2",
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <button onClick={onClose} style={{ height: 38, padding: "0 14px", border: "none", background: "transparent", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Cancel
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={runPreview}
              disabled={!canPreview || previewLoading}
              style={{ height: 38, padding: "0 16px", border: "1px solid #E6EBF2", borderRadius: 8, background: "#FFFFFF", color: "#374151", fontSize: 13, fontWeight: 600, cursor: !canPreview || previewLoading ? "not-allowed" : "pointer", opacity: !canPreview || previewLoading ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}
            >
              <Sparkles style={{ width: 14, height: 14 }} /> Preview
            </button>
            <button
              onClick={handleCreate}
              disabled={createLoading || !canPreview}
              style={{ height: 38, padding: "0 18px", borderRadius: 8, background: "#2563EB", border: "1px solid #2563EB", color: "#FFFFFF", fontSize: 13, fontWeight: 700, cursor: createLoading || !canPreview ? "not-allowed" : "pointer", opacity: createLoading || !canPreview ? 0.7 : 1, display: "flex", alignItems: "center", gap: 6 }}
            >
              {createLoading
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Creating…</>
                : payload.publishStatus === "published" ? "Create & Publish" : "Create Draft"}
            </button>
          </div>
        </div>
      </div>

      {successToast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 80, padding: "12px 20px", borderRadius: 10, background: "#0B1736", color: "#FFFFFF", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", whiteSpace: "nowrap" }}>
          {successToast}
        </div>
      )}
    </>
  );
}
