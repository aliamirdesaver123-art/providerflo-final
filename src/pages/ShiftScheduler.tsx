/**
 * ProviderFlo — Shift Scheduler (all-in-one file)
 *
 * Contains:
 *   • All TypeScript types
 *   • All API helper functions
 *   • CopyWeekModal
 *   • RecurringShiftModal (recurring + bulk modes)
 *   • PremiumAddShiftModal (4-step wizard)
 *   • Roster page (default export)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import AppLayout from "@/components/layout/AppLayout";
import {
  useListShifts, useCreateShift, useDeleteShift, useUpdateShift,
  useListParticipants, useListStaff, getListShiftsQueryKey,
} from "@workspace/api-client-react";
import {
  format, startOfWeek, addDays, parseISO, differenceInMinutes,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Filter,
  MoreHorizontal, Megaphone, UserCheck, Users, Building2, Clock,
  Sparkles, RefreshCw, Lock, Pencil, Calendar, Shield, CalendarDays,
  AlertTriangle, CheckCircle2, Info, Zap, Repeat, Copy, LayoutList,
  BadgeDollarSign, Brain, FileText, Loader2, MapPin, Route,
  ShieldCheck, UserCheck as UserCheckIcon, Lock as LockIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { fetchWithAuthJson } from "@/lib/fetchWithAuth";
import {
  NDIS_SUPPORT_TYPES, detectDayRateType, getCategories,
  getSupportTypesByCategory, getSupportTypeById, getLineItem,
  DAY_RATE_LABELS, type DayRateType,
} from "@/lib/ndis-catalogue";


/* ══════════════════════════════════════════════════════════════════════════
   TYPES  (from schedulerTypes.ts)
   ══════════════════════════════════════════════════════════════════════════ */

type ShiftMode = "single" | "recurring" | "bulk";
type ShiftPublishStatus = "draft" | "published";
type ShiftKind =
  | "standard" | "sleepover" | "active_overnight"
  | "community_access" | "transport" | "telehealth" | "non_face_to_face";
type LocationSource = "participant_home" | "provider_office" | "custom" | "none";
type RateOverrideReason =
  | "none" | "service_agreement" | "manual_adjustment" | "custom_quote" | "other";

interface PremiumShiftPayload {
  mode: ShiftMode;
  participantId: number | null;
  staffId: number | null;
  publishStatus: ShiftPublishStatus;
  shiftKind: ShiftKind;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  startLocationSource: LocationSource;
  endLocationSource: LocationSource;
  startAddress: string;
  endAddress: string;
  recurrenceType: "none" | "daily" | "weekly" | "fortnightly" | "monthly" | "custom";
  recurrenceInterval: number;
  recurrenceDays: number[];
  recurrenceEndCondition: "none" | "date" | "count";
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  bulkEndDate?: string;
  bulkDaysOfWeek: number[];
  isPublicHoliday: boolean;
  supportCategory: string;
  supportTypeId: string;
  dayRateType: string;
  ndisLineItem: string;
  supportDescription: string;
  hourlyRate: number | null;
  manualRateOverride: boolean;
  manualRateOverrideReason: RateOverrideReason;
  manualRateOverrideNote: string;
  travelTimeMinutes: number;
  travelKilometres: number;
  mileageRate: number;
  billTravelTime: boolean;
  billKilometres: boolean;
  nonFaceToFace: boolean;
  workerInstructions: string;
  participantNotes: string;
  internalNotes: string;
  tasks: Array<{ id: string; label: string; required: boolean }>;
  requireGpsClockIn: boolean;
  requireParticipantSignature: boolean;
  allowMobileNotes: boolean;
  skipConflicts: boolean;
}

interface PremiumShiftPreview {
  summary: {
    totalShifts: number;
    validShifts: number;
    conflictedShifts: number;
    totalBillableHours: number;
    estimatedInvoiceTotal: number;
    estimatedTravelTotal: number;
    estimatedGrandTotal: number;
  };
  selectedLineItem: {
    code: string | null;
    description: string | null;
    rate: number | null;
    dayRateType: string | null;
  };
  warnings: Array<{
    code: string;
    severity: "critical" | "warning" | "info";
    message: string;
  }>;
  aiWorkerSuggestions: Array<{
    staffId: number;
    name: string;
    score: number;
    reasons: string[];
    risks: string[];
  }>;
  shifts: Array<{
    date: string;
    start: string;
    end: string;
    billableHours: number;
    lineItem: string | null;
    rate: number | null;
    estimatedCost: number;
    hasConflict: boolean;
    conflicts: string[];
  }>;
}


/* ══════════════════════════════════════════════════════════════════════════
   API HELPERS  (from schedulerApi.ts + auth helpers)
   ══════════════════════════════════════════════════════════════════════════ */

