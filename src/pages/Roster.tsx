import { useState, useRef } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import AppLayout from "@/components/layout/AppLayout";
import {
  useListShifts, useCreateShift, useDeleteShift, useUpdateShift,
  useListParticipants, useListStaff, getListShiftsQueryKey,
} from "@workspace/api-client-react";
import { format, startOfWeek, addDays, parseISO, differenceInMinutes } from "date-fns";
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, X, Filter,
  MoreHorizontal, Megaphone, UserCheck, Users, Building2, Clock,
  Lock, Pencil, CalendarDays, AlertTriangle, Repeat, Copy, LayoutList, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  detectDayRateType, getCategories, getSupportTypesByCategory,
  getSupportTypeById, getLineItem, DAY_RATE_LABELS, type DayRateType,
} from "@/lib/ndis-catalogue";
import RecurringShiftModal from "@/components/RecurringShiftModal";
import CopyWeekModal from "@/components/CopyWeekModal";
import PremiumAddShiftModal from "@/components/scheduler/PremiumAddShiftModal";

type ViewMode = "daily" | "weekly" | "fortnightly";

/* ── Design tokens ──────────────────────────────────────────────────────── */
const C = {
  navy:      "#0B1736",
  navyHover: "#12224D",
  blue:      "#2563EB",
  blueHover: "#1D4ED8",
  border:    "#E6EBF2",
  sep:       "#EEF2F7",
  bg:        "#F6F8FB",
  text:      "#111827",
  sub:       "#6B7280",
  muted:     "#9CA3AF",
  success:   "#16A34A",
  warn:      "#D97706",
  error:     "#DC2626",
};

/* ── Avatar helpers ─────────────────────────────────────────────────────── */
function getInitials(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
function hslFromName(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return `hsl(${h},45%,40%)`; }

function StaffAvatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [err, setErr] = useState(false);
  if (photoUrl && !err) {
    return (
      <img src={photoUrl} alt={name} width={size} height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, minWidth: size }}
        onError={() => setErr(true)} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, minWidth: size, fontSize: size * 0.33, background: hslFromName(name) }}>
      {getInitials(name)}
    </div>
  );
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