function authHeaders() {
  const token = localStorage.getItem("pf_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "Unknown error" }));
  if (!res.ok) throw new Error((data as any).error ?? "Request failed");
  return data as T;
}

async function previewPremiumShift(payload: PremiumShiftPayload): Promise<PremiumShiftPreview> {
  return fetchWithAuthJson<PremiumShiftPreview>("/api/scheduler/premium/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function createPremiumShift(payload: PremiumShiftPayload): Promise<{
  created: number; skipped: number; locked: number; message: string;
}> {
  return fetchWithAuthJson("/api/scheduler/premium/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function getWorkerMatches(payload: PremiumShiftPayload): Promise<{
  suggestions: PremiumShiftPreview["aiWorkerSuggestions"];
}> {
  return fetchWithAuthJson("/api/scheduler/premium/worker-matches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


/* ══════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORIES = getCategories();
const DAY_LABELS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const DAY_LABELS_FULL  = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function uid() { return Math.random().toString(36).slice(2); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function addDaysISO(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function money(value: number | null | undefined) { return `$${Number(value ?? 0).toFixed(2)}`; }
function calcHours(start: string, end: string, breakMinutes: number) {
  if (!start || !end || start >= end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm) - breakMinutes) / 60);
}

/* Avatar */
function getInitials(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
function hslFromName(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return `hsl(${h},55%,42%)`; }
function StaffAvatar({ name, photoUrl, size = 42 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  if (photoUrl && !err)
    return <img src={photoUrl} alt={name} width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size, minWidth: size, border: "2px solid #FFFFFF", boxShadow: "0 4px 10px rgba(15,23,42,0.08)" }} onError={() => setErr(true)} />;
  return <div className="rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ width: size, height: size, minWidth: size, background: hslFromName(name), border: "2px solid #FFFFFF", boxShadow: "0 4px 10px rgba(15,23,42,0.08)" }}>{getInitials(name)}</div>;
}

function formatHours(shifts: any[], staffName: string) {
  const mins = shifts.filter(s => s.staffName === staffName).reduce((sum, s) => {
    try { return sum + differenceInMinutes(parseISO(s.scheduledEnd), parseISO(s.scheduledStart)); } catch { return sum; }
  }, 0);
  return `${(mins / 60).toFixed(1)}h`;
}

function rebuildDatetime(originalIso: string, newDateStr: string): string {
  return `${newDateStr}T${originalIso.slice(11, 19)}`;
}

/* Service-type card palette */
interface SvcColor { bg: string; border: string; timeColor: string; titleColor: string; }
const SVC_MAP: Record<string, SvcColor> = {
  "Personal Care":                       { bg: "linear-gradient(180deg,rgba(37,99,235,0.09) 0%,rgba(37,99,235,0.045) 100%)", border: "rgba(37,99,235,0.22)",  timeColor: "#1D4ED8", titleColor: "#1E40AF" },
  "Assistance with Personal Activities": { bg: "linear-gradient(180deg,rgba(37,99,235,0.09) 0%,rgba(37,99,235,0.045) 100%)", border: "rgba(37,99,235,0.22)",  timeColor: "#1D4ED8", titleColor: "#1E40AF" },
  "High Intensity Daily Activities":     { bg: "linear-gradient(180deg,rgba(239,68,68,0.09) 0%,rgba(239,68,68,0.045) 100%)",  border: "rgba(239,68,68,0.22)",  timeColor: "#DC2626", titleColor: "#B91C1C" },
  "Respite Care":                        { bg: "linear-gradient(180deg,rgba(249,115,22,0.09) 0%,rgba(249,115,22,0.045) 100%)", border: "rgba(249,115,22,0.22)", timeColor: "#C2410C", titleColor: "#9A3412" },
  "Community Access":                    { bg: "linear-gradient(180deg,rgba(16,185,129,0.09) 0%,rgba(16,185,129,0.045) 100%)", border: "rgba(16,185,129,0.22)", timeColor: "#047857", titleColor: "#065F46" },
  "Innovative Community Participation":  { bg: "linear-gradient(180deg,rgba(16,185,129,0.09) 0%,rgba(16,185,129,0.045) 100%)", border: "rgba(16,185,129,0.22)", timeColor: "#047857", titleColor: "#065F46" },
  "Social & Community Participation":    { bg: "linear-gradient(180deg,rgba(124,58,237,0.09) 0%,rgba(124,58,237,0.045) 100%)", border: "rgba(124,58,237,0.22)", timeColor: "#6D28D9", titleColor: "#5B21B6" },
  "Development of Daily Activities":     { bg: "linear-gradient(180deg,rgba(249,115,22,0.09) 0%,rgba(249,115,22,0.045) 100%)", border: "rgba(249,115,22,0.22)", timeColor: "#C2410C", titleColor: "#9A3412" },
  "Daily Activities":                    { bg: "linear-gradient(180deg,rgba(249,115,22,0.09) 0%,rgba(249,115,22,0.045) 100%)", border: "rgba(249,115,22,0.22)", timeColor: "#C2410C", titleColor: "#9A3412" },
};
const SVC_DEFAULT: SvcColor = { bg: "linear-gradient(180deg,rgba(100,116,139,0.08) 0%,rgba(100,116,139,0.04) 100%)", border: "rgba(100,116,139,0.2)", timeColor: "#475569", titleColor: "#334155" };
function getSvcColor(svcType?: string | null): SvcColor {
  if (!svcType) return SVC_DEFAULT;
  for (const [key, val] of Object.entries(SVC_MAP)) {
    if (svcType.toLowerCase().includes(key.toLowerCase().split(" ").slice(0, 2).join(" ").toLowerCase())) return val;
  }
  return SVC_DEFAULT;
}

function getCity(address?: string | null) {
  if (!address) return "";
  const parts = address.split(",").map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";
}

function formatRelativeDate(iso: string) {
  try {
    const d = parseISO(iso);
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
    const dStr = format(d, "yyyy-MM-dd");
    if (dStr === todayStr) return `Today, ${format(d, "h:mmaaa")}`;
    if (dStr === tomorrowStr) return `Tomorrow, ${format(d, "h:mmaaa")}`;
    return format(d, "EEE, d MMM");
  } catch { return iso; }
}

const STAFF_COLORS = [
  { solid: "#2563EB", accent: "#1D4ED8" }, { solid: "#059669", accent: "#047857" },
  { solid: "#7C3AED", accent: "#6D28D9" }, { solid: "#EA580C", accent: "#C2410C" },
  { solid: "#0891B2", accent: "#0E7490" }, { solid: "#DB2777", accent: "#BE185D" },
];

const ALL_SERVICE_TYPES = [
  "Daily Activities", "Personal Care & Daily Activities", "Community Access",
  "Community Participation", "Support Coordination", "Social & Community Participation",
  "Improved Living Arrangements", "Development of Daily Activities",
  "Innovative Community Participation", "High Intensity Daily Activities",
];

/* Shift form schema */
const shiftSchema = z.object({
  participantId: z.number({ required_error: "Required" }),
  staffId: z.number({ required_error: "Required" }),
  scheduledStart: z.string().min(1, "Required"),
  scheduledEnd: z.string().min(1, "Required"),
  ndisSupportTypeId: z.string().optional(),
  dayRateType: z.string().optional(),
  ndisLineItem: z.string().optional(),
  serviceType: z.string().optional(),
  hourlyRate: z.number().optional(),
  supportCategory: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type ShiftForm = z.infer<typeof shiftSchema>;

type ViewMode = "daily" | "weekly" | "fortnightly";


/* ══════════════════════════════════════════════════════════════════════════
   SHARED UI PRIMITIVES
   ══════════════════════════════════════════════════════════════════════════ */

function DayToggle({ selected, onChange }: { selected: number[]; onChange: (v: number[]) => void }) {
  const ordered = [1, 2, 3, 4, 5, 6, 0];
  const toggle = (d: number) =>
    onChange(selected.includes(d) ? selected.filter(x => x !== d) : [...selected, d]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {ordered.map(d => (
        <button key={d} type="button" onClick={() => toggle(d)}
          className={`h-9 w-9 rounded-full text-xs font-extrabold transition ${selected.includes(d) ? "bg-[#102e68] text-white shadow-lg shadow-blue-900/20" : "border border-slate-200 bg-white text-slate-500 hover:border-[#a7b8dc] hover:text-[#102e68]"}`}>
          {DAY_LABELS_SHORT[d]}
        </button>
      ))}
    </div>
  );
}

function StepBar({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2 mb-5">
      {labels.map((label, i) => {
        const n = i + 1; const done = n < step; const current = n === step;
        return (
          <React.Fragment key={n}>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="rounded-full flex items-center justify-center font-bold transition-all"
                style={{ width: 24, height: 24, fontSize: 11, background: done ? "#10B981" : current ? "#0B2F6B" : "#E2E8F0", color: done || current ? "#FFF" : "#94A3B8" }}>
                {done ? "✓" : n}
              </div>
              <span style={{ fontSize: 11, fontWeight: current ? 700 : 500, color: current ? "#0B1F3A" : "#94A3B8" }}>{label}</span>
            </div>
            {i < total - 1 && <div className="flex-1 h-px" style={{ background: done ? "#10B981" : "#E2E8F0", minWidth: 8 }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "green" | "amber" | "red" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700 border-slate-200",
    blue: "bg-[#eef4ff] text-[#25498f] border-[#d7e4ff]",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[tone]}`}>{children}</span>;
}

function Panel({ title, icon, children, subtitle }: { title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="mb-3 flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#edf4ff] text-[#163b7a]">{icon}</div>
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

function WeekNav({ label, monday, onChange }: { label: string; monday: Date; onChange: (d: Date) => void }) {
  const sun = addDays(monday, 6);
  const weekLabel = `${format(monday, "d MMM")} – ${format(sun, "d MMM yyyy")}`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(addDays(monday, -7))} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors" style={{ border: "1px solid #E2E8F0" }}>
        <ChevronLeft className="w-4 h-4" style={{ color: "#64748B" }} />
      </button>
      <div className="flex-1 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#94A3B8" }}>{label}</p>
        <p className="text-sm font-bold" style={{ color: "#0B1F3A" }}>{weekLabel}</p>
      </div>
      <button type="button" onClick={() => onChange(addDays(monday, 7))} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors" style={{ border: "1px solid #E2E8F0" }}>
        <ChevronRight className="w-4 h-4" style={{ color: "#64748B" }} />
      </button>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   COPY WEEK MODAL
   ══════════════════════════════════════════════════════════════════════════ */

interface CopyWeekProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: any[];
  staff: any[];
}

interface CopyWeekPreviewShift {
  date: string; dayLabel: string; scheduledStart: string; scheduledEnd: string;
  staffId: number | null; participantId: number; serviceType: string | null;
  ndisLineItem: string | null; hourlyRate: string | null;
  conflicts: string[]; hasConflict: boolean;
}
interface CopyWeekPreviewResult {
  shifts: CopyWeekPreviewShift[];
  summary: { total: number; valid: number; conflicted: number };
}

function CopyWeekModal({ open, onClose, onSuccess, participants, staff }: CopyWeekProps) {
  const thisMonday = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [sourceMonday, setSourceMonday] = useState<Date>(thisMonday);
  const [destMonday, setDestMonday]     = useState<Date>(addDays(thisMonday, 7));
  const [filterParticipant, setFilterParticipant] = useState<string>("all");
  const [filterStaff, setFilterStaff]             = useState<string>("all");
  const [skipConflicts, setSkipConflicts]         = useState(true);
  const [preview, setPreview]             = useState<CopyWeekPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]   = useState("");
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState("");
  const [toast, setToast]                 = useState("");

  useEffect(() => {
    if (open) {
      const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
      setSourceMonday(mon); setDestMonday(addDays(mon, 7));
      setFilterParticipant("all"); setFilterStaff("all");
      setSkipConflicts(true); setPreview(null); setPreviewError(""); setCreateError("");
    }
  }, [open]);

  useEffect(() => { setPreview(null); setPreviewError(""); }, [sourceMonday, destMonday, filterParticipant, filterStaff]);

  const weeksAreSame = format(sourceMonday, "yyyy-MM-dd") === format(destMonday, "yyyy-MM-dd");

  const handlePreview = useCallback(async () => {
    if (weeksAreSame) return;
    setPreviewLoading(true); setPreviewError(""); setPreview(null);
    try {
      const data = await apiPost<CopyWeekPreviewResult>("/api/shifts/copy-week", {
        sourceWeekStart: format(sourceMonday, "yyyy-MM-dd"),
        destWeekStart:   format(destMonday,   "yyyy-MM-dd"),
        participantId: filterParticipant !== "all" ? parseInt(filterParticipant, 10) : undefined,
        staffId:       filterStaff !== "all"       ? parseInt(filterStaff, 10)       : undefined,
        preview: true,
      });
      setPreview(data);
    } catch (e: any) { setPreviewError(e.message ?? "Failed to generate preview"); }
    finally { setPreviewLoading(false); }
  }, [sourceMonday, destMonday, filterParticipant, filterStaff, weeksAreSame]);

  const handleCreate = async () => {
    setCreating(true); setCreateError("");
    try {
      const result: any = await apiPost("/api/shifts/copy-week", {
        sourceWeekStart: format(sourceMonday, "yyyy-MM-dd"),
        destWeekStart:   format(destMonday,   "yyyy-MM-dd"),
        participantId: filterParticipant !== "all" ? parseInt(filterParticipant, 10) : undefined,
        staffId:       filterStaff !== "all"       ? parseInt(filterStaff, 10)       : undefined,
        skipConflicts, preview: false,
      });
      setToast(`✓ ${result.created} shifts copied${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`);
      setTimeout(() => { setToast(""); onSuccess(); onClose(); }, 1800);
    } catch (e: any) { setCreateError(e.message ?? "Failed to copy shifts"); }
    finally { setCreating(false); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ maxHeight: "88vh", border: "1px solid #E5EAF2" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <div className="flex items-center gap-2.5">
            <Copy className="w-5 h-5" style={{ color: "#0B2F6B" }} />
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0B1F3A" }}>Copy Week</h2>
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>Duplicate all shifts from one week to another</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors"><X className="w-4 h-4" style={{ color: "#94A3B8" }} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl p-4" style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}>
              <WeekNav label="Copy FROM" monday={sourceMonday} onChange={setSourceMonday} />
            </div>
            <div className="rounded-xl p-4" style={{ background: "#EFF6FF", border: "1px solid #D7E8FF" }}>
              <WeekNav label="Copy TO" monday={destMonday} onChange={setDestMonday} />
            </div>
          </div>

          {weeksAreSame && (
            <div className="rounded-xl p-3 flex items-center gap-2 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
              <AlertTriangle className="w-4 h-4" style={{ color: "#DC2626" }} />
              <span style={{ color: "#B91C1C" }}>Source and destination weeks must be different</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#94A3B8" }}>Filter by Client</label>
              <Select value={filterParticipant} onValueChange={setFilterParticipant}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All clients</SelectItem>
                  {participants.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#94A3B8" }}>Filter by Staff</label>
              <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="rounded-xl h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All staff</SelectItem>
                  {staff.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!preview && !previewLoading && (
            <Button variant="outline" className="w-full rounded-xl h-10" onClick={handlePreview} disabled={weeksAreSame}>Preview Shifts</Button>
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

          {preview && !previewLoading && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total", value: preview.summary.total, color: "#0B2F6B", bg: "#EFF6FF" },
                  { label: "No Conflict", value: preview.summary.valid, color: "#059669", bg: "#ECFDF5" },
                  { label: "Conflicts", value: preview.summary.conflicted, color: "#DC2626", bg: "#FEF2F2" },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="rounded-xl p-3 text-center" style={{ background: bg, border: `1px solid ${color}25` }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color }}>{value}</p>
                    <p style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</p>
                  </div>
                ))}
              </div>

              {preview.summary.conflicted > 0 && (
                <label className="flex items-center gap-2.5 cursor-pointer rounded-xl p-3.5" style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                  <input type="checkbox" checked={skipConflicts} onChange={e => setSkipConflicts(e.target.checked)} className="accent-[#0B2F6B] w-4 h-4" />
                  <span className="text-sm font-medium" style={{ color: "#92400E" }}>Skip {preview.summary.conflicted} conflicting shifts</span>
                </label>
              )}

              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5EAF2" }}>
                <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0" style={{ background: "#F8FAFC" }}>
                      <tr>
                        {["Date", "Time", "Service Type", "Status"].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: "#64748B", borderBottom: "1px solid #E5EAF2" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.shifts.map((s, i) => (
                        <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "#F1F5F9", background: s.hasConflict ? "#FEF9F9" : i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                          <td className="px-3 py-2 font-medium" style={{ color: "#0B1F3A" }}>{s.dayLabel}</td>
                          <td className="px-3 py-2" style={{ color: "#374151" }}>{s.scheduledStart.slice(11, 16)}–{s.scheduledEnd.slice(11, 16)}</td>
                          <td className="px-3 py-2" style={{ color: "#64748B" }}>{s.serviceType ?? <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                          <td className="px-3 py-2">
                            {s.hasConflict
                              ? <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" style={{ color: "#DC2626" }} /><span style={{ color: "#DC2626", fontWeight: 600 }}>Conflict</span></div>
                              : <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" style={{ color: "#10B981" }} /><span style={{ color: "#10B981", fontWeight: 600 }}>OK</span></div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button onClick={() => { setPreview(null); handlePreview(); }} className="text-xs font-medium underline" style={{ color: "#64748B" }}>Refresh preview</button>

              {createError && (
                <div className="rounded-xl p-3 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626" }}>{createError}</div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Cancel</Button>
          <Button className="rounded-xl gap-1.5" style={{ background: "#0B2F6B" }}
            disabled={!preview || creating || weeksAreSame || (preview.summary.valid === 0 && skipConflicts)}
            onClick={handleCreate}>
            {creating ? <><Loader2 className="w-4 h-4 animate-spin" />Copying…</> : preview ? <>Copy {skipConflicts ? preview.summary.valid : preview.summary.total} Shifts</> : "Copy Shifts"}
          </Button>
        </div>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl" style={{ background: "#0B2F6B", color: "#FFFFFF" }}>{toast}</div>}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   RECURRING / BULK SHIFT MODAL
   ══════════════════════════════════════════════════════════════════════════ */

interface RecurringPreviewShift {
  date: string; dayLabel: string; scheduledStart: string; scheduledEnd: string;
  ndisLineItem: string | null; hourlyRate: number | null;
  estimatedCost: number; conflicts: string[]; hasConflict: boolean;
}
interface RecurringPreviewResult {
  shifts: RecurringPreviewShift[];
  summary: { total: number; valid: number; conflicted: number };
  warnings: string[];
}

interface RecurringShiftModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: any[];
  staff: any[];
  mode: "recurring" | "bulk";
  preselectedStaffId?: number | null;
  preselectedDate?: string | null;
}

function RecurringShiftModal({
  open, onClose, onSuccess, participants, staff, mode, preselectedStaffId, preselectedDate,
}: RecurringShiftModalProps) {
  const [step, setStep] = useState(1);
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [staffId, setStaffId]             = useState<number | null>(preselectedStaffId ?? null);
  const [startDate, setStartDate]         = useState(preselectedDate ?? format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime]         = useState("09:00");
  const [endTime, setEndTime]             = useState("17:00");
  const [address, setAddress]             = useState("");
  const [notes, setNotes]                 = useState("");
  const [recurrenceType, setRecurrenceType]         = useState<string>("weekly");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceDays, setRecurrenceDays]         = useState<number[]>([]);
  const [endCondition, setEndCondition]             = useState<"date" | "count" | "none">("none");
  const [endDate, setEndDate]             = useState("");
  const [occurrenceCount, setOccurrenceCount] = useState(12);
  const [bulkEndDate, setBulkEndDate]     = useState("");
  const [daysOfWeek, setDaysOfWeek]       = useState<number[]>([1, 2, 3, 4, 5]);
  const [supportTypeId, setSupportTypeId] = useState("");
  const [dayRateType, setDayRateType]     = useState("");
  const [serviceType, setServiceType]     = useState("");
  const [supportCategory, setSupportCategory] = useState("");
  const [ndisLineItem, setNdisLineItem]   = useState("");
  const [hourlyRate, setHourlyRate]       = useState<number | null>(null);
  const [preview, setPreview]             = useState<RecurringPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]   = useState("");
  const [skipConflicts, setSkipConflicts] = useState(true);
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState("");
  const [toast, setToast]                 = useState("");

  useEffect(() => {
    if (open) {
      setStep(1); setParticipantId(null); setStaffId(preselectedStaffId ?? null);
      setStartDate(preselectedDate ?? format(new Date(), "yyyy-MM-dd"));
      setStartTime("09:00"); setEndTime("17:00"); setAddress(""); setNotes("");
      setRecurrenceType("weekly"); setRecurrenceInterval(1); setRecurrenceDays([]);
      setEndCondition("none"); setEndDate(""); setOccurrenceCount(12);
      setBulkEndDate(format(addDays(new Date(), 27), "yyyy-MM-dd"));
      setDaysOfWeek([1, 2, 3, 4, 5]); setSupportTypeId(""); setDayRateType("");
      setServiceType(""); setSupportCategory(""); setNdisLineItem(""); setHourlyRate(null);
      setPreview(null); setPreviewError(""); setCreateError("");
    }
  }, [open, preselectedStaffId, preselectedDate]);

  useEffect(() => {
    if (startDate) setDayRateType(detectDayRateType(startDate + "T" + startTime + ":00"));
  }, [startDate, startTime]);

  useEffect(() => {
    if (supportTypeId && dayRateType) {
      const li = getLineItem(supportTypeId, dayRateType as DayRateType);
      if (li) {
        setNdisLineItem(li.code); setHourlyRate(Number(li.rate));
        const st = getSupportTypeById(supportTypeId);
        if (st) { setServiceType(st.name); setSupportCategory(st.category); }
      }
    }
  }, [supportTypeId, dayRateType]);

  const fetchPreview = useCallback(async () => {
    setPreviewLoading(true); setPreviewError(""); setPreview(null);
    try {
      let data: RecurringPreviewResult;
      if (mode === "recurring") {
        data = await apiPost<RecurringPreviewResult>("/api/shifts/recurring/preview", {
          participantId, staffId: staffId ?? undefined, startDate, startTime, endTime,
          recurrenceType, recurrenceInterval, recurrenceDays, endCondition,
          endDate: endCondition === "date" ? endDate : undefined,
          occurrenceCount: endCondition === "count" ? occurrenceCount : undefined,
          ndisLineItem: ndisLineItem || undefined, hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined, supportCategory: supportCategory || undefined,
          address: address || undefined, notes: notes || undefined,
        });
      } else {
        data = await apiPost<RecurringPreviewResult>("/api/shifts/bulk/preview", {
          participantId, staffId: staffId ?? undefined,
          startDate, endDate: bulkEndDate, daysOfWeek, startTime, endTime,
          ndisLineItem: ndisLineItem || undefined, hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined, supportCategory: supportCategory || undefined,
          address: address || undefined, notes: notes || undefined,
        });
      }
      setPreview(data);
    } catch (e: any) { setPreviewError(e.message ?? "Failed to generate preview"); }
    finally { setPreviewLoading(false); }
  }, [mode, participantId, staffId, startDate, startTime, endTime, recurrenceType, recurrenceInterval, recurrenceDays, endCondition, endDate, occurrenceCount, bulkEndDate, daysOfWeek, ndisLineItem, hourlyRate, serviceType, supportCategory, address, notes]);

  useEffect(() => { if (step === 4) void fetchPreview(); }, [step]);

  const handleCreate = async () => {
    setCreating(true); setCreateError("");
    try {
      let result: any;
      if (mode === "recurring") {
        result = await apiPost("/api/shifts/recurring/create", {
          participantId, staffId: staffId ?? undefined, startDate, startTime, endTime,
          recurrenceType, recurrenceInterval, recurrenceDays, endCondition,
          endDate: endCondition === "date" ? endDate : undefined,
          occurrenceCount: endCondition === "count" ? occurrenceCount : undefined,
          ndisLineItem: ndisLineItem || undefined, hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined, supportCategory: supportCategory || undefined,
          address: address || undefined, notes: notes || undefined, skipConflicts,
        });
      } else {
        result = await apiPost("/api/shifts/bulk/create", {
          participantId, staffId: staffId ?? undefined,
          startDate, endDate: bulkEndDate, daysOfWeek, startTime, endTime,
          ndisLineItem: ndisLineItem || undefined, hourlyRate: hourlyRate ?? undefined,
          serviceType: serviceType || undefined, supportCategory: supportCategory || undefined,
          address: address || undefined, notes: notes || undefined, skipConflicts,
        });
      }
      setToast(`✓ ${result.created} shifts created${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`);
      setTimeout(() => { setToast(""); onSuccess(); onClose(); }, 1800);
    } catch (e: any) { setCreateError(e.message ?? "Failed to create shifts"); }
    finally { setCreating(false); }
  };

  const step1Valid = !!participantId && !!startDate && !!startTime && !!endTime && startTime < endTime;
  const step2Valid = mode === "bulk"
    ? !!bulkEndDate && bulkEndDate >= startDate && daysOfWeek.length > 0
    : recurrenceType === "none" || (endCondition !== "date" || !!endDate) && (endCondition !== "count" || occurrenceCount > 0);

  const steps = mode === "recurring"
    ? ["Shift Details", "Recurrence", "NDIS & Rate", "Preview"]
    : ["Shift Details", "Date Range", "NDIS & Rate", "Preview"];

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col" style={{ maxHeight: "92vh", border: "1px solid #E5EAF2" }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <div className="flex items-center gap-2.5">
            {mode === "recurring" ? <Repeat className="w-5 h-5" style={{ color: "#0B2F6B" }} /> : <LayoutList className="w-5 h-5" style={{ color: "#0B2F6B" }} />}
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0B1F3A" }}>{mode === "recurring" ? "Create Recurring Shifts" : "Bulk Create Shifts"}</h2>
              <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 1 }}>{mode === "recurring" ? "Set a shift pattern that repeats automatically" : "Create multiple shifts across a date range"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors"><X className="w-4 h-4" style={{ color: "#94A3B8" }} /></button>
        </div>

        <div className="px-6 pt-4 shrink-0"><StepBar step={step} total={4} labels={steps} /></div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          {/* Step 1: Shift Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Client <span className="text-red-500">*</span></label>
                  <Select value={participantId?.toString() ?? ""} onValueChange={v => setParticipantId(parseInt(v, 10))}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{participants.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Staff Member</label>
                  <Select value={staffId?.toString() ?? "unassigned"} onValueChange={v => setStaffId(v === "unassigned" ? null : parseInt(v, 10))}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Unassigned" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {staff.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>{mode === "recurring" ? "First Occurrence" : "Start Date"} <span className="text-red-500">*</span></label>
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
              {startTime >= endTime && startTime && endTime && <p className="text-xs text-red-500">End time must be after start time</p>}
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Address</label>
                <AddressAutocomplete value={address} onChange={setAddress} placeholder="Search for a shift location…" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Notes</label>
                <Textarea placeholder="Any special instructions or notes…" className="rounded-xl resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
              </div>
            </div>
          )}

          {/* Step 2a: Recurrence */}
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
                  <Input type="number" min={1} max={52} className="rounded-xl h-10 w-20" value={recurrenceInterval} onChange={e => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))} />
                  <span className="text-sm" style={{ color: "#374151" }}>week(s)</span>
                </div>
              )}
              {["weekly", "fortnightly", "custom"].includes(recurrenceType) && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Repeat on days</label>
                  <DayToggle selected={recurrenceDays} onChange={setRecurrenceDays} />
                  {recurrenceDays.length > 0 && <p className="text-xs mt-2" style={{ color: "#94A3B8" }}>{recurrenceDays.sort().map(d => DAY_LABELS_FULL[d]).join(", ")}</p>}
                </div>
              )}
              {recurrenceType !== "none" && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium" style={{ color: "#374151" }}>End condition</label>
                  <div className="flex flex-col gap-2">
                    {(["none", "date", "count"] as const).map(cond => (
                      <label key={cond} className="flex items-center gap-2.5 cursor-pointer">
                        <input type="radio" name="endCondition" checked={endCondition === cond} onChange={() => setEndCondition(cond)} className="accent-[#0B2F6B]" />
                        <span className="text-sm" style={{ color: "#374151" }}>
                          {cond === "none" ? "No end (up to 1 year)" : cond === "date" ? "By date" : "After N occurrences"}
                        </span>
                        {cond === "date" && endCondition === "date" && <Input type="date" className="rounded-xl h-9 w-44 ml-1" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />}
                        {cond === "count" && endCondition === "count" && (
                          <div className="flex items-center gap-2 ml-1">
                            <Input type="number" min={1} max={365} className="rounded-xl h-9 w-20" value={occurrenceCount} onChange={e => setOccurrenceCount(Math.max(1, Math.min(365, parseInt(e.target.value) || 1)))} />
                            <span className="text-sm" style={{ color: "#94A3B8" }}>occurrences</span>
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {endCondition === "none" && recurrenceType !== "none" && (
                <div className="rounded-xl p-3 text-sm flex items-center gap-2" style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                  <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} />
                  <span style={{ color: "#92400E" }}>No end date set — shifts will be generated for up to 1 year.</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2b: Date Range (bulk) */}
          {step === 2 && mode === "bulk" && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Start Date <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl h-10" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>End Date <span className="text-red-500">*</span></label>
                  <Input type="date" className="rounded-xl h-10" value={bulkEndDate} onChange={e => setBulkEndDate(e.target.value)} min={startDate} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: "#374151" }}>Days of week <span className="text-red-500">*</span></label>
                <DayToggle selected={daysOfWeek} onChange={setDaysOfWeek} />
                {daysOfWeek.length === 0 && <p className="text-xs text-red-500 mt-1">Select at least one day</p>}
              </div>
              {startDate && bulkEndDate && daysOfWeek.length > 0 && (
                <div className="rounded-xl p-3.5" style={{ background: "#EFF6FF", border: "1px solid #D7E8FF" }}>
                  <p className="text-sm font-medium" style={{ color: "#1D4ED8" }}>{daysOfWeek.sort().map(d => DAY_LABELS_FULL[d]).join(", ")}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#3B82F6" }}>{startDate} → {bulkEndDate} · shifts generated for selected days</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: NDIS & Rate */}
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
                          {getSupportTypesByCategory(cat).map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "#374151" }}>Day Rate Type</label>
                  <Select value={dayRateType} onValueChange={setDayRateType}>
                    <SelectTrigger className="rounded-xl h-10"><SelectValue placeholder="Auto-detected" /></SelectTrigger>
                    <SelectContent>{Object.entries(DAY_RATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
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
                  <Input type="number" step="0.01" min="0" placeholder="e.g. 67.56" className="rounded-xl h-10 w-36" value={hourlyRate ?? ""} onChange={e => setHourlyRate(e.target.value ? parseFloat(e.target.value) : null)} />
                  <span className="text-sm" style={{ color: "#94A3B8" }}>/ hr</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Preview */}
          {step === 4 && (
            <div className="space-y-4">
              {previewLoading && <div className="flex flex-col items-center justify-center py-12 gap-3"><Loader2 className="w-8 h-8 animate-spin" style={{ color: "#0B2F6B" }} /><p className="text-sm" style={{ color: "#64748B" }}>Generating preview…</p></div>}
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
                  {preview.warnings.map((w, i) => (
                    <div key={i} className="rounded-xl p-3 flex items-center gap-2 text-sm" style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                      <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#D97706" }} /><span style={{ color: "#92400E" }}>{w}</span>
                    </div>
                  ))}
                  {preview.summary.conflicted > 0 && (
                    <label className="flex items-center gap-2.5 cursor-pointer rounded-xl p-3.5" style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                      <input type="checkbox" checked={skipConflicts} onChange={e => setSkipConflicts(e.target.checked)} className="accent-[#0B2F6B] w-4 h-4" />
                      <span className="text-sm font-medium" style={{ color: "#92400E" }}>Skip {preview.summary.conflicted} conflicting shifts (create {preview.summary.valid} valid only)</span>
                    </label>
                  )}
                  <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #E5EAF2" }}>
                    <div className="overflow-y-auto" style={{ maxHeight: 300 }}>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0" style={{ background: "#F8FAFC" }}>
                          <tr>{["Date", "Time", "NDIS Item", "Rate", "Est. Cost", "Status"].map(h => <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: "#64748B", borderBottom: "1px solid #E5EAF2" }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {preview.shifts.map((s, i) => (
                            <tr key={i} className="border-b last:border-b-0" style={{ borderColor: "#F1F5F9", background: s.hasConflict ? "#FEF9F9" : i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                              <td className="px-3 py-2 font-medium" style={{ color: "#0B1F3A" }}>{s.dayLabel}</td>
                              <td className="px-3 py-2" style={{ color: "#374151" }}>{s.scheduledStart.slice(11, 16)}–{s.scheduledEnd.slice(11, 16)}</td>
                              <td className="px-3 py-2">{s.ndisLineItem ? <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ background: "#EFF6FF", color: "#1D4ED8" }}>{s.ndisLineItem}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}</td>
                              <td className="px-3 py-2" style={{ color: "#374151" }}>{s.hourlyRate ? `$${Number(s.hourlyRate).toFixed(2)}/hr` : "—"}</td>
                              <td className="px-3 py-2 font-semibold" style={{ color: "#0B2F6B" }}>{s.estimatedCost > 0 ? `$${s.estimatedCost.toFixed(2)}` : "—"}</td>
                              <td className="px-3 py-2">
                                {s.hasConflict
                                  ? <div className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" style={{ color: "#DC2626" }} /><span style={{ color: "#DC2626", fontWeight: 600 }}>Conflict</span></div>
                                  : <div className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" style={{ color: "#10B981" }} /><span style={{ color: "#10B981", fontWeight: 600 }}>OK</span></div>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {createError && <div className="rounded-xl p-3 text-sm text-red-600" style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>{createError}</div>}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center justify-between shrink-0" style={{ borderColor: "#E5EAF2" }}>
          <Button variant="outline" className="rounded-xl" onClick={step === 1 ? onClose : () => setStep(s => s - 1)}>
            {step === 1 ? "Cancel" : <span className="flex items-center gap-1.5"><ChevronLeft className="w-4 h-4" /> Back</span>}
          </Button>
          <div className="flex items-center gap-2">
            {step < 4 ? (
              <Button className="rounded-xl gap-1.5" disabled={step === 1 ? !step1Valid : step === 2 ? !step2Valid : false} onClick={() => setStep(s => s + 1)} style={{ background: "#0B2F6B" }}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button className="rounded-xl gap-1.5" disabled={creating || previewLoading || !!previewError || !preview || (preview.summary.valid === 0 && skipConflicts)} onClick={handleCreate} style={{ background: "#0B2F6B" }}>
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : <>Create {preview && (skipConflicts ? preview.summary.valid : preview.summary.total)} Shifts</>}
              </Button>
            )}
          </div>
        </div>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl text-sm font-semibold shadow-xl" style={{ background: "#0B2F6B", color: "#FFFFFF" }}>{toast}</div>}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   ADD SHIFT DRAWER  —  helper components
   ══════════════════════════════════════════════════════════════════════════ */

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

/* ══════════════════════════════════════════════════════════════════════════
   PREMIUM ADD SHIFT MODAL  (4-step wizard)
   ══════════════════════════════════════════════════════════════════════════ */

const DEFAULT_PAYLOAD: PremiumShiftPayload = {
  mode: "single", participantId: null, staffId: null, publishStatus: "draft",
  shiftKind: "standard", startDate: todayISO(), startTime: "09:00", endTime: "17:00",
  breakMinutes: 0, startLocationSource: "participant_home", endLocationSource: "participant_home",
  startAddress: "", endAddress: "",
  recurrenceType: "none", recurrenceInterval: 1, recurrenceDays: [],
  recurrenceEndCondition: "none", recurrenceEndDate: "", recurrenceCount: 12,
  bulkEndDate: addDaysISO(27), bulkDaysOfWeek: [1, 2, 3, 4, 5],
  isPublicHoliday: false, supportCategory: "", supportTypeId: "",
  dayRateType: "weekdayDaytime", ndisLineItem: "", supportDescription: "",
  hourlyRate: null, manualRateOverride: false, manualRateOverrideReason: "none",
  manualRateOverrideNote: "", travelTimeMinutes: 0, travelKilometres: 0,
  mileageRate: 0.99, billTravelTime: false, billKilometres: false, nonFaceToFace: false,
  workerInstructions: "", participantNotes: "", internalNotes: "", tasks: [],
  requireGpsClockIn: true, requireParticipantSignature: true, allowMobileNotes: true,
  skipConflicts: true,
};

interface PremiumAddShiftModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  participants: any[];
  staff: any[];
  preselectedStaffId?: number | null;
  preselectedDate?: string | null;
  editShift?: any | null;
}

function PremiumAddShiftModal({
  open, onClose, onSuccess, participants, staff, preselectedStaffId, preselectedDate, editShift,
}: PremiumAddShiftModalProps) {
  const [payload, setPayload] = useState<PremiumShiftPayload>(DEFAULT_PAYLOAD);
  const [step, setStep]               = useState(1);
  const [preview, setPreview]         = useState<PremiumShiftPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading]   = useState(false);
  const [error, setError]             = useState("");
  const [successToast, setSuccessToast] = useState("");
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["client", "shift", "time", "worker"])
  );

  const selectedParticipant = participants.find((p: any) => Number(p.id) === Number(payload.participantId));
  const selectedStaff       = staff.find((s: any) => Number(s.id) === Number(payload.staffId));

  const billableHours  = useMemo(() => calcHours(payload.startTime, payload.endTime, payload.breakMinutes), [payload.startTime, payload.endTime, payload.breakMinutes]);
  const estimatedBase  = billableHours * Number(payload.hourlyRate ?? 0);
  const estimatedTravel =
    (payload.billTravelTime ? (payload.travelTimeMinutes / 60) * Number(payload.hourlyRate ?? 0) : 0) +
    (payload.billKilometres ? payload.travelKilometres * payload.mileageRate : 0);
  const estimatedTotal = estimatedBase + estimatedTravel;

  function patch<K extends keyof PremiumShiftPayload>(key: K, value: PremiumShiftPayload[K]) {
    setPayload(p => ({ ...p, [key]: value })); setPreview(null);
  }

  useEffect(() => {
    if (!open) return;
    setPayload({
      ...DEFAULT_PAYLOAD,
      staffId: preselectedStaffId ?? null,
      startDate: preselectedDate ?? todayISO(),
      bulkEndDate: addDaysISO(27),
      ...(editShift ? {
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
      } : {}),
    });
    setStep(1); setPreview(null); setError("");
  }, [open, preselectedStaffId, preselectedDate, editShift]);

  useEffect(() => {
    setPayload(p => ({ ...p, dayRateType: detectDayRateType(`${p.startDate}T${p.startTime}:00`, p.isPublicHoliday) }));
  }, [payload.startDate, payload.startTime, payload.isPublicHoliday]);

  useEffect(() => {
    if (!payload.supportTypeId || !payload.dayRateType) return;
    const li = getLineItem(payload.supportTypeId, payload.dayRateType as DayRateType);
    const supportType = getSupportTypeById(payload.supportTypeId);
    if (!li || !supportType) return;
    setPayload(p => ({
      ...p, ndisLineItem: li.code,
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
    if (!canPreview) { setError(validation[0] ?? "Complete required fields."); return; }
    setPreviewLoading(true); setError("");
    try { const result = await previewPremiumShift(payload); setPreview(result); setStep(4); }
    catch (err: any) { setError(err.message ?? "Preview failed. Please check the shift details."); }
    finally { setPreviewLoading(false); }
  }

  async function handleCreate() {
    if (!canPreview) { setError(validation[0] ?? "Complete required fields."); return; }
    setCreateLoading(true); setError("");
    try {
      const result = await createPremiumShift(payload);
      setSuccessToast(result.message || `Created ${result.created} shift(s).`);
      window.setTimeout(() => { setSuccessToast(""); onSuccess(); onClose(); }, 1200);
    } catch (err: any) { setError(err.message ?? "Failed to create shift."); }
    finally { setCreateLoading(false); }
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
      {/* Dim overlay — sidebar sits above via its own z-index */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(17,24,39,0.44)",
          zIndex: 40,
          animation: "pf-fade-in 160ms ease-out forwards",
        }}
      />

      {/* Shadow strip left of drawer */}
      <div style={{
        position: "fixed", top: 0, bottom: 0, right: 620, width: 80,
        pointerEvents: "none", zIndex: 49,
        background: "linear-gradient(to left, rgba(17,24,39,0.22), rgba(17,24,39,0.08), rgba(17,24,39,0))",
      }} />

      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(620px, 88vw)",
        zIndex: 50,
        background: "#FFFFFF",
        borderLeft: "1px solid #E6EBF2",
        boxShadow: "-24px 0 48px rgba(15,23,42,0.18), -8px 0 18px rgba(15,23,42,0.10)",
        display: "flex", flexDirection: "column",
        animation: "pf-slide-in 220ms cubic-bezier(0.22,1,0.36,1) forwards",
      }}>

        {/* ─── Header ────────────────────────────────────────────────── */}
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

        {/* ─── Title strip ───────────────────────────────────────────── */}
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

        {/* ─── Scrollable body ───────────────────────────────────────── */}
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
                { label: "GPS clock-in required",            key: "requireGpsClockIn" as const,           value: payload.requireGpsClockIn },
                { label: "Participant signature required",   key: "requireParticipantSignature" as const,  value: payload.requireParticipantSignature },
                { label: "Allow mobile notes",              key: "allowMobileNotes" as const,             value: payload.allowMobileNotes },
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
                    { label: "Total shifts",  value: preview.summary.totalShifts,      color: "#0B1736", bg: "#EFF6FF" },
                    { label: "Valid",         value: preview.summary.validShifts,       color: "#059669", bg: "#ECFDF5" },
                    { label: "Conflicts",     value: preview.summary.conflictedShifts,  color: "#DC2626", bg: "#FEF2F2" },
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

        {/* ─── Sticky footer ─────────────────────────────────────────── */}
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


/* ══════════════════════════════════════════════════════════════════════════
   ROSTER PAGE  (default export)
   ══════════════════════════════════════════════════════════════════════════ */

export default function Roster() {
  const [viewMode, setViewMode]         = useState<ViewMode>("weekly");
  const [rosterView, setRosterView]     = useState<"staff" | "client" | "facilities">("staff");
  const [periodStart, setPeriodStart]   = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showCreate, setShowCreate]     = useState(false);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [multiShiftModal, setMultiShiftModal] = useState<{ shifts: any[]; color: { solid: string; accent: string }; staffName: string } | null>(null);
  const [preselectedStaffId, setPreselectedStaffId] = useState<number | null>(null);
  const [aiSuggestions, setAiSuggestions]   = useState<any>(null);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [optimiserData, setOptimiserData]   = useState<any | null>(null);
  const [optimiserLoading, setOptimiserLoading] = useState(false);
  const [showOptimiser, setShowOptimiser]   = useState(false);
  const [_formParticipantId, setFormParticipantId] = useState<number | null>(null);
  const [_formStart, setFormStart]          = useState("");
  const [_formEnd, setFormEnd]              = useState("");
  const [dragOverCell, setDragOverCell]     = useState<string | null>(null);
  const [showFilter, setShowFilter]         = useState(false);
  const [filterStaffId, setFilterStaffId]   = useState<number | null>(null);
  const [filterParticipantId, setFilterParticipantId] = useState<number | null>(null);
  const [filterServiceType, setFilterServiceType]     = useState<string | null>(null);
  const [filterAssigned, setFilterAssigned] = useState<"all" | "assigned" | "unassigned">("all");
  const [searchQuery, setSearchQuery]       = useState("");
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const dragShiftRef = useRef<{ id: number; shift: any } | null>(null);
  const [showRecurring, setShowRecurring]   = useState(false);
  const [showBulk, setShowBulk]             = useState(false);
  const [showCopyWeek, setShowCopyWeek]     = useState(false);
  const [recurringDeleteDialog, setRecurringDeleteDialog] = useState<{ shift: any } | null>(null);
  const [recurringEditDialog, setRecurringEditDialog]     = useState<{ shift: any } | null>(null);
  const [editScope, setEditScope]           = useState<"this" | "future" | "all">("this");

  const { toast }    = useToast();
  const queryClient  = useQueryClient();
  const [, navigate] = useLocation();

  const dayCount  = viewMode === "daily" ? 1 : viewMode === "fortnightly" ? 14 : 7;
  const periodEnd = addDays(periodStart, dayCount - 1);
  const startDate = format(periodStart, "yyyy-MM-dd");
  const endDate   = format(periodEnd,   "yyyy-MM-dd");

  const { data: shifts = [], isLoading } = useListShifts({ startDate, endDate });
  const { data: participants = [] }      = useListParticipants();
  const { data: staff = [] }             = useListStaff();
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();
  const updateShift = useUpdateShift();

  const [showEdit, setShowEdit]     = useState(false);
  const [editShiftId, setEditShiftId] = useState<number | null>(null);
  const editForm = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: { notes: "", address: "" } });
  const form     = useForm<ShiftForm>({ resolver: zodResolver(shiftSchema), defaultValues: { notes: "", address: "" } });

  const watchedEditStart       = useWatch({ control: editForm.control, name: "scheduledStart" });
  const watchedEditSupportType = useWatch({ control: editForm.control, name: "ndisSupportTypeId" });
  const watchedEditDayRate     = useWatch({ control: editForm.control, name: "dayRateType" });
  const watchedStart           = useWatch({ control: form.control, name: "scheduledStart" });
  const watchedSupportType     = useWatch({ control: form.control, name: "ndisSupportTypeId" });
  const watchedDayRate         = useWatch({ control: form.control, name: "dayRateType" });

  if (watchedStart) { const a = detectDayRateType(watchedStart); if (form.getValues("dayRateType") !== a) form.setValue("dayRateType", a); }
  if (watchedEditStart) { const a = detectDayRateType(watchedEditStart); if (editForm.getValues("dayRateType") !== a) editForm.setValue("dayRateType", a); }
  if (watchedSupportType && watchedDayRate) {
    const li = getLineItem(watchedSupportType, watchedDayRate as DayRateType);
    if (li) { const st = getSupportTypeById(watchedSupportType); const cur = form.getValues(); if (cur.ndisLineItem !== li.code) { form.setValue("ndisLineItem", li.code); form.setValue("hourlyRate", li.rate); if (st) { form.setValue("serviceType", st.name); form.setValue("supportCategory", st.category); } } }
  }
  if (watchedEditSupportType && watchedEditDayRate) {
    const li = getLineItem(watchedEditSupportType, watchedEditDayRate as DayRateType);
    if (li) { const st = getSupportTypeById(watchedEditSupportType); const cur = editForm.getValues(); if (cur.ndisLineItem !== li.code) { editForm.setValue("ndisLineItem", li.code); editForm.setValue("hourlyRate", li.rate); if (st) { editForm.setValue("serviceType", st.name); editForm.setValue("supportCategory", st.category); } } }
  }

  const _openEditForm = (shift: any) => {
    setEditShiftId(shift.id);
    editForm.reset({ participantId: shift.participantId, staffId: shift.staffId ?? undefined, scheduledStart: shift.scheduledStart?.slice(0, 16) ?? "", scheduledEnd: shift.scheduledEnd?.slice(0, 16) ?? "", serviceType: shift.serviceType ?? "", address: shift.address ?? "", notes: shift.notes ?? "", supportCategory: shift.supportCategory ?? "", ndisLineItem: shift.ndisLineItem ?? "", hourlyRate: shift.hourlyRate ? Number(shift.hourlyRate) : undefined });
    setSelectedShift(null); setShowEdit(true);
  };
  const handleEditOpen = (shift: any) => { if (shift?.seriesId) { setRecurringEditDialog({ shift }); return; } _openEditForm(shift); };
  const handleSeriesEditConfirm = (scope: "this" | "future" | "all") => {
    const s = recurringEditDialog?.shift; if (!s) return;
    setEditScope(scope); setRecurringEditDialog(null); _openEditForm(s);
  };
  const handleEditSubmit = async (data: ShiftForm) => {
    if (!editShiftId) return;
    const { ndisSupportTypeId, dayRateType, ...rest } = data;
    if (editScope === "future" || editScope === "all") {
      const editingShift = (shifts as any[]).find(s => s.id === editShiftId);
      if (editingShift?.seriesId) {
        try {
          const startT = rest.scheduledStart?.slice(11, 16); const endT = rest.scheduledEnd?.slice(11, 16);
          const body: Record<string, any> = { scope: editScope, fromDate: editingShift.scheduledStart?.slice(0, 10), updates: { staffId: rest.staffId ?? null, participantId: rest.participantId, startTime: startT, endTime: endT, serviceType: rest.serviceType, supportCategory: rest.supportCategory, ndisLineItem: rest.ndisLineItem, hourlyRate: rest.hourlyRate, address: rest.address, notes: rest.notes } };
          const res = await fetch(`/api/shifts/series/${editingShift.seriesId}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) });
          if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error ?? "Failed to update"); }
          const d: any = await res.json();
          toast({ title: `${d.updated} shifts updated` });
          setShowEdit(false); setEditShiftId(null); editForm.reset(); setEditScope("this");
          void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
        } catch (err: any) { toast({ title: err.message ?? "Failed to update shifts", variant: "destructive" }); }
        return;
      }
    }
    updateShift.mutate({ id: editShiftId, data: rest }, {
      onSuccess: () => { toast({ title: "Shift updated" }); setShowEdit(false); setEditShiftId(null); editForm.reset(); setEditScope("this"); queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); },
      onError: (err: any) => toast({ title: err?.response?.data?.error ?? "Failed to update shift", variant: "destructive" }),
    });
  };

  const navigate_ = (delta: number) => { const step = viewMode === "daily" ? 1 : viewMode === "fortnightly" ? 14 : 7; setPeriodStart(d => addDays(d, delta * step)); };
  const jumpToToday = () => { if (viewMode === "daily") setPeriodStart(new Date()); else setPeriodStart(startOfWeek(new Date(), { weekStartsOn: 1 })); };
  const switchViewMode = (v: ViewMode) => { setViewMode(v); if (v !== "daily") setPeriodStart(cur => startOfWeek(cur, { weekStartsOn: 1 })); };

  const days = Array.from({ length: dayCount }, (_, i) => addDays(periodStart, i));
  const colStyle = { gridTemplateColumns: `repeat(${days.length}, minmax(${viewMode === "fortnightly" ? 70 : 110}px, 1fr))` };

  const staffList = (staff as any[]).filter(s => {
    const sn = `${s.firstName} ${s.lastName}`;
    return (!searchQuery || sn.toLowerCase().includes(searchQuery.toLowerCase())) && (!filterStaffId || s.id === filterStaffId);
  });

  const filteredShifts = (shifts as any[]).filter(s => {
    if (filterParticipantId && s.participantId !== filterParticipantId) return false;
    if (filterServiceType && s.serviceType !== filterServiceType) return false;
    if (filterAssigned === "assigned" && !s.staffId) return false;
    if (filterAssigned === "unassigned" && s.staffId) return false;
    return true;
  });

  const getShiftsForStaffAndDay = (staffName: string, date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return filteredShifts.filter(s => s.staffName === staffName && s.scheduledStart.startsWith(dateStr));
  };

  const onSubmit = (data: ShiftForm) => {
    const { ndisSupportTypeId, dayRateType, ...rest } = data;
    createShift.mutate({ data: rest }, {
      onSuccess: () => { toast({ title: "Shift created" }); setShowCreate(false); form.reset(); setFormParticipantId(null); setFormStart(""); setFormEnd(""); queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); },
      onError: () => toast({ title: "Failed to create shift", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    const shift = (shifts as any[]).find(s => s.id === id) ?? selectedShiftData;
    if (shift?.seriesId) { setRecurringDeleteDialog({ shift }); return; }
    if (!confirm("Delete this shift?")) return;
    deleteShift.mutate({ id }, { onSuccess: () => { toast({ title: "Shift deleted" }); queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); setSelectedShift(null); } });
  };

  const handleSeriesDelete = async (scope: "this" | "future" | "all") => {
    const s = recurringDeleteDialog?.shift; if (!s) return;
    setRecurringDeleteDialog(null);
    if (scope === "this") { deleteShift.mutate({ id: s.id }, { onSuccess: () => { toast({ title: "Shift deleted" }); queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); setSelectedShift(null); } }); return; }
    try {
      const body: Record<string, any> = { scope };
      if (scope === "future") { body.shiftId = s.id; body.fromDate = s.scheduledStart?.slice(0, 10); }
      const res = await fetch(`/api/shifts/series/${s.seriesId}`, { method: "DELETE", headers: authHeaders(), body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error ?? "Failed to delete"); }
      const d: any = await res.json();
      toast({ title: `${d.deleted} shifts deleted` });
      void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); setSelectedShift(null);
    } catch (err: any) { toast({ title: err.message ?? "Failed to delete", variant: "destructive" }); }
  };

  const handleAddShiftForStaff = (staffId: number) => { setPreselectedStaffId(staffId); setShowCreate(true); };

  const handleDragStart = (e: React.DragEvent, shift: any) => { dragShiftRef.current = { id: shift.id, shift }; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", shift.id.toString()); (e.currentTarget as HTMLElement).style.opacity = "0.4"; };
  const handleDragEnd   = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setDragOverCell(null); };
  const handleDragOver  = (e: React.DragEvent, cellKey: string) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCell(cellKey); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCell(null); };
  const handleDrop = (e: React.DragEvent, targetStaffId: number | null, targetDay: Date) => {
    e.preventDefault(); setDragOverCell(null);
    const dragged = dragShiftRef.current; if (!dragged) return;
    const { id, shift } = dragged;
    const targetDateStr = format(targetDay, "yyyy-MM-dd");
    const newStart = rebuildDatetime(shift.scheduledStart, targetDateStr);
    const newEnd   = rebuildDatetime(shift.scheduledEnd,   targetDateStr);
    if (targetStaffId === (shift.staffId ?? null) && targetDateStr === shift.scheduledStart.slice(0, 10)) return;
    const targetStaffObj  = targetStaffId ? (staff as any[]).find(s => s.id === targetStaffId) : null;
    const targetStaffName = targetStaffObj ? `${targetStaffObj.firstName} ${targetStaffObj.lastName}` : null;
    queryClient.setQueriesData({ queryKey: getListShiftsQueryKey() }, (old: any) => Array.isArray(old) ? old.map(s => s.id === id ? { ...s, staffId: targetStaffId, staffName: targetStaffName, scheduledStart: newStart, scheduledEnd: newEnd } : s) : old);
    updateShift.mutate({ id, data: { participantId: shift.participantId as number, staffId: targetStaffId as number, scheduledStart: newStart, scheduledEnd: newEnd, serviceType: shift.serviceType ?? undefined, address: shift.address ?? undefined, notes: shift.notes ?? undefined, supportCategory: shift.supportCategory ?? undefined, ndisLineItem: shift.ndisLineItem ?? undefined, hourlyRate: shift.hourlyRate != null ? shift.hourlyRate : undefined } }, {
      onError: () => { queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); toast({ title: "Failed to move shift", variant: "destructive" }); },
    });
  };

  const handlePublish = async () => {
    const token = localStorage.getItem("pf_token");
    const authHeader: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const res = await fetch("/api/shifts/publish", { method: "POST", headers: { "Content-Type": "application/json", ...authHeader }, body: JSON.stringify({}) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error ?? `Publish failed (${res.status})`); }
      const result = await res.json();
      toast({ title: result.message ?? "Shifts published", description: "Confirmed shifts are now visible to staff." });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
    } catch (err: any) { toast({ title: `Publish failed: ${err.message}`, variant: "destructive" }); }
    setShowPublishConfirm(false);
  };

  const runOptimiser = async () => {
    setOptimiserLoading(true); setShowOptimiser(true);
    try { const data = await fetchWithAuthJson<any>("/api/ai/roster-optimise"); setOptimiserData(data); } catch {}
    setOptimiserLoading(false);
  };

  const activeFilters = [filterStaffId, filterParticipantId, filterServiceType, filterAssigned !== "all" ? filterAssigned : null].filter(Boolean).length;
  const clearFilters  = () => { setFilterStaffId(null); setFilterParticipantId(null); setFilterServiceType(null); setFilterAssigned("all"); };
  const selectedShiftData = selectedShift ? filteredShifts.find(s => s.id === selectedShift) || (shifts as any[]).find(s => s.id === selectedShift) : null;
  const today = format(new Date(), "yyyy-MM-dd");
  const periodLabel = viewMode === "daily" ? format(periodStart, "EEEE, d MMMM yyyy") : `${format(periodStart, "d MMM")} – ${format(periodEnd, "d MMM yyyy")}`;
  const todayShiftCount = (shifts as any[]).filter(s => { try { return format(parseISO(s.scheduledStart), "yyyy-MM-dd") === today; } catch { return false; } }).length;
  const unfilledCount   = (shifts as any[]).filter(s => !s.staffId).length;
  const onLeaveCount    = (staff as any[]).filter(s => s.status === "on_leave").length;
  const vacantShifts    = filteredShifts.filter(s => !s.staffId);
  const jobBoardShifts  = filteredShifts.filter(s => !s.staffId);

  const fmtTime = (iso: string) => { const d = new Date(iso); const h = d.getHours(); const m = d.getMinutes().toString().padStart(2, "0"); return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`; };

  return (
    <AppLayout>
      <div className="flex flex-col overflow-hidden" style={{ height: "100%", background: "#F8FAFC" }}>

        {/* ══ STATS STRIP ══ */}
        <div className="bg-white border-b shrink-0 overflow-x-auto scrollbar-hide" style={{ borderColor: "#E5EAF2", boxShadow: "0 1px 0 #E5EAF2" }}>
          <div className="flex items-center gap-3 px-5" style={{ minHeight: 92, minWidth: 900 }}>
            {[
              { icon: <CalendarDays className="w-5 h-5" />, iconBg: "#EAF3FF", iconColor: "#2563EB", label: "Today's Overview", value: todayShiftCount, sub: "Total shifts" },
              { icon: <Users className="w-5 h-5" />,        iconBg: "#FFF7ED", iconColor: "#EA580C", label: "Unfilled Shifts",   value: unfilledCount,   sub: "Needs staff" },
              { icon: <Calendar className="w-5 h-5" />,     iconBg: "#EAF3FF", iconColor: "#2563EB", label: "On Leave",          value: onLeaveCount,    sub: "Staff on leave" },
              { icon: <Users className="w-5 h-5" />,        iconBg: "#F5F3FF", iconColor: "#7C3AED", label: "Total Participants", value: (participants as any[]).filter((p: any) => p.status === "active").length, sub: "Active participants" },
              { icon: <UserCheck className="w-5 h-5" />,    iconBg: "#EAF3FF", iconColor: "#2563EB", label: "Total Staff",       value: (staff as any[]).length, sub: "Active staff" },
              { icon: <Shield className="w-5 h-5" />,       iconBg: "#ECFDF5", iconColor: "#059669", label: "Compliance",        value: "98%",           sub: "This week" },
            ].map((kpi, i) => (
              <div key={i} className="flex items-center gap-3 flex-1" style={{ borderRight: i < 5 ? "1px solid #EDF2F7" : "none", paddingRight: i < 5 ? 16 : 0, paddingLeft: i > 0 ? 16 : 0 }}>
                <div className="flex items-center justify-center shrink-0 rounded-xl" style={{ width: 38, height: 38, background: kpi.iconBg, color: kpi.iconColor }}>{kpi.icon}</div>
                <div className="min-w-0">
                  <p className="leading-tight" style={{ fontSize: 11.5, fontWeight: 500, color: "#334155" }}>{kpi.label}</p>
                  <p className="font-bold leading-tight" style={{ fontSize: 26, color: "#0B1F3A" }}>{kpi.value}</p>
                  <p className="leading-tight" style={{ fontSize: 11.5, color: "#64748B" }}>{kpi.sub}</p>
                </div>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={runOptimiser} disabled={optimiserLoading} className="shrink-0 gap-2 font-bold">
              {optimiserLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {optimiserLoading ? "Optimising…" : "Optimise Roster"}
            </Button>

            <div className="shrink-0 ml-2">
              <DropdownMenu>
                <div className="flex rounded-xl overflow-hidden" style={{ boxShadow: "0 10px 24px rgba(11,47,107,0.25)" }}>
                  <button onClick={() => { setPreselectedStaffId(null); setShowCreate(true); }} className="flex items-center gap-2 text-white font-bold text-sm transition-all" style={{ background: "#0B2F6B", paddingLeft: 22, paddingRight: 16, height: 48 }} onMouseEnter={e => (e.currentTarget.style.background = "#08285C")} onMouseLeave={e => (e.currentTarget.style.background = "#0B2F6B")}>
                    <Plus className="w-4 h-4" />Add Shift
                  </button>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center justify-center text-white transition-all" style={{ background: "#0B2F6B", borderLeft: "1px solid rgba(255,255,255,0.18)", paddingLeft: 10, paddingRight: 10, height: 48 }} onMouseEnter={e => (e.currentTarget.style.background = "#08285C")} onMouseLeave={e => (e.currentTarget.style.background = "#0B2F6B")}>
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                </div>
                <DropdownMenuContent align="end" className="text-sm min-w-[200px]">
                  <DropdownMenuItem onClick={() => { setPreselectedStaffId(null); setShowCreate(true); }}><Plus className="w-3.5 h-3.5 mr-2" />Add Single Shift</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRecurring(true)}><Repeat className="w-3.5 h-3.5 mr-2" />Recurring Shift</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBulk(true)}><LayoutList className="w-3.5 h-3.5 mr-2" />Bulk Create Shifts</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCopyWeek(true)}><Copy className="w-3.5 h-3.5 mr-2" />Copy Week</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/staff")}>Add Staff Member</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/participants")}>Add Client</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* ══ OPTIMISER PANEL ══ */}
        {showOptimiser && (
          <div className="shrink-0 bg-gradient-to-r from-[#0B1F3A] to-[#1E3A5F] text-white px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", position: "relative" }}>
            <button onClick={() => setShowOptimiser(false)} className="absolute top-3 right-4 flex items-center justify-center rounded-lg" style={{ width: 28, height: 28, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", color: "#fff" }}>
              <X className="w-3.5 h-3.5" />
            </button>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center rounded-lg shrink-0" style={{ width: 30, height: 30, background: "rgba(255,255,255,0.12)" }}><Zap className="w-4 h-4 text-yellow-300" /></div>
              <div>
                <p className="text-xs font-bold tracking-widest uppercase" style={{ color: "#93C5FD" }}>AI Roster Optimiser</p>
                {!optimiserLoading && optimiserData && <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>{optimiserData.summary ?? "Analysis complete"}</p>}
                {optimiserLoading && <p className="text-xs" style={{ color: "rgba(255,255,255,0.55)" }}>Analysing shifts, availability and constraints…</p>}
              </div>
            </div>
            {optimiserLoading && <div className="flex items-center gap-2" style={{ color: "rgba(255,255,255,0.5)" }}><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">Running optimisation…</span></div>}
            {!optimiserLoading && optimiserData && (
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                {(optimiserData.recommendations ?? []).slice(0, 6).map((rec: any, i: number) => {
                  const sev = rec.severity ?? rec.type ?? "info";
                  const isCrit = sev === "critical" || sev === "error";
                  const isWarn = sev === "warning" || sev === "medium";
                  const bg = isCrit ? "#FEF2F2" : isWarn ? "#FFF7ED" : "#EFF6FF";
                  const border = isCrit ? "#FECACA" : isWarn ? "#FED7AA" : "#BFDBFE";
                  const text = isCrit ? "#991B1B" : isWarn ? "#92400E" : "#1E3A5F";
                  const IcComp = isCrit ? AlertTriangle : isWarn ? AlertTriangle : CheckCircle2;
                  return (
                    <div key={i} className="rounded-xl p-3.5" style={{ background: bg, border: `1px solid ${border}` }}>
                      <div className="flex items-start gap-2 mb-1.5"><IcComp className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: isCrit ? "#DC2626" : isWarn ? "#EA580C" : "#2563EB" }} /><span className="text-xs font-bold" style={{ color: text }}>{rec.title ?? rec.issue}</span></div>
                      <p className="text-xs leading-relaxed" style={{ color: text, opacity: 0.85 }}>{rec.description ?? rec.suggestion}</p>
                      {rec.action && <p className="text-xs mt-1.5 font-semibold italic" style={{ color: isCrit ? "#DC2626" : isWarn ? "#EA580C" : "#2563EB" }}>→ {rec.action}</p>}
                    </div>
                  );
                })}
                {(!optimiserData.recommendations || optimiserData.recommendations.length === 0) && (
                  <div className="flex items-center gap-2 text-sm" style={{ color: "rgba(255,255,255,0.7)" }}><CheckCircle2 className="w-4 h-4 text-green-400" />Roster looks well-optimised — no issues detected.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ TOOLBAR ══ */}
        <div className="bg-white border-b shrink-0 overflow-x-auto scrollbar-hide" style={{ borderColor: "#E5EAF2", boxShadow: "0 1px 0 #E5EAF2" }}>
          <div className="px-4 flex items-center gap-2" style={{ height: 52, minWidth: 700 }}>
            <div className="flex items-center rounded-[10px] overflow-hidden shrink-0" style={{ border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              {([
                { id: "staff" as const, label: "Staff", Icon: UserCheck },
                { id: "client" as const, label: "Client", Icon: Users },
                { id: "facilities" as const, label: "Facilities", Icon: Building2 },
              ]).map(({ id, label, Icon }) => (
                <button key={id} onClick={() => setRosterView(id)} className="flex items-center gap-1.5 border-r last:border-r-0 select-none transition-colors duration-150"
                  style={{ ...(rosterView === id ? { background: "#0B2F6B", color: "#FFFFFF", borderColor: "#0B2F6B", boxShadow: "0 6px 16px rgba(11,47,107,0.18)" } : { background: "#FFFFFF", color: "#334155", borderColor: "#E2E8F0" }), height: 38, paddingLeft: 12, paddingRight: 12, fontSize: 13, fontWeight: 500 }}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              ))}
            </div>

            <button onClick={() => setShowFilter(f => !f)} className="relative flex items-center justify-center rounded-[10px] transition-colors"
              style={{ width: 38, height: 38, ...(showFilter || activeFilters > 0 ? { background: "#0B2F6B", color: "#FFFFFF", border: "1px solid #0B2F6B", boxShadow: "0 6px 16px rgba(11,47,107,0.18)" } : { background: "#FFFFFF", color: "#64748B", border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }) }}>
              <Filter className="w-3.5 h-3.5" />
              {activeFilters > 0 && <span className="absolute -top-1 -right-1 rounded-full flex items-center justify-center text-white" style={{ width: 14, height: 14, fontSize: 9, fontWeight: 700, background: "#EF4444" }}>{activeFilters}</span>}
            </button>

            <div style={{ width: 1, height: 20, background: "#E5EAF2", margin: "0 2px" }} />

            <div className="flex items-center rounded-[10px] overflow-hidden shrink-0" style={{ border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <button onClick={jumpToToday} className="border-r transition-colors hover:bg-[#F8FAFC]" style={{ height: 38, paddingLeft: 14, paddingRight: 14, fontSize: 13, fontWeight: 500, color: "#334155", borderColor: "#E2E8F0" }}>Today</button>
              <button onClick={() => navigate_(-1)} className="border-r flex items-center justify-center transition-colors hover:bg-[#F8FAFC]" style={{ width: 36, height: 38, borderColor: "#E2E8F0", color: "#64748B" }}><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => navigate_(1)} className="flex items-center justify-center transition-colors hover:bg-[#F8FAFC]" style={{ width: 36, height: 38, color: "#64748B" }}><ChevronRight className="w-4 h-4" /></button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{periodLabel}</span>
              <CalendarDays className="w-3.5 h-3.5" style={{ color: "#94A3B8" }} />
            </div>

            <button onClick={() => setShowPublishConfirm(true)} className="flex items-center gap-1.5 rounded-[10px] transition-colors hover:bg-[#F8FAFC] shrink-0"
              style={{ height: 38, paddingLeft: 14, paddingRight: 14, fontSize: 13, fontWeight: 500, color: "#334155", border: "1px solid #E2E8F0", background: "#FFFFFF", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              <Megaphone className="w-3.5 h-3.5" />Publish shifts
            </button>

            <div className="flex-1" />

            <div className="flex items-center rounded-[10px] overflow-hidden shrink-0" style={{ border: "1px solid #E2E8F0", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
              {(["daily", "weekly", "fortnightly"] as ViewMode[]).map(v => (
                <button key={v} onClick={() => switchViewMode(v)} className="border-r last:border-r-0 capitalize transition-all select-none"
                  style={{ height: 38, paddingLeft: 14, paddingRight: 14, fontSize: 13, fontWeight: 500, borderColor: "#E2E8F0", ...(viewMode === v ? { background: "#0B2F6B", color: "#FFFFFF", boxShadow: "0 6px 16px rgba(11,47,107,0.18)" } : { background: "#FFFFFF", color: "#334155" }) }}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center rounded-[10px] transition-colors hover:bg-[#F8FAFC]" style={{ width: 38, height: 38, color: "#64748B", border: "1px solid #E2E8F0", background: "#FFFFFF", boxShadow: "0 2px 8px rgba(15,23,42,0.03)" }}>
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-sm">
                <DropdownMenuItem onClick={() => navigate("/staff")}>View All Staff</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/participants")}>View All Clients</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/timesheet")}>Timesheets</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/reports")}>Reports</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Filter panel */}
        {showFilter && (
          <div className="border-b bg-white px-5 py-3 flex flex-wrap items-end gap-4 shrink-0" style={{ borderColor: "#E5EAF2" }}>
            <div className="flex-1 min-w-36">
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#94A3B8" }}>Staff</label>
              <Select value={filterStaffId?.toString() ?? "all"} onValueChange={v => setFilterStaffId(v === "all" ? null : parseInt(v, 10))}>
                <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue placeholder="All staff" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All staff</SelectItem>{(staff as any[]).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#94A3B8" }}>Client</label>
              <Select value={filterParticipantId?.toString() ?? "all"} onValueChange={v => setFilterParticipantId(v === "all" ? null : parseInt(v, 10))}>
                <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue placeholder="All clients" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All clients</SelectItem>{(participants as any[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#94A3B8" }}>Service Type</label>
              <Select value={filterServiceType ?? "all"} onValueChange={v => setFilterServiceType(v === "all" ? null : v)}>
                <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue placeholder="All types" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All service types</SelectItem>{ALL_SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-36">
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: "#94A3B8" }}>Assignment</label>
              <Select value={filterAssigned} onValueChange={v => setFilterAssigned(v as any)}>
                <SelectTrigger className="h-9 text-sm rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All shifts</SelectItem><SelectItem value="assigned">Assigned only</SelectItem><SelectItem value="unassigned">Unassigned only</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              {activeFilters > 0 && <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm border hover:bg-[#F8FAFC]" style={{ color: "#64748B", borderColor: "#E2E8F0" }}><X className="w-3.5 h-3.5" /> Clear</button>}
              <button onClick={() => setShowFilter(false)} className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-sm border hover:bg-[#F8FAFC]" style={{ color: "#64748B", borderColor: "#E2E8F0" }}>Done</button>
            </div>
          </div>
        )}

        {/* ══ MAIN CONTENT ══ */}
        <div className="flex-1 min-h-0 flex overflow-hidden p-4 gap-3">

          {/* Grid */}
          <div className="flex-1 min-w-0 flex flex-col rounded-2xl overflow-hidden" style={{ border: "1px solid #E5EAF2", boxShadow: "0 8px 24px rgba(15,23,42,0.04)", background: "#FFFFFF" }}>
            <div className="flex-1 overflow-auto scrollbar-hide">

              {/* Sticky header */}
              <div className="flex sticky top-0 z-20 bg-white border-b min-w-[1100px]" style={{ borderColor: "#E9EEF5" }}>
                <div className="shrink-0 sticky left-0 z-30 bg-white border-r px-4 flex items-center justify-between" style={{ width: 220, height: 56, borderColor: "#E9EEF5" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1F3A" }}>Support Workers</span>
                  <button onClick={() => navigate("/staff")} style={{ fontSize: 11, fontWeight: 600, color: "#2563EB" }} className="hover:opacity-80 transition-opacity">View all staff</button>
                </div>
                <div className="grid flex-1" style={colStyle}>
                  {days.map(day => {
                    const dayStr = format(day, "yyyy-MM-dd");
                    const isToday = dayStr === today;
                    return (
                      <div key={dayStr} className={cn("border-r last:border-r-0 flex flex-col items-center justify-center gap-0.5", isToday && "bg-[#F9FBFF]")} style={{ height: 56, borderColor: "#E9EEF5" }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.06em" }}>{format(day, "EEE")}</p>
                        <div className="flex items-center justify-center rounded-full" style={isToday ? { width: 32, height: 32, background: "#0B2F6B", boxShadow: "0 6px 14px rgba(11,47,107,0.20)" } : { width: 32, height: 32 }}>
                          <p style={{ fontSize: isToday ? 16 : 18, fontWeight: 700, color: isToday ? "#FFFFFF" : "#0B1F3A", lineHeight: 1 }}>{format(day, "d")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Staff rows */}
              {isLoading ? (
                <div className="p-4 space-y-2">{[1, 2, 3, 4].map(i => <div key={i} className="h-[108px] rounded-xl bg-[#F8FAFC] animate-pulse" />)}</div>
              ) : staffList.length === 0 ? (
                <div className="p-10 text-center text-sm" style={{ color: "#94A3B8" }}>No staff match your search</div>
              ) : staffList.map((s, si) => {
                const staffName = `${s.firstName} ${s.lastName}`;
                const shortName = `${s.firstName} ${s.lastName.charAt(0)}.`;
                const isOnLeave = s.status === "on_leave";
                return (
                  <div key={s.id} className="flex border-b group/row min-w-[1100px]" style={{ borderColor: "#EEF2F7" }}>
                    <div className="shrink-0 sticky left-0 z-10 bg-white border-r flex gap-3 cursor-pointer transition-colors hover:bg-[#F9FBFF]" style={{ width: 220, minHeight: 108, padding: "14px 16px", borderColor: "#EEF2F7" }} onClick={() => navigate(`/staff/${s.id}`)}>
                      <StaffAvatar name={staffName} photoUrl={s.photoUrl} size={42} />
                      <div className="flex-1 min-w-0 pt-0.5">
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#0B1F3A", lineHeight: 1.2 }} className="truncate">{shortName}</p>
                        <p style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Support Worker</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: isOnLeave ? "#EF4444" : "#10B981" }} />
                          <span style={{ fontSize: 11, color: isOnLeave ? "#EF4444" : "#64748B", fontWeight: 500 }}>{isOnLeave ? "On leave" : "Available"}</span>
                        </div>
                        <div className="flex items-center gap-1 mt-1.5">
                          <Clock className="w-3 h-3 shrink-0" style={{ color: "#94A3B8" }} />
                          <span style={{ fontSize: 11, color: "#64748B" }}>{formatHours(shifts as any[], staffName)}</span>
                        </div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); handleAddShiftForStaff(s.id); }} className="self-start mt-1 p-1 rounded-md opacity-0 group-hover/row:opacity-100 transition-all hover:bg-[#EDF2F7]" title="Add shift">
                        <Plus className="w-3 h-3" style={{ color: "#64748B" }} />
                      </button>
                    </div>

                    <div className="grid flex-1" style={{ ...colStyle, minHeight: 108 }}>
                      {days.map(day => {
                        const dayStr = format(day, "yyyy-MM-dd");
                        const isToday = dayStr === today;
                        const dayShifts = getShiftsForStaffAndDay(staffName, day);
                        const cellKey = `${s.id}-${dayStr}`;
                        const isOver = dragOverCell === cellKey;
                        return (
                          <div key={dayStr} className={cn("border-r last:border-r-0 p-1.5 flex flex-col gap-1 transition-colors duration-150", isToday && "bg-[#FAFBFF]", isOver && "bg-[#EFF6FF] ring-2 ring-inset ring-blue-300")}
                            style={{ borderColor: "#E9EEF5", minHeight: 108 }}
                            onDragOver={e => handleDragOver(e, cellKey)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, s.id, day)}>
                            {dayShifts.length > 1 ? (
                              <button className="flex-1 flex gap-0.5 overflow-hidden cursor-pointer rounded-xl" onClick={() => setMultiShiftModal({ shifts: dayShifts, color: STAFF_COLORS[si % STAFF_COLORS.length], staffName })}>
                                {dayShifts.map(shift => {
                                  const sc = getSvcColor(shift.serviceType);
                                  return (
                                    <div key={shift.id} className="flex-1 flex flex-col px-1.5 py-1.5 overflow-hidden rounded-lg" style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
                                      <p style={{ fontSize: 10, fontWeight: 700, color: sc.timeColor, lineHeight: 1.2 }}>{fmtTime(shift.scheduledStart)}</p>
                                      <p style={{ fontSize: 9, color: sc.titleColor, lineHeight: 1.2 }} className="truncate mt-0.5">{shift.serviceType}</p>
                                    </div>
                                  );
                                })}
                              </button>
                            ) : dayShifts.map(shift => {
                              const sc = shift.invoiceLocked
                                ? { bg: "linear-gradient(180deg,rgba(100,116,139,0.07) 0%,rgba(100,116,139,0.035) 100%)", border: "rgba(100,116,139,0.2)", timeColor: "#64748B", titleColor: "#475569" }
                                : getSvcColor(shift.serviceType);
                              return (
                                <button key={shift.id}
                                  draggable={!shift.invoiceLocked}
                                  onDragStart={e => !shift.invoiceLocked && handleDragStart(e, shift)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => setSelectedShift(shift.id)}
                                  className="w-full text-left flex flex-col transition-all duration-150 hover:-translate-y-px select-none cursor-pointer"
                                  style={{ background: sc.bg, border: `1px solid ${sc.border}`, borderRadius: 10, padding: "10px 11px", minHeight: 74, boxShadow: "0 4px 12px rgba(15,23,42,0.035)" }}>
                                  <p style={{ fontSize: 12, fontWeight: 700, color: sc.timeColor, lineHeight: 1.3 }}>{fmtTime(shift.scheduledStart)} &ndash; {fmtTime(shift.scheduledEnd)}</p>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: sc.titleColor, lineHeight: 1.3, marginTop: 2 }} className="truncate">{shift.serviceType || "Shift"}</p>
                                  <p style={{ fontSize: 11, color: "#475569", lineHeight: 1.3, marginTop: 1 }}>Standard</p>
                                  <p style={{ fontSize: 11, color: "#64748B", lineHeight: 1.3 }} className="truncate">{getCity(shift.address)}</p>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══ RIGHT PANEL ══ */}
          <div className="shrink-0 flex flex-col gap-3 overflow-y-auto" style={{ width: 200 }}>
            {/* Vacant Shifts */}
            <div className="rounded-2xl p-[18px] flex flex-col" style={{ background: "linear-gradient(180deg,#FFF9ED 0%,#FFFDF7 100%)", border: "1px solid #FDE7B2", boxShadow: "0 8px 22px rgba(245,158,11,0.08)" }}>
              <div className="flex items-start gap-2.5 mb-3">
                <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 42, height: 42, background: "#FFE8AE", fontSize: 12, fontWeight: 800, color: "#B45309" }}>VS</div>
                <div className="min-w-0 pt-0.5">
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#92400E", lineHeight: 1.2 }}>Vacant Shifts</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#DC2626", lineHeight: 1.3, marginTop: 2 }}>{vacantShifts.length} unfilled shifts</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {vacantShifts.slice(0, 3).map(s => (
                  <button key={s.id} onClick={() => setSelectedShift(s.id)} className="flex flex-col text-left rounded-xl p-3 w-full transition-all hover:scale-[1.01]" style={{ background: "rgba(255,255,255,0.72)", border: "1px solid rgba(253,230,138,0.55)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
                    <div className="flex items-start gap-1.5">
                      <span className="rounded-full mt-1 shrink-0" style={{ width: 6, height: 6, background: "#F59E0B" }} />
                      <div className="min-w-0">
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#0B1F3A", lineHeight: 1.3 }}>{formatRelativeDate(s.scheduledStart)} &ndash; {fmtTime(s.scheduledEnd)}</p>
                        <p style={{ fontSize: 10, color: "#64748B", lineHeight: 1.3 }} className="truncate">{s.serviceType || "Shift"} &ndash; {getCity(s.address)}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {vacantShifts.length === 0 && <p style={{ fontSize: 11, color: "#92400E", fontStyle: "italic" }}>No vacant shifts this week</p>}
              </div>
              <button onClick={() => setFilterAssigned("unassigned")} className="mt-3 flex items-center justify-center rounded-[10px] transition-all hover:bg-amber-50 font-bold text-sm" style={{ height: 36, border: "1px solid #F3DFA5", background: "#FFFFFF", color: "#0B1F3A", boxShadow: "0 2px 8px rgba(15,23,42,0.03)", fontSize: 12 }}>View all vacant shifts</button>
            </div>

            {/* Job Board */}
            <div className="rounded-2xl p-[18px] flex flex-col" style={{ background: "linear-gradient(180deg,#EFF6FF 0%,#F8FBFF 100%)", border: "1px solid #D7E8FF", boxShadow: "0 8px 22px rgba(37,99,235,0.07)" }}>
              <div className="flex items-start gap-2.5 mb-3">
                <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 42, height: 42, background: "#DBEAFE", fontSize: 12, fontWeight: 800, color: "#1D4ED8" }}>JB</div>
                <div className="min-w-0 pt-0.5">
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#1D4ED8", lineHeight: 1.2 }}>Job Board</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#2563EB", lineHeight: 1.3, marginTop: 2 }}>{Math.max(jobBoardShifts.length, 8)} open shifts</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {jobBoardShifts.slice(0, 2).map(s => (
                  <button key={s.id} onClick={() => setSelectedShift(s.id)} className="flex flex-col text-left rounded-xl p-3 w-full transition-all hover:scale-[1.01]" style={{ background: "rgba(255,255,255,0.76)", border: "1px solid rgba(191,219,254,0.7)", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
                    <div className="flex items-start gap-1.5">
                      <span className="rounded-full mt-1 shrink-0" style={{ width: 6, height: 6, background: "#2563EB" }} />
                      <div className="min-w-0">
                        <p style={{ fontSize: 11, fontWeight: 700, color: "#0B1F3A", lineHeight: 1.3 }}>{formatRelativeDate(s.scheduledStart)}, {fmtTime(s.scheduledStart)} &ndash; {fmtTime(s.scheduledEnd)}</p>
                        <p style={{ fontSize: 10, color: "#64748B", lineHeight: 1.3 }} className="truncate">{s.serviceType || "Shift"} &ndash; {getCity(s.address)}</p>
                      </div>
                    </div>
                  </button>
                ))}
                {jobBoardShifts.length === 0 && <p style={{ fontSize: 11, color: "#1D4ED8", fontStyle: "italic" }}>No open shifts</p>}
              </div>
              <button className="mt-3 flex items-center justify-center rounded-[10px] transition-all hover:bg-blue-50 font-bold text-sm" style={{ height: 36, border: "1px solid #BFDBFE", background: "#FFFFFF", color: "#0B1F3A", boxShadow: "0 2px 8px rgba(15,23,42,0.03)", fontSize: 12 }}>View all open shifts</button>
            </div>

            {/* Quick Actions */}
            <div className="rounded-2xl p-[18px]" style={{ background: "#FFFFFF", border: "1px solid #E5EAF2", boxShadow: "0 8px 24px rgba(15,23,42,0.04)" }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#0B1F3A", marginBottom: 12 }}>Quick Actions</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Add Shift",       sub: "Create a single shift",      iconBg: "#EAF3FF", Icon: <Plus className="w-4 h-4" style={{ color: "#2563EB" }} />,        onClick: () => { setPreselectedStaffId(null); setShowCreate(true); } },
                  { label: "Recurring Shift", sub: "Set a repeating pattern",    iconBg: "#F5F3FF", Icon: <Repeat className="w-4 h-4" style={{ color: "#7C3AED" }} />,      onClick: () => setShowRecurring(true) },
                  { label: "Bulk Create",     sub: "Create shifts over a range", iconBg: "#ECFDF5", Icon: <LayoutList className="w-4 h-4" style={{ color: "#059669" }} />,  onClick: () => setShowBulk(true) },
                  { label: "Copy Week",       sub: "Duplicate another week",     iconBg: "#FFF7ED", Icon: <Copy className="w-4 h-4" style={{ color: "#EA580C" }} />,        onClick: () => setShowCopyWeek(true) },
                  { label: "Add Staff",       sub: "Invite or add new staff",    iconBg: "#F0FDF4", Icon: <UserCheck className="w-4 h-4" style={{ color: "#16A34A" }} />,   onClick: () => navigate("/staff") },
                  { label: "Add Client",      sub: "Register a new participant", iconBg: "#EFF6FF", Icon: <Users className="w-4 h-4" style={{ color: "#2563EB" }} />,        onClick: () => navigate("/participants") },
                ].map(({ label, sub, iconBg, Icon, onClick }) => (
                  <button key={label} onClick={onClick} className="flex items-center gap-2.5 w-full text-left rounded-xl p-2 transition-colors hover:bg-[#F8FAFC]">
                    <div className="rounded-xl flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: iconBg }}>{Icon}</div>
                    <div className="min-w-0">
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0B1F3A", lineHeight: 1.2 }}>{label}</p>
                      <p style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.3 }}>{sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div className="border-t bg-white shrink-0 px-5 flex items-center gap-5" style={{ height: 36, borderColor: "#E5EAF2" }}>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2L14.9 14H1.1L8 2Z" fill="#FCD34D" /><path d="M8 6.5V9.5" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="11.5" r="0.75" fill="#78350F" /></svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#92400E" }}>1 compliance issue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" fill="#BFDBFE" stroke="#3B82F6" strokeWidth="1" /><path d="M8 7V11" stroke="#1D4ED8" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="5.5" r="0.75" fill="#1D4ED8" /></svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#1E40AF" }}>2 shifts exceed funded hours</span>
          </div>
          <span className="ml-auto" style={{ fontSize: 11, color: "#94A3B8" }}>All times shown in AEST</span>
        </div>

      </div>

      {/* ══ MULTI-SHIFT POPUP ══ */}
      {multiShiftModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMultiShiftModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-5 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{multiShiftModal.shifts.length} shifts</p>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0B1F3A" }}>{multiShiftModal.staffName}</h3>
              </div>
              <button onClick={() => setMultiShiftModal(null)} className="p-1.5 rounded-lg hover:bg-[#F8FAFC] transition-colors"><X className="w-4 h-4" style={{ color: "#94A3B8" }} /></button>
            </div>
            <div className="space-y-2">
              {multiShiftModal.shifts.map(shift => {
                const sc = getSvcColor(shift.serviceType);
                return (
                  <button key={shift.id} onClick={() => { setMultiShiftModal(null); setSelectedShift(shift.id); }} className="w-full text-left rounded-xl flex flex-col gap-0.5 transition-all hover:-translate-y-px hover:shadow-md" style={{ background: sc.bg, border: `1px solid ${sc.border}`, padding: "12px 14px" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: sc.timeColor }}>{fmtTime(shift.scheduledStart)} &ndash; {fmtTime(shift.scheduledEnd)}</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: sc.titleColor }} className="truncate">{shift.serviceType || "Shift"}</p>
                    <p style={{ fontSize: 11, color: "#64748B" }}>Standard &middot; {getCity(shift.address)}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ SHIFT DETAIL MODAL ══ */}
      {selectedShiftData && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedShift(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" style={{ border: "1px solid #E5EAF2" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0B1F3A" }}>Shift Details</h3>
                  {selectedShiftData.seriesId && <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#F5F3FF", color: "#7C3AED", border: "1px solid #DDD6FE" }}><Repeat className="w-3 h-3" />Recurring</span>}
                </div>
                <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>{format(parseISO(selectedShiftData.scheduledStart), "EEEE, d MMMM yyyy")}</p>
              </div>
              <button onClick={() => setSelectedShift(null)} className="p-1.5 hover:bg-[#F8FAFC] rounded-lg transition-colors"><X className="w-4 h-4" style={{ color: "#94A3B8" }} /></button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-4">
                <div className="flex-1"><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Participant</dt><dd className="font-semibold" style={{ color: "#0B1F3A" }}>{selectedShiftData.participantName}</dd></div>
                <div className="flex-1"><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Staff</dt><dd className="font-semibold" style={{ color: "#0B1F3A" }}>{selectedShiftData.staffName ?? "Unassigned"}</dd></div>
              </div>
              <div><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Schedule</dt><dd className="font-medium">{format(parseISO(selectedShiftData.scheduledStart), "h:mm a")} &mdash; {format(parseISO(selectedShiftData.scheduledEnd), "h:mm a")}</dd></div>
              {selectedShiftData.serviceType && <div><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Service Type</dt><dd>{selectedShiftData.serviceType}</dd></div>}
              {selectedShiftData.ndisLineItem && <div><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>NDIS Line Item</dt><dd><Badge variant="outline" className="font-mono text-xs">{selectedShiftData.ndisLineItem}</Badge></dd></div>}
              {selectedShiftData.hourlyRate && <div><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Rate (2025&ndash;26)</dt><dd className="font-bold text-primary text-base">${Number(selectedShiftData.hourlyRate).toFixed(2)}/hr</dd></div>}
              {selectedShiftData.address && <div><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Address</dt><dd>{selectedShiftData.address}</dd></div>}
              {selectedShiftData.notes && <div><dt style={{ fontSize: 11, fontWeight: 500, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Notes</dt><dd style={{ color: "#64748B" }}>{selectedShiftData.notes}</dd></div>}
            </dl>
            <div className="mt-5 pt-4 border-t" style={{ borderColor: "#EDF2F7" }}>
              {selectedShiftData.invoiceLocked && (
                <div className="flex items-center gap-2 mb-4 rounded-xl px-3 py-2.5" style={{ background: "#FFF7ED", border: "1px solid #FDE7B2" }}>
                  <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: "#EA580C" }} />
                  <p style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>This shift is locked &mdash; included in an invoice. Void the invoice to edit.</p>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <Button variant="destructive" size="sm" className="rounded-xl" disabled={!!selectedShiftData.invoiceLocked} onClick={() => handleDelete(selectedShiftData.id)}>Delete</Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setSelectedShift(null)}>Close</Button>
                  {!selectedShiftData.invoiceLocked && <Button size="sm" className="rounded-xl gap-1.5" onClick={() => handleEditOpen(selectedShiftData)}><Pencil className="w-3.5 h-3.5" /> Edit Shift</Button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PUBLISH CONFIRM ══ */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Publish Shifts</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: "#64748B" }}>This will notify all assigned staff of their upcoming shifts for <strong>{periodLabel}</strong>. Staff will receive an email and app notification.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={handlePublish}>Publish Shifts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ CREATE SHIFT — PREMIUM MODAL ══ */}
      <PremiumAddShiftModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); }}
        participants={participants as any[]}
        staff={staff as any[]}
        preselectedStaffId={preselectedStaffId}
        preselectedDate={format(periodStart, "yyyy-MM-dd")}
      />

      {/* ══ EDIT SHIFT DIALOG ══ */}
      <Dialog open={showEdit} onOpenChange={open => { setShowEdit(open); if (!open) setEditShiftId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Edit Shift</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="participantId" render={({ field }) => (
                <FormItem><FormLabel>Client</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v, 10))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                    <SelectContent>{(participants as any[]).map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="staffId" render={({ field }) => (
                <FormItem><FormLabel>Staff Member</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v, 10))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl>
                    <SelectContent>{(staff as any[]).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="scheduledStart" render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><FormControl><Input type="datetime-local" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="scheduledEnd"   render={({ field }) => (<FormItem><FormLabel>End</FormLabel><FormControl><Input type="datetime-local" className="rounded-xl" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="ndisSupportTypeId" render={({ field }) => (
                  <FormItem><FormLabel>NDIS Support Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map(cat => <SelectGroup key={cat}><SelectLabel className="text-xs uppercase text-muted-foreground font-semibold py-1.5">{cat}</SelectLabel>{getSupportTypesByCategory(cat).map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}</SelectGroup>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="dayRateType" render={({ field }) => (
                  <FormItem><FormLabel>Day Rate Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-xl"><SelectValue placeholder="Auto-detected" /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(DAY_RATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><AddressAutocomplete value={field.value ?? ""} onChange={field.onChange} placeholder="Search for a shift location…" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Any special instructions or notes…" className="rounded-xl" {...field} rows={2} /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => { setShowEdit(false); setEditShiftId(null); }}>Cancel</Button>
                <Button type="submit" className="rounded-xl" disabled={updateShift.isPending}>{updateShift.isPending ? "Saving…" : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ RECURRING / BULK MODAL ══ */}
      {(showRecurring || showBulk) && (
        <RecurringShiftModal
          open={showRecurring || showBulk}
          mode={showRecurring ? "recurring" : "bulk"}
          onClose={() => { setShowRecurring(false); setShowBulk(false); }}
          onSuccess={() => { void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); }}
          participants={participants as any[]}
          staff={staff as any[]}
          preselectedStaffId={preselectedStaffId}
          preselectedDate={format(periodStart, "yyyy-MM-dd")}
        />
      )}

      {/* ══ COPY WEEK MODAL ══ */}
      <CopyWeekModal
        open={showCopyWeek}
        onClose={() => setShowCopyWeek(false)}
        onSuccess={() => { void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); }}
        participants={participants as any[]}
        staff={staff as any[]}
      />

      {/* ══ RECURRING DELETE SCOPE ══ */}
      {recurringDeleteDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" style={{ border: "1px solid #E5EAF2" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#FEF2F2" }}><Repeat className="w-5 h-5" style={{ color: "#DC2626" }} /></div>
              <div><h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B1F3A" }}>Delete Recurring Shift</h3><p style={{ fontSize: 12, color: "#94A3B8" }}>This shift is part of a recurring series</p></div>
            </div>
            <div className="space-y-2 mb-5">
              {([
                { scope: "this" as const, label: "This shift only",          sub: "Remove just this occurrence" },
                { scope: "future" as const, label: "This and future shifts", sub: "Remove from this date forward" },
                { scope: "all" as const, label: "All shifts in this series", sub: "Remove the entire series" },
              ] as const).map(({ scope, label, sub }) => (
                <button key={scope} onClick={() => handleSeriesDelete(scope)} className="w-full text-left rounded-xl px-4 py-3 transition-colors hover:bg-[#FEF2F2] flex justify-between items-center" style={{ border: "1px solid #E5EAF2" }}>
                  <div><p style={{ fontSize: 13, fontWeight: 600, color: "#0B1F3A" }}>{label}</p><p style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</p></div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#DC2626" }} />
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setRecurringDeleteDialog(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ══ RECURRING EDIT SCOPE ══ */}
      {recurringEditDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm" style={{ border: "1px solid #E5EAF2" }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#EFF6FF" }}><Repeat className="w-5 h-5" style={{ color: "#0B2F6B" }} /></div>
              <div><h3 style={{ fontSize: 16, fontWeight: 700, color: "#0B1F3A" }}>Edit Recurring Shift</h3><p style={{ fontSize: 12, color: "#94A3B8" }}>Which shifts would you like to edit?</p></div>
            </div>
            <div className="space-y-2 mb-5">
              {([
                { scope: "this" as const, label: "This shift only",          sub: "Edit just this occurrence" },
                { scope: "future" as const, label: "This and future shifts", sub: "Edit from this date forward" },
                { scope: "all" as const, label: "All shifts in this series", sub: "Edit the entire series" },
              ] as const).map(({ scope, label, sub }) => (
                <button key={scope} onClick={() => handleSeriesEditConfirm(scope)} className="w-full text-left rounded-xl px-4 py-3 transition-colors hover:bg-[#EFF6FF] flex justify-between items-center" style={{ border: "1px solid #E5EAF2" }}>
                  <div><p style={{ fontSize: 13, fontWeight: 600, color: "#0B1F3A" }}>{label}</p><p style={{ fontSize: 11, color: "#94A3B8" }}>{sub}</p></div>
                  <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#0B2F6B" }} />
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => setRecurringEditDialog(null)}>Cancel</Button>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