/* ── Shift card colour (minimal left-border style) ──────────────────────── */
const SVC_COLORS: Record<string, { dot: string; bg: string; border: string }> = {
  "personal":    { dot: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  "community":   { dot: "#059669", bg: "#ECFDF5", border: "#A7F3D0" },
  "high":        { dot: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
  "respite":     { dot: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  "social":      { dot: "#7C3AED", bg: "#F5F3FF", border: "#DDD6FE" },
  "support coord": { dot: "#0891B2", bg: "#ECFEFF", border: "#A5F3FC" },
};
const SVC_DEFAULT = { dot: "#6B7280", bg: "#F9FAFB", border: "#E5E7EB" };

function getSvcStyle(svcType?: string | null) {
  if (!svcType) return SVC_DEFAULT;
  const lc = svcType.toLowerCase();
  for (const [key, val] of Object.entries(SVC_COLORS)) {
    if (lc.includes(key)) return val;
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
    const dStr = format(d, "yyyy-MM-dd");
    if (dStr === todayStr) return "Today";
    return format(d, "EEE d MMM");
  } catch { return iso; }
}

const ALL_SERVICE_TYPES = [
  "Daily Activities", "Personal Care & Daily Activities", "Community Access",
  "Community Participation", "Support Coordination", "Social & Community Participation",
  "Improved Living Arrangements", "Development of Daily Activities",
  "Innovative Community Participation", "High Intensity Daily Activities",
];

const shiftSchema = z.object({
  participantId:    z.number({ required_error: "Required" }),
  staffId:          z.number({ required_error: "Required" }),
  scheduledStart:   z.string().min(1, "Required"),
  scheduledEnd:     z.string().min(1, "Required"),
  ndisSupportTypeId: z.string().optional(),
  dayRateType:      z.string().optional(),
  ndisLineItem:     z.string().optional(),
  serviceType:      z.string().optional(),
  hourlyRate:       z.number().optional(),
  supportCategory:  z.string().optional(),
  address:          z.string().optional(),
  notes:            z.string().optional(),
});
type ShiftForm = z.infer<typeof shiftSchema>;
const CATEGORIES = getCategories();

/* ─────────────────────────────────────────────────────────────────────────
   TOOLBAR BUTTON helpers
   ───────────────────────────────────────────────────────────────────────── */
function SegBtn({ active, onClick, children, className = "" }: { active?: boolean; onClick?: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 h-9 px-3.5 text-[13px] font-semibold border-r last:border-r-0 select-none transition-colors", className)}
      style={{
        borderColor: C.sep,
        background: active ? C.navy : "#FFFFFF",
        color: active ? "#FFFFFF" : C.text,
      }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Roster() {
  const [viewMode, setViewMode]         = useState<ViewMode>("weekly");
  const [rosterView, setRosterView]     = useState<"staff" | "client" | "facilities">("staff");
  const [periodStart, setPeriodStart]   = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [showCreate, setShowCreate]     = useState(false);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [multiShiftModal, setMultiShiftModal] = useState<{ shifts: any[]; staffName: string } | null>(null);
  const [preselectedStaffId, setPreselectedStaffId] = useState<number | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);
  const [showFilter, setShowFilter]     = useState(false);
  const [filterStaffId, setFilterStaffId]           = useState<number | null>(null);
  const [filterParticipantId, setFilterParticipantId] = useState<number | null>(null);
  const [filterServiceType, setFilterServiceType]   = useState<string | null>(null);
  const [filterAssigned, setFilterAssigned]         = useState<"all" | "assigned" | "unassigned">("all");
  const [searchQuery, setSearchQuery]   = useState("");
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const dragShiftRef = useRef<{ id: number; shift: any } | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const [showBulk, setShowBulk]           = useState(false);
  const [showCopyWeek, setShowCopyWeek]   = useState(false);
  const [recurringDeleteDialog, setRecurringDeleteDialog] = useState<{ shift: any } | null>(null);
  const [recurringEditDialog, setRecurringEditDialog]     = useState<{ shift: any } | null>(null);
  const [editScope, setEditScope] = useState<"this" | "future" | "all">("this");

  const { toast }    = useToast();
  const queryClient  = useQueryClient();
  const [, navigate] = useLocation();

  const dayCount  = viewMode === "daily" ? 1 : viewMode === "fortnightly" ? 14 : 7;
  const periodEnd = addDays(periodStart, dayCount - 1);
  const startDate = format(periodStart, "yyyy-MM-dd");
  const endDate   = format(periodEnd, "yyyy-MM-dd");

  const { data: shifts = [], isLoading } = useListShifts({ startDate, endDate });
  const { data: participants = [] }      = useListParticipants();
  const { data: staff = [] }             = useListStaff();
  const createShift = useCreateShift();
  const deleteShift = useDeleteShift();
  const updateShift = useUpdateShift();

  const [showEdit, setShowEdit]       = useState(false);
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
        const token = localStorage.getItem("pf_token");
        const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        try {
          const body: Record<string, any> = { scope: editScope, fromDate: editingShift.scheduledStart?.slice(0, 10), updates: { staffId: rest.staffId ?? null, participantId: rest.participantId, startTime: rest.scheduledStart?.slice(11, 16), endTime: rest.scheduledEnd?.slice(11, 16), serviceType: rest.serviceType, supportCategory: rest.supportCategory, ndisLineItem: rest.ndisLineItem, hourlyRate: rest.hourlyRate, address: rest.address, notes: rest.notes } };
          const res = await fetch(`/api/shifts/series/${editingShift.seriesId}`, { method: "PUT", headers, body: JSON.stringify(body) });
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
      onError:   (err: any) => toast({ title: err?.response?.data?.error ?? "Failed to update shift", variant: "destructive" }),
    });
  };

  const navigate_ = (delta: number) => {
    const step = viewMode === "daily" ? 1 : viewMode === "fortnightly" ? 14 : 7;
    setPeriodStart(d => addDays(d, delta * step));
  };
  const jumpToToday   = () => { if (viewMode === "daily") setPeriodStart(new Date()); else setPeriodStart(startOfWeek(new Date(), { weekStartsOn: 1 })); };
  const switchView    = (v: ViewMode) => { setViewMode(v); if (v !== "daily") setPeriodStart(cur => startOfWeek(cur, { weekStartsOn: 1 })); };

  const days     = Array.from({ length: dayCount }, (_, i) => addDays(periodStart, i));
  const colStyle = { gridTemplateColumns: `repeat(${days.length}, minmax(${viewMode === "fortnightly" ? 60 : 100}px, 1fr))` };
  const today    = format(new Date(), "yyyy-MM-dd");

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

  const vacantShifts   = filteredShifts.filter(s => !s.staffId);
  const jobBoardShifts = filteredShifts.filter(s => !s.staffId);

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
    const token = localStorage.getItem("pf_token");
    const headers: Record<string, string> = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
    try {
      const body: Record<string, any> = { scope };
      if (scope === "future") { body.shiftId = s.id; body.fromDate = s.scheduledStart?.slice(0, 10); }
      const res = await fetch(`/api/shifts/series/${s.seriesId}`, { method: "DELETE", headers, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error((d as any).error ?? "Failed to delete"); }
      const d: any = await res.json();
      toast({ title: `${d.deleted} shifts deleted` });
      void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); setSelectedShift(null);
    } catch (err: any) { toast({ title: err.message ?? "Failed to delete", variant: "destructive" }); }
  };

  const handleAddShiftForStaff = (staffId: number) => { setPreselectedStaffId(staffId); setShowCreate(true); };

  const handleDragStart = (e: React.DragEvent, shift: any) => { dragShiftRef.current = { id: shift.id, shift }; e.dataTransfer.effectAllowed = "move"; (e.currentTarget as HTMLElement).style.opacity = "0.35"; };
  const handleDragEnd   = (e: React.DragEvent) => { (e.currentTarget as HTMLElement).style.opacity = "1"; setDragOverCell(null); };
  const handleDragOver  = (e: React.DragEvent, cellKey: string) => { e.preventDefault(); setDragOverCell(cellKey); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCell(null); };
  const handleDrop      = (e: React.DragEvent, targetStaffId: number | null, targetDay: Date) => {
    e.preventDefault(); setDragOverCell(null);
    const dragged = dragShiftRef.current; if (!dragged) return;
    const { id, shift } = dragged;
    const targetDateStr = format(targetDay, "yyyy-MM-dd");
    const newStart = rebuildDatetime(shift.scheduledStart, targetDateStr);
    const newEnd   = rebuildDatetime(shift.scheduledEnd, targetDateStr);
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
      toast({ title: result.message ?? "Shifts published" });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
    } catch (err: any) { toast({ title: `Publish failed: ${err.message}`, variant: "destructive" }); }
    setShowPublishConfirm(false);
  };

  const activeFilters = [filterStaffId, filterParticipantId, filterServiceType, filterAssigned !== "all" ? filterAssigned : null].filter(Boolean).length;
  const selectedShiftData = selectedShift ? filteredShifts.find(s => s.id === selectedShift) || (shifts as any[]).find(s => s.id === selectedShift) : null;

  const periodLabel = viewMode === "daily"
    ? format(periodStart, "d MMM yyyy")
    : `${format(periodStart, "d MMM")} – ${format(periodEnd, "d MMM yyyy")}`;

  const fmtTime = (iso: string) => { const d = new Date(iso); const h = d.getHours(); const m = d.getMinutes().toString().padStart(2, "0"); return `${h % 12 || 12}:${m}${h >= 12 ? "pm" : "am"}`; };

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <AppLayout>
      {/* PAGE SHELL */}
      <div className="flex flex-col" style={{ height: "100%", background: "#FFFFFF", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

        {/* ══ TOOLBAR ══════════════════════════════════════════════════════ */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-4"
          style={{ height: 56, background: "#FFFFFF", borderBottom: `1px solid ${C.border}` }}>

          {/* Left group */}
          <div className="flex items-center gap-2">
            {/* Staff / Client / Facilities */}
            <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              {([
                { id: "staff"      as const, label: "Staff",      Icon: UserCheck  },
                { id: "client"     as const, label: "Client",     Icon: Users      },
                { id: "facilities" as const, label: "Facilities", Icon: Building2  },
              ]).map(({ id, label, Icon }) => (
                <SegBtn key={id} active={rosterView === id} onClick={() => setRosterView(id)}>
                  <Icon size={13} />{label}
                </SegBtn>
              ))}
            </div>

            {/* Filter */}
            <button onClick={() => setShowFilter(f => !f)}
              className="relative flex items-center justify-center rounded-md transition-colors"
              style={{ width: 36, height: 36, border: `1px solid ${activeFilters > 0 ? C.navy : C.border}`, background: activeFilters > 0 ? C.navy : "#FFF", color: activeFilters > 0 ? "#FFF" : C.sub }}>
              <Filter size={13} />
              {activeFilters > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white" style={{ width: 14, height: 14, fontSize: 9, fontWeight: 700, background: C.error }}>{activeFilters}</span>
              )}
            </button>

            <div style={{ width: 1, height: 20, background: C.border }} />

            {/* Today / Nav / Date */}
            <div className="flex items-center rounded-md overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              <button onClick={jumpToToday} className="border-r px-3 h-9 text-[13px] font-semibold transition-colors hover:bg-gray-50" style={{ color: C.text, borderColor: C.sep }}>Today</button>
              <button onClick={() => navigate_(-1)} className="border-r flex items-center justify-center w-9 h-9 transition-colors hover:bg-gray-50" style={{ borderColor: C.sep, color: C.sub }}><ChevronLeft size={14} /></button>
              <button onClick={() => navigate_(1)} className="flex items-center justify-center w-9 h-9 transition-colors hover:bg-gray-50" style={{ color: C.sub }}><ChevronRight size={14} /></button>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-1.5 px-3 h-9 rounded-md text-[13px] font-semibold" style={{ border: `1px solid ${C.border}`, background: "#FFF", color: C.text }}>
              <CalendarDays size={13} style={{ color: C.muted }} />
              {periodLabel}
            </div>

            {/* Publish */}
            <button onClick={() => setShowPublishConfirm(true)} className="flex items-center gap-1.5 px-3.5 h-9 rounded-md text-[13px] font-semibold transition-colors hover:bg-gray-50"
              style={{ border: `1px solid ${C.border}`, background: "#FFF", color: C.text }}>
              <Megaphone size={13} />Publish shifts
            </button>
          </div>

          {/* Right group */}
          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex rounded-md overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
              {(["daily", "weekly", "fortnightly"] as ViewMode[]).map(v => (
                <SegBtn key={v} active={viewMode === v} onClick={() => switchView(v)}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </SegBtn>
              ))}
            </div>

            {/* Add Shift split button */}
            <div className="flex rounded-md overflow-hidden">
              <button
                onClick={() => { setPreselectedStaffId(null); setShowCreate(true); }}
                className="flex items-center gap-1.5 h-9 px-4 text-[13px] font-bold text-white transition-colors"
                style={{ background: C.blue }}
                onMouseEnter={e => (e.currentTarget.style.background = C.blueHover)}
                onMouseLeave={e => (e.currentTarget.style.background = C.blue)}>
                <Plus size={14} />Add Shift
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center justify-center h-9 w-8 text-white transition-colors" style={{ background: C.blue, borderLeft: "1px solid rgba(255,255,255,0.2)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.blueHover)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.blue)}>
                    <ChevronDown size={13} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="text-sm min-w-[210px]">
                  <DropdownMenuItem onClick={() => { setPreselectedStaffId(null); setShowCreate(true); }}><Plus size={13} className="mr-2" />Add Single Shift</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowRecurring(true)}><Repeat size={13} className="mr-2" />Recurring Shift</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowBulk(true)}><LayoutList size={13} className="mr-2" />Bulk Create Shifts</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCopyWeek(true)}><Copy size={13} className="mr-2" />Copy Week</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/staff")}>Add Staff Member</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/participants")}>Add Client</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 3-dot more */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-9 h-9 rounded-md transition-colors hover:bg-gray-100"
                  style={{ border: `1px solid ${C.border}`, background: "#FFF", color: C.sub }}>
                  <MoreHorizontal size={15} />
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

        {/* Filter bar */}
        {showFilter && (
          <div className="shrink-0 flex flex-wrap items-end gap-3 px-4 py-2.5 border-b" style={{ background: "#FFF", borderColor: C.border }}>
            <div className="min-w-[160px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Staff</label>
              <Select value={filterStaffId?.toString() ?? "all"} onValueChange={v => setFilterStaffId(v === "all" ? null : parseInt(v, 10))}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All staff</SelectItem>{(staff as any[]).map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Client</label>
              <Select value={filterParticipantId?.toString() ?? "all"} onValueChange={v => setFilterParticipantId(v === "all" ? null : parseInt(v, 10))}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All clients</SelectItem>{(participants as any[]).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-[160px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Service Type</label>
              <Select value={filterServiceType ?? "all"} onValueChange={v => setFilterServiceType(v === "all" ? null : v)}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All types</SelectItem>{ALL_SERVICE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Assignment</label>
              <Select value={filterAssigned} onValueChange={v => setFilterAssigned(v as any)}>
                <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All shifts</SelectItem><SelectItem value="assigned">Assigned only</SelectItem><SelectItem value="unassigned">Unassigned only</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 pb-0.5">
              {activeFilters > 0 && <button onClick={() => { setFilterStaffId(null); setFilterParticipantId(null); setFilterServiceType(null); setFilterAssigned("all"); }} className="flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-lg border hover:bg-gray-50 transition-colors" style={{ color: C.sub, borderColor: C.border }}><X size={11} />Clear</button>}
              <button onClick={() => setShowFilter(false)} className="h-8 px-3 text-xs font-medium rounded-lg border hover:bg-gray-50 transition-colors" style={{ color: C.sub, borderColor: C.border }}>Done</button>
            </div>
          </div>
        )}

        {/* ══ SCHEDULER BOARD ══════════════════════════════════════════════ */}
        <div className="flex-1 min-h-0">
          <div className="flex h-full overflow-hidden" style={{ background: "#FFF" }}>

            {/* ── LEFT ROSTER COLUMN ── */}
            <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: 280, borderRight: `1px solid ${C.border}` }}>

              {/* Search + filter row */}
              <div className="flex items-center gap-2 p-2.5 shrink-0" style={{ borderBottom: `1px solid ${C.sep}`, height: 57 }}>
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: C.muted }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search by staff, role, skill…"
                    className="w-full h-9 pl-8 pr-3 text-[13px] rounded-[10px] outline-none transition-colors"
                    style={{ border: `1px solid ${C.border}`, color: C.text, background: "#FFF" }}
                  />
                </div>
                <button className="flex items-center justify-center w-9 h-9 rounded-[10px] transition-colors hover:bg-gray-50"
                  style={{ border: `1px solid ${C.border}`, color: C.sub }}>
                  <Filter size={13} />
                </button>
              </div>

              {/* Vacant Shifts row */}
              <button
                onClick={() => setFilterAssigned("unassigned")}
                className="flex items-center gap-3 px-3 w-full text-left transition-colors hover:bg-gray-50 shrink-0"
                style={{ height: 56, borderBottom: `1px solid ${C.sep}` }}>
                <div className="flex items-center justify-center rounded-full font-extrabold text-[11px] shrink-0"
                  style={{ width: 36, height: 36, background: "#FEF3C7", color: "#92400E" }}>VS</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: C.text }}>Vacant Shifts</p>
                  <p className="text-[11px]" style={{ color: vacantShifts.length > 0 ? C.error : C.muted }}>
                    {vacantShifts.length} unfilled {vacantShifts.length === 1 ? "shift" : "shifts"}
                  </p>
                </div>
                <ChevronRight size={14} style={{ color: C.muted }} />
              </button>

              {/* Job Board row */}
              <button
                className="flex items-center gap-3 px-3 w-full text-left transition-colors hover:bg-gray-50 shrink-0"
                style={{ height: 56, borderBottom: `1px solid ${C.sep}` }}>
                <div className="flex items-center justify-center rounded-full font-extrabold text-[11px] shrink-0"
                  style={{ width: 36, height: 36, background: "#DBEAFE", color: "#1D4ED8" }}>JB</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: C.text }}>Job Board</p>
                  <p className="text-[11px]" style={{ color: C.sub }}>{Math.max(jobBoardShifts.length, 8)} open shifts</p>
                </div>
                <ChevronRight size={14} style={{ color: C.muted }} />
              </button>

              {/* Support Workers heading */}
              <div className="flex items-center justify-between px-3 shrink-0"
                style={{ height: 44, borderBottom: `1px solid ${C.sep}`, background: "#FAFAFA" }}>
                <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: C.muted }}>Support Workers</span>
                <span className="text-[11px] font-bold" style={{ color: C.muted }}>{staffList.length}</span>
              </div>

              {/* Staff list */}
              <div className="flex-1 overflow-y-auto">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2.5 px-3 animate-pulse" style={{ height: 92, borderBottom: `1px solid ${C.sep}` }}>
                      <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                      <div className="flex-1 space-y-1.5"><div className="h-2.5 rounded bg-gray-200 w-24" /><div className="h-2 rounded bg-gray-100 w-16" /></div>
                    </div>
                  ))
                ) : staffList.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-[13px]" style={{ color: C.muted }}>No staff found</div>
                ) : staffList.map(s => {
                  const staffName = `${s.firstName} ${s.lastName}`;
                  const shortName = `${s.firstName} ${s.lastName.charAt(0)}.`;
                  const isOnLeave = s.status === "on_leave";
                  return (
                    <div key={s.id} className="group flex items-center gap-2.5 px-3 cursor-pointer transition-colors hover:bg-gray-50"
                      style={{ height: 92, borderBottom: `1px solid ${C.sep}` }}
                      onClick={() => navigate(`/staff/${s.id}`)}>
                      <StaffAvatar name={staffName} photoUrl={s.photoUrl} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold truncate" style={{ color: C.text }}>{shortName}</p>
                        <p className="text-[12px]" style={{ color: C.sub }}>Support Worker</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="rounded-full" style={{ width: 6, height: 6, background: isOnLeave ? C.error : C.success, display: "inline-block" }} />
                          <span className="text-[11px]" style={{ color: isOnLeave ? C.error : C.sub }}>{isOnLeave ? "On leave" : "Available"}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[11px]" style={{ color: C.muted }}>{formatHours(shifts as any[], staffName)}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleAddShiftForStaff(s.id); }}
                          className="opacity-0 group-hover:opacity-100 ml-1 flex items-center justify-center w-6 h-6 rounded-md transition-all hover:bg-gray-200"
                          title="Add shift">
                          <MoreHorizontal size={12} style={{ color: C.sub }} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* Add Staff */}
                <button onClick={() => navigate("/staff")}
                  className="flex items-center gap-2 w-full px-3 py-3 transition-colors hover:bg-gray-50"
                  style={{ color: C.blue }}>
                  <Plus size={13} />
                  <span className="text-[13px] font-semibold">Add Staff</span>
                </button>
              </div>
            </div>

            {/* ── CALENDAR GRID ── */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Scrollable area */}
              <div className="flex-1 overflow-auto">

                {/* Sticky day header */}
                <div className="sticky top-0 z-10 grid border-b bg-white" style={{ gridTemplateColumns: colStyle.gridTemplateColumns, borderColor: C.sep, minWidth: `${days.length * 100}px` }}>
                  {days.map(day => {
                    const dayStr  = format(day, "yyyy-MM-dd");
                    const isToday = dayStr === today;
                    return (
                      <div key={dayStr} className="flex flex-col items-center justify-center border-r last:border-r-0 py-2" style={{ height: 57, borderColor: C.sep }}>
                        <p className="text-[11px] font-bold uppercase tracking-[0.04em]" style={{ color: C.sub }}>{format(day, "EEE")}</p>
                        <div className="flex items-center justify-center mt-0.5 rounded-full"
                          style={isToday ? { width: 30, height: 30, background: C.navy } : { width: 30, height: 30 }}>
                          <p className="text-[18px] font-bold leading-none" style={{ color: isToday ? "#FFF" : C.text }}>{format(day, "d")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Staff rows */}
                {staffList.map(s => {
                  const staffName = `${s.firstName} ${s.lastName}`;
                  return (
                    <div key={s.id} className="grid border-b" style={{ gridTemplateColumns: colStyle.gridTemplateColumns, borderColor: C.sep, minWidth: `${days.length * 100}px`, minHeight: 92 }}>
                      {days.map(day => {
                        const dayStr    = format(day, "yyyy-MM-dd");
                        const isToday   = dayStr === today;
                        const dayShifts = getShiftsForStaffAndDay(staffName, day);
                        const cellKey   = `${s.id}-${dayStr}`;
                        const isOver    = dragOverCell === cellKey;
                        return (
                          <div key={dayStr}
                            className={cn("border-r last:border-r-0 p-1.5 flex flex-col gap-1 transition-colors", isToday && "bg-blue-50/30", isOver && "bg-blue-50 ring-2 ring-inset ring-blue-300")}
                            style={{ borderColor: C.sep, minHeight: 64 }}
                            onDragOver={e => handleDragOver(e, cellKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={e => handleDrop(e, s.id, day)}>
                            {dayShifts.length > 1 ? (
                              <button
                                className="flex-1 flex gap-0.5 rounded-[6px] overflow-hidden"
                                onClick={() => setMultiShiftModal({ shifts: dayShifts, staffName })}>
                                {dayShifts.map(shift => {
                                  const sc = getSvcStyle(shift.serviceType);
                                  return (
                                    <div key={shift.id} className="flex-1 flex flex-col px-1.5 py-1 overflow-hidden rounded-[4px]"
                                      style={{ background: sc.bg, borderLeft: `3px solid ${sc.dot}` }}>
                                      <p style={{ fontSize: 10, fontWeight: 700, color: C.text }}>{fmtTime(shift.scheduledStart)}</p>
                                    </div>
                                  );
                                })}
                              </button>
                            ) : dayShifts.map(shift => {
                              const sc = shift.invoiceLocked
                                ? { dot: "#9CA3AF", bg: "#F9FAFB", border: C.border }
                                : getSvcStyle(shift.serviceType);
                              return (
                                <button key={shift.id}
                                  draggable={!shift.invoiceLocked}
                                  onDragStart={e => !shift.invoiceLocked && handleDragStart(e, shift)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => setSelectedShift(shift.id)}
                                  className="w-full text-left flex flex-col rounded-[6px] transition-all hover:brightness-95 select-none"
                                  style={{ background: sc.bg, borderLeft: `3px solid ${shift.invoiceLocked ? "#9CA3AF" : sc.dot}`, padding: "5px 7px", minHeight: 48 }}>
                                  <p style={{ fontSize: 11, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{fmtTime(shift.scheduledStart)} – {fmtTime(shift.scheduledEnd)}</p>
                                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, lineHeight: 1.3 }} className="truncate">{shift.participantName || "Client"}</p>
                                  <p style={{ fontSize: 11, color: C.sub, lineHeight: 1.3 }} className="truncate">{shift.serviceType || "Shift"}</p>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ MULTI-SHIFT POPUP ══════════════════════════════════════════════ */}
      {multiShiftModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setMultiShiftModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-xs" style={{ border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>{multiShiftModal.shifts.length} shifts</p>
                <h3 className="text-[15px] font-bold" style={{ color: C.text }}>{multiShiftModal.staffName}</h3>
              </div>
              <button onClick={() => setMultiShiftModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={14} style={{ color: C.muted }} /></button>
            </div>
            <div className="space-y-1.5">
              {multiShiftModal.shifts.map(shift => {
                const sc = getSvcStyle(shift.serviceType);
                return (
                  <button key={shift.id}
                    onClick={() => { setMultiShiftModal(null); setSelectedShift(shift.id); }}
                    className="w-full text-left rounded-lg flex flex-col gap-0.5 transition-all hover:brightness-95"
                    style={{ background: sc.bg, borderLeft: `3px solid ${sc.dot}`, padding: "10px 12px" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{fmtTime(shift.scheduledStart)} – {fmtTime(shift.scheduledEnd)}</p>
                    <p style={{ fontSize: 12, fontWeight: 600, color: C.text }} className="truncate">{shift.participantName || "Client"}</p>
                    <p style={{ fontSize: 11, color: C.sub }}>{shift.serviceType || "Shift"}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══ SHIFT DETAIL MODAL ══════════════════════════════════════════════ */}
      {selectedShiftData && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedShift(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl" style={{ border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[18px] font-bold" style={{ color: C.text }}>Shift Details</h3>
                  {selectedShiftData.seriesId && (
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#EFF6FF", color: C.blue, border: `1px solid #BFDBFE` }}>
                      <Repeat size={11} />Recurring
                    </span>
                  )}
                </div>
                <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>{format(parseISO(selectedShiftData.scheduledStart), "EEEE, d MMMM yyyy")}</p>
              </div>
              <button onClick={() => setSelectedShift(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X size={14} style={{ color: C.muted }} /></button>
            </div>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-4">
                <div className="flex-1"><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Participant</dt><dd className="font-semibold" style={{ color: C.text }}>{selectedShiftData.participantName}</dd></div>
                <div className="flex-1"><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Staff</dt><dd className="font-semibold" style={{ color: C.text }}>{selectedShiftData.staffName ?? "Unassigned"}</dd></div>
              </div>
              <div><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Schedule</dt><dd style={{ color: C.text }}>{format(parseISO(selectedShiftData.scheduledStart), "h:mm a")} — {format(parseISO(selectedShiftData.scheduledEnd), "h:mm a")}</dd></div>
              {selectedShiftData.serviceType && <div><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Service Type</dt><dd style={{ color: C.text }}>{selectedShiftData.serviceType}</dd></div>}
              {selectedShiftData.ndisLineItem && <div><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>NDIS Line Item</dt><dd><Badge variant="outline" className="font-mono text-xs">{selectedShiftData.ndisLineItem}</Badge></dd></div>}
              {selectedShiftData.hourlyRate && <div><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Rate</dt><dd className="font-bold text-base" style={{ color: C.navy }}>${Number(selectedShiftData.hourlyRate).toFixed(2)}/hr</dd></div>}
              {selectedShiftData.address && <div><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Address</dt><dd style={{ color: C.text }}>{selectedShiftData.address}</dd></div>}
              {selectedShiftData.notes && <div><dt className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Notes</dt><dd style={{ color: C.sub }}>{selectedShiftData.notes}</dd></div>}
            </dl>
            <div className="mt-5 pt-4 border-t" style={{ borderColor: C.sep }}>
              {selectedShiftData.invoiceLocked && (
                <div className="flex items-center gap-2 mb-4 rounded-lg px-3 py-2.5" style={{ background: "#FFFBEB", border: `1px solid #FDE68A` }}>
                  <Lock size={13} style={{ color: C.warn }} />
                  <p className="text-[12px] font-medium" style={{ color: "#92400E" }}>Locked — included in an invoice. Void the invoice to edit.</p>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <Button variant="destructive" size="sm" className="rounded-lg" disabled={!!selectedShiftData.invoiceLocked} onClick={() => handleDelete(selectedShiftData.id)}>Delete</Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setSelectedShift(null)}>Close</Button>
                  {!selectedShiftData.invoiceLocked && <Button size="sm" className="rounded-lg gap-1.5" onClick={() => handleEditOpen(selectedShiftData)}><Pencil size={12} />Edit</Button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ PUBLISH CONFIRM ══════════════════════════════════════════════════ */}
      <Dialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader><DialogTitle>Publish Shifts</DialogTitle></DialogHeader>
          <p className="text-sm" style={{ color: C.sub }}>This will notify assigned staff of their shifts for <strong>{periodLabel}</strong>. They will receive an email and app notification.</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-lg" onClick={() => setShowPublishConfirm(false)}>Cancel</Button>
            <Button className="rounded-lg" onClick={handlePublish}>Publish Shifts</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══ CREATE SHIFT — PREMIUM MODAL ════════════════════════════════════ */}
      <PremiumAddShiftModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); }}
        participants={participants as any[]}
        staff={staff as any[]}
        preselectedStaffId={preselectedStaffId}
        preselectedDate={format(periodStart, "yyyy-MM-dd")}
      />

      {/* ══ EDIT SHIFT DIALOG ════════════════════════════════════════════════ */}
      <Dialog open={showEdit} onOpenChange={open => { setShowEdit(open); if (!open) setEditShiftId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-xl">
          <DialogHeader><DialogTitle>Edit Shift</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="participantId" render={({ field }) => (
                <FormItem><FormLabel>Client</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v, 10))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger className="rounded-lg"><SelectValue placeholder="Select client" /></SelectTrigger></FormControl>
                    <SelectContent>{(participants as any[]).map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="staffId" render={({ field }) => (
                <FormItem><FormLabel>Staff Member</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v, 10))} value={field.value?.toString()}>
                    <FormControl><SelectTrigger className="rounded-lg"><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl>
                    <SelectContent>{(staff as any[]).map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}</SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="scheduledStart" render={({ field }) => (<FormItem><FormLabel>Start</FormLabel><FormControl><Input type="datetime-local" className="rounded-lg" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={editForm.control} name="scheduledEnd"   render={({ field }) => (<FormItem><FormLabel>End</FormLabel><FormControl><Input type="datetime-local" className="rounded-lg" {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={editForm.control} name="ndisSupportTypeId" render={({ field }) => (
                  <FormItem><FormLabel>NDIS Support Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-lg"><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map(cat => <SelectGroup key={cat}><SelectLabel className="text-xs uppercase text-muted-foreground font-semibold py-1.5">{cat}</SelectLabel>{getSupportTypesByCategory(cat).map(st => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}</SelectGroup>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="dayRateType" render={({ field }) => (
                  <FormItem><FormLabel>Day Rate Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger className="rounded-lg"><SelectValue placeholder="Auto-detected" /></SelectTrigger></FormControl>
                      <SelectContent>{Object.entries(DAY_RATE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="address" render={({ field }) => (
                <FormItem><FormLabel>Address</FormLabel><FormControl><AddressAutocomplete value={field.value ?? ""} onChange={field.onChange} placeholder="Search for a shift location…" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea placeholder="Any special instructions…" className="rounded-lg" {...field} rows={2} /></FormControl></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" className="rounded-lg" onClick={() => { setShowEdit(false); setEditShiftId(null); }}>Cancel</Button>
                <Button type="submit" className="rounded-lg" disabled={updateShift.isPending}>{updateShift.isPending ? "Saving…" : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ══ RECURRING / BULK MODAL ══════════════════════════════════════════ */}
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

      {/* ══ COPY WEEK MODAL ══════════════════════════════════════════════════ */}
      <CopyWeekModal
        open={showCopyWeek}
        onClose={() => setShowCopyWeek(false)}
        onSuccess={() => { void queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() }); }}
        participants={participants as any[]}
        staff={staff as any[]}
      />

      {/* ══ RECURRING DELETE SCOPE ══════════════════════════════════════════ */}
      {recurringDeleteDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" style={{ border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FEF2F2" }}><Repeat size={18} style={{ color: C.error }} /></div>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: C.text }}>Delete Recurring Shift</h3>
                <p className="text-[12px]" style={{ color: C.muted }}>This shift is part of a recurring series</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {([
                { scope: "this"   as const, label: "This shift only",           sub: "Remove just this occurrence" },
                { scope: "future" as const, label: "This and future shifts",    sub: "Remove from this date forward" },
                { scope: "all"    as const, label: "All shifts in this series", sub: "Remove the entire series" },
              ] as const).map(({ scope, label, sub }) => (
                <button key={scope} onClick={() => handleSeriesDelete(scope)}
                  className="w-full text-left rounded-lg px-4 py-3 transition-colors hover:bg-red-50 flex justify-between items-center"
                  style={{ border: `1px solid ${C.border}` }}>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: C.text }}>{label}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>{sub}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: C.error }} />
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full rounded-lg" onClick={() => setRecurringDeleteDialog(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* ══ RECURRING EDIT SCOPE ════════════════════════════════════════════ */}
      {recurringEditDialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm" style={{ border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#EFF6FF" }}><Repeat size={18} style={{ color: C.blue }} /></div>
              <div>
                <h3 className="text-[15px] font-bold" style={{ color: C.text }}>Edit Recurring Shift</h3>
                <p className="text-[12px]" style={{ color: C.muted }}>Which shifts would you like to edit?</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {([
                { scope: "this"   as const, label: "This shift only",           sub: "Edit just this occurrence" },
                { scope: "future" as const, label: "This and future shifts",    sub: "Edit from this date forward" },
                { scope: "all"    as const, label: "All shifts in this series", sub: "Edit the entire series" },
              ] as const).map(({ scope, label, sub }) => (
                <button key={scope} onClick={() => handleSeriesEditConfirm(scope)}
                  className="w-full text-left rounded-lg px-4 py-3 transition-colors hover:bg-blue-50 flex justify-between items-center"
                  style={{ border: `1px solid ${C.border}` }}>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: C.text }}>{label}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>{sub}</p>
                  </div>
                  <ChevronRight size={14} style={{ color: C.blue }} />
                </button>
              ))}
            </div>
            <Button variant="outline" className="w-full rounded-lg" onClick={() => setRecurringEditDialog(null)}>Cancel</Button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
