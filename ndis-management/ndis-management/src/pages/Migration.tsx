import React, { useState, useRef, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  Info, Users, User, CalendarDays, Phone, CreditCard, FileText, ClipboardCheck,
  ClipboardList, AlertTriangle, Folder, Pill, Clock, Receipt, MessageSquare,
  CalendarCheck, FileEdit, Bot, ShieldCheck, Headphones, Download, ArrowRight,
  Check, X, Loader2, ChevronDown, ChevronUp, ArrowLeft, Sparkles, AlertCircle,
  CircleCheck, Wand2, HelpCircle, Star,
} from "lucide-react";

/* ── Design tokens (match Roster.tsx exactly) ────────────────────────────── */
const C = {
  navy:    "#0B1736",
  blue:    "#2563EB",
  blueFg:  "#1D4ED8",
  border:  "#E6EBF2",
  sep:     "#EEF2F7",
  bg:      "#F6F8FB",
  text:    "#111827",
  sub:     "#6B7280",
  muted:   "#9CA3AF",
  success: "#16A34A",
  warn:    "#D97706",
  error:   "#DC2626",
  aiBg:    "#F8FBFF",
  aiBorder:"#DDEBFF",
  aiStar:  "#78B9FF",
};

const FF = "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ─── Types ─────────────────────────────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4 | 5 | 6;

interface ImportCategory {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

interface PreviewRow { [key: string]: any; _errors?: string[]; }
interface PreviewData {
  [key: string]: { rows: PreviewRow[]; total: number; error?: string } | undefined;
}
interface MappingEntry {
  field: string | null;
  confidence: number;
  source: "exact" | "fuzzy" | "ai" | "none";
  alternatives: string[];
}
interface Anomaly { type: "warning" | "error"; message: string; column?: string; }
interface DetectResult {
  originalHeaders: string[];
  sample: Record<string, string>[];
  mappings: Record<string, MappingEntry>;
  detectedType: string;
  detectedTypeConfidence: number;
  detectedTypeReason: string;
  totalRows: number;
  anomalies: Anomaly[];
  aiUsed: boolean;
}

/* ─── Category definitions ───────────────────────────────────────────────── */
const AUTO_DETECT: ImportCategory = {
  id: "auto",
  label: "AI Auto-Detect",
  description: "Upload any file and let AI automatically detect the data type and map all fields.",
  icon: Wand2,
};

const CORE: ImportCategory[] = [
  { id: "participants", label: "1. Participants / Clients",      icon: Users,          description: "Import client profiles, NDIS details, plan dates, contacts, funding type and more." },
  { id: "staff",        label: "2. Support Workers / Staff",     icon: User,           description: "Import worker profiles, roles, positions, employment details, pay rates etc." },
  { id: "shifts",       label: "3. Shifts / Appointments",       icon: CalendarDays,   description: "Import shifts, times, participants, workers, services and status." },
];

const CARE: ImportCategory[] = [
  { id: "contacts",   label: "4. Participant Contacts",         icon: Phone,          description: "Import emergency contacts, family, guardians and advocates." },
  { id: "agreements", label: "5. Service Agreements",           icon: FileText,       description: "Import service agreements, start/end dates and total budgets." },
  { id: "casenotes",  label: "6. Case Notes / Progress Notes",  icon: ClipboardList,  description: "Import progress notes, goals, observations and follow-ups." },
  { id: "incidents",  label: "7. Incidents",                    icon: AlertTriangle,  description: "Import incidents, reports, follow ups and actions." },
  { id: "documents",  label: "8. Documents / Files",            icon: Folder,         description: "Import document records, certificates and compliance files." },
  { id: "medication", label: "9. Medication Records",           icon: Pill,           description: "Import medications, schedules, dosages and instructions (preview only)." },
  { id: "careplans",  label: "10. Care Plans / Support Plans",  icon: ClipboardCheck, description: "Import care plans, goals, tasks and supports (preview only)." },
];

const OPS: ImportCategory[] = [
  { id: "timesheets", label: "11. Timesheets",        icon: Clock,          description: "Import worker timesheets, hours and approvals." },
  { id: "invoices",   label: "12. Invoices",          icon: Receipt,        description: "Import invoices, line items, status and payments." },
  { id: "quotes",     label: "13. Quotes",            icon: MessageSquare,  description: "Import quotes, items, pricing and status." },
  { id: "tasks",      label: "14. Tasks",             icon: CalendarCheck,  description: "Import tasks, assignments, due dates and status." },
  { id: "forms",      label: "15. Forms / Templates", icon: FileEdit,       description: "Import custom forms and template data." },
];

const ALL_CATEGORIES = [...CORE, ...CARE, ...OPS];
const PREVIEW_ONLY_TYPES: string[] = [];

const TYPE_LABELS: Record<string, string> = {
  participants: "Participants / Clients",
  staff:        "Support Workers / Staff",
  shifts:       "Shifts / Appointments",
  contacts:     "Participant Contacts",
  agreements:   "Service Agreements",
  casenotes:    "Case Notes",
  incidents:    "Incidents",
  documents:    "Documents",
  medication:   "Medication Records",
  careplans:    "Care Plans",
  timesheets:   "Timesheets",
  invoices:     "Invoices",
  quotes:       "Quotes",
  tasks:        "Tasks",
  forms:        "Forms / Templates",
};

function getTypeLabel(id: string): string {
  return TYPE_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}
function getTypeIcon(id: string): React.ElementType {
  const cat = ALL_CATEGORIES.find(c => c.id === id);
  return cat?.icon ?? FileText;
}

/* ─── System field options ───────────────────────────────────────────────── */
const SYSTEM_FIELDS = [
  { value: "first_name",            label: "First Name" },
  { value: "last_name",             label: "Last Name" },
  { value: "full_name",             label: "Full Name" },
  { value: "salutation",            label: "Salutation / Title" },
  { value: "gender",                label: "Gender" },
  { value: "email",                 label: "Email" },
  { value: "phone",                 label: "Phone / Mobile" },
  { value: "date_of_birth",         label: "Date of Birth" },
  { value: "ndis_number",           label: "NDIS Number" },
  { value: "reference_number",      label: "Reference Number" },
  { value: "plan_start_date",       label: "Plan Start Date" },
  { value: "plan_end_date",         label: "Plan End Date" },
  { value: "funding_type",          label: "Funding Type" },
  { value: "address",               label: "Address" },
  { value: "suburb",                label: "Suburb" },
  { value: "state",                 label: "State" },
  { value: "postcode",              label: "Postcode" },
  { value: "area",                  label: "Area / Region" },
  { value: "status",                label: "Status" },
  { value: "client_types",          label: "Client Types" },
  { value: "teams",                 label: "Teams" },
  { value: "carer_name",            label: "Carer / Guardian Name" },
  { value: "carer_relation",        label: "Carer Relationship" },
  { value: "position",              label: "Position / Role" },
  { value: "employment_type",       label: "Employment Type" },
  { value: "start_date",            label: "Start Date (Employment)" },
  { value: "date",                  label: "Date / Shift Date" },
  { value: "start_time",            label: "Start Time" },
  { value: "end_time",              label: "End Time" },
  { value: "participant_name",      label: "Participant Name" },
  { value: "staff_name",            label: "Staff / Worker Name" },
  { value: "service_type",          label: "Service Type" },
  { value: "notes",                 label: "Notes / Comments" },
  { value: "note_content",          label: "Note Content" },
  { value: "note_type",             label: "Note Type" },
  { value: "note_date",             label: "Note Date" },
  { value: "note_author",           label: "Note Author" },
  { value: "goal_reference",        label: "Goal Reference" },
  { value: "follow_up_required",    label: "Follow-Up Required" },
  { value: "follow_up_date",        label: "Follow-Up Date" },
  { value: "incident_type",         label: "Incident Type" },
  { value: "incident_date",         label: "Incident Date" },
  { value: "severity",              label: "Severity" },
  { value: "location",              label: "Location" },
  { value: "actions_taken",         label: "Actions Taken" },
  { value: "reportable",            label: "Reportable to NDIS" },
  { value: "task_title",            label: "Task Title" },
  { value: "task_description",      label: "Task Description" },
  { value: "task_priority",         label: "Task Priority" },
  { value: "task_status",           label: "Task Status" },
  { value: "due_date",              label: "Due Date" },
  { value: "assigned_to",           label: "Assigned To" },
  { value: "task_category",         label: "Task Category" },
  { value: "work_date",             label: "Work Date" },
  { value: "week_starting",         label: "Week Starting" },
  { value: "actual_hours",          label: "Actual Hours" },
  { value: "scheduled_hours",       label: "Scheduled Hours" },
  { value: "break_minutes",         label: "Break (minutes)" },
  { value: "approval_status",       label: "Approval Status" },
  { value: "invoice_number",        label: "Invoice Number" },
  { value: "period_start",          label: "Period Start" },
  { value: "period_end",            label: "Period End" },
  { value: "total_amount",          label: "Total Amount" },
  { value: "gst_amount",            label: "GST Amount" },
  { value: "invoice_status",        label: "Invoice Status" },
  { value: "paid_date",             label: "Paid Date" },
  { value: "quote_number",          label: "Quote Number" },
  { value: "quote_title",           label: "Quote Title" },
  { value: "valid_until",           label: "Valid Until" },
  { value: "form_title",            label: "Form Title" },
  { value: "form_category",         label: "Form Category" },
  { value: "agreement_number",      label: "Agreement Number" },
  { value: "agreement_start",       label: "Agreement Start Date" },
  { value: "agreement_end",         label: "Agreement End Date" },
  { value: "total_budget",          label: "Total Budget" },
  { value: "contact_name",          label: "Contact Name" },
  { value: "contact_relationship",  label: "Contact Relationship" },
  { value: "contact_phone",         label: "Contact Phone" },
  { value: "is_primary",            label: "Is Primary Contact" },
  { value: "document_type",         label: "Document Type" },
  { value: "file_name",             label: "File Name" },
  { value: "expiry_date",           label: "Expiry Date" },
  { value: "medication_name",       label: "Medication Name" },
  { value: "dosage",                label: "Dosage" },
  { value: "frequency",             label: "Frequency" },
  { value: "route",                 label: "Route / Method" },
  { value: "prescriber",            label: "Prescriber" },
  { value: "created_at",            label: "Created Date" },
  { value: "updated_at",            label: "Updated Date" },
  { value: "client_id",             label: "Client ID (external)" },
  { value: "custom_field_1",        label: "Custom Field 1" },
  { value: "custom_field_2",        label: "Custom Field 2" },
  { value: "custom_field_3",        label: "Custom Field 3" },
];

/* ─── Steps ──────────────────────────────────────────────────────────────── */
const STEPS = [
  { label: "Choose Data Type",     sub: "Select what you want to import" },
  { label: "Upload Files",         sub: "Upload your CSV or XLSX file" },
  { label: "AI Auto-Detect & Map", sub: "AI suggests field mappings" },
  { label: "Preview & Validate",   sub: "Review data and fix issues" },
  { label: "Confirm Import",       sub: "Confirm and start import" },
  { label: "Complete",             sub: "View summary and results" },
];

/* ─── Stepper — slim enterprise style ───────────────────────────────────── */
function Stepper({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 0, paddingBottom: 18, marginBottom: 20, borderBottom: `1px solid ${C.border}`, fontFamily: FF, overflowX: "auto" }}>
      {STEPS.map((s, i) => {
        const num    = i + 1;
        const done   = current > num;
        const active = current === num;
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", flexShrink: 0 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 999, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700,
                  background: active ? C.navy : done ? "#E8ECF4" : "#FFFFFF",
                  color: active ? "#FFFFFF" : done ? C.navy : C.muted,
                  border: `1px solid ${active ? C.navy : done ? "#D1D5DB" : C.border}`,
                }}>
                  {done ? <Check size={13} strokeWidth={2.5} style={{ color: C.navy }} /> : num}
                </div>
              </div>
              <div style={{ textAlign: "center", maxWidth: 100 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? C.text : done ? C.sub : C.muted, lineHeight: 1.3 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 1, lineHeight: 1.3 }}>{s.sub}</div>
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 16, display: "flex", alignItems: "center", margin: "0 4px", paddingTop: 7, flexShrink: 0 }}>
                <div style={{ width: 36, height: 1, background: done ? C.navy : C.border }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Primary action button ─────────────────────────────────────────────── */
function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      height: 40, padding: "0 18px", borderRadius: 6,
      background: disabled ? C.border : C.blue,
      border: "none", color: disabled ? C.muted : "#FFFFFF",
      fontSize: 13, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 8,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "background-color 140ms ease, color 140ms ease",
      fontFamily: FF,
    }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = C.blueFg; }}
      onMouseLeave={e => { if (!disabled) (e.currentTarget as HTMLElement).style.background = C.blue; }}
    >{children}</button>
  );
}

/* ─── Import category card — flat, no gradients ──────────────────────────── */
function CategoryCard({ cat, selected, onToggle, aiMode }: {
  cat: ImportCategory; selected: boolean; onToggle: () => void; aiMode?: boolean;
}) {
  const Icon = cat.icon;
  return (
    <div onClick={onToggle} style={{
      minHeight: 84, background: selected ? (aiMode ? C.aiBg : "#F8FBFF") : "#FFFFFF",
      border: `1px solid ${selected ? (aiMode ? C.aiBorder : C.blue) : C.border}`,
      borderRadius: 8, padding: 14, cursor: "pointer",
      display: "grid", gridTemplateColumns: "34px 1fr 18px", gap: 12, alignItems: "flex-start",
      transition: "border-color 140ms ease, background-color 140ms ease",
    }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!selected) { el.style.borderColor = "#CBD5E1"; el.style.background = "#FAFBFC"; } }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; if (!selected) { el.style.borderColor = C.border; el.style.background = "#FFFFFF"; } }}
    >
      <div style={{ width: 34, height: 34, borderRadius: 8, background: aiMode ? "#EBF5FF" : "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} strokeWidth={1.8} style={{ color: C.blue }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.25 }}>{cat.label}</div>
        <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.4, marginTop: 4 }}>{cat.description}</div>
      </div>
      <div style={{
        width: 16, height: 16, borderRadius: aiMode ? 999 : 4, flexShrink: 0, marginTop: 2,
        border: `1.5px solid ${selected ? C.blue : C.border}`,
        background: selected ? C.blue : "#FFFFFF",
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 120ms ease",
      }}>
        {selected && <Check size={10} strokeWidth={3} style={{ color: "#FFFFFF" }} />}
      </div>
    </div>
  );
}

/* ─── Right sidebar panel — slim, flat ──────────────────────────────────── */
function SidePanel({ icon: Icon, title, children }: {
  icon: React.ElementType; title: string; children: React.ReactNode;
}) {
  return (
    <div style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={14} strokeWidth={1.8} style={{ color: C.blue }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function CheckItem({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
      <CircleCheck size={14} strokeWidth={1.8} style={{ color: C.success, flexShrink: 0, marginTop: 1 }} />
      <span style={{ fontSize: 12, color: C.sub, lineHeight: 1.45 }}>{text}</span>
    </div>
  );
}

/* ─── Section heading ────────────────────────────────────────────────────── */
function SectionHeading({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 32, marginTop: 24, marginBottom: 12 }}>
      {Icon && <Icon size={14} strokeWidth={1.8} style={{ color: C.muted }} />}
      <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase" as const, letterSpacing: "0.04em", color: C.muted }}>{label}</span>
    </div>
  );
}

/* ─── DropZone ────────────────────────────────────────────────────────────── */
function DropZone({ label, icon: Icon, file, onFile, onClear, description }: {
  label: string; icon: React.ElementType; file: File | null;
  onFile: (f: File) => void; onClear: () => void; description: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) onFile(f);
  }, [onFile]);

  return (
    <div style={{
      border: `1.5px dashed ${dragging ? C.blue : file ? C.success : C.border}`,
      borderRadius: 12, padding: 18, cursor: file ? "default" : "pointer",
      background: dragging ? "#F0F6FF" : file ? "#F0FDF4" : "#FAFBFC",
      transition: "border-color 140ms ease, background-color 140ms ease",
    }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && ref.current?.click()}
      onMouseEnter={e => { if (!file && !dragging) (e.currentTarget as HTMLElement).style.borderColor = `rgba(37,99,235,0.4)`; }}
      onMouseLeave={e => { if (!file && !dragging) (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
    >
      <input ref={ref} type="file" accept=".csv,.tsv,.xlsx,.xls,.json,.txt,.docx,.pdf" style={{ display: "none" }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: file ? "#DCFCE7" : "#F3F6FB" }}>
          {file ? <CircleCheck size={20} strokeWidth={1.8} style={{ color: C.success }} /> : <Icon size={20} strokeWidth={1.8} style={{ color: C.blue }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 2 }}>{label}</div>
          <div style={{ fontSize: 13, color: C.sub }}>{description}</div>
          {file ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <span style={{ fontSize: 13, color: C.success, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
              <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>({(file.size / 1024).toFixed(1)} KB)</span>
              <button onClick={e => { e.stopPropagation(); onClear(); }} style={{ marginLeft: "auto", color: C.muted, background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0, transition: "color 140ms ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = C.error; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.muted; }}>
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>Drop CSV, XLSX, PDF, DOCX, JSON or TXT here, or <span style={{ color: C.blue, fontWeight: 600 }}>browse files</span></p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Preview table ──────────────────────────────────────────────────────── */
function PreviewTable({ title, icon: Icon, data }: {
  title: string; icon: React.ElementType;
  data: { rows: PreviewRow[]; total: number; error?: string } | undefined;
}) {
  const [expanded, setExpanded] = useState(true);
  if (!data) return null;
  const validRows = data.rows.filter(r => !r._errors?.length);
  const errorRows = data.rows.filter(r => r._errors?.length);
  if (data.error) return (
    <div style={{ border: `1px solid rgba(220,38,38,0.25)`, borderRadius: 12, padding: 14, background: "#FEF2F2" }}>
      <div style={{ display: "flex", gap: 8, color: C.error, fontSize: 13, fontWeight: 600 }}>
        <AlertCircle size={16} strokeWidth={1.8} /> {title}: {data.error}
      </div>
    </div>
  );
  const displayKeys = data.rows[0] ? Object.keys(data.rows[0]).filter(k => k !== "_errors" && k !== "_aiCorrected").slice(0, 5) : [];
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
      <button style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "#FAFBFC", border: "none", cursor: "pointer" }}
        onClick={() => setExpanded(e => !e)}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={15} strokeWidth={1.8} style={{ color: C.blue }} />
        </div>
        <div style={{ flex: 1, textAlign: "left" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</span>
          <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>{data.total} rows</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.success, background: "#ECFDF5", padding: "2px 8px", borderRadius: 99 }}>{validRows.length} ready</span>
        {errorRows.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.warn, background: "#FFFBEB", padding: "2px 8px", borderRadius: 99, marginLeft: 4 }}>{errorRows.length} issues</span>}
        {expanded ? <ChevronUp size={14} strokeWidth={1.8} style={{ color: C.muted }} /> : <ChevronDown size={14} strokeWidth={1.8} style={{ color: C.muted }} />}
      </button>
      {expanded && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}`, background: "#FAFBFC" }}>
                <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: C.sub, width: 28 }}>#</th>
                {displayKeys.map(k => <th key={k} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: C.sub }}>{k.replace(/_/g, " ")}</th>)}
                <th style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: C.sub }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 20).map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${C.sep}`, background: row._errors?.length ? "#FFFBEB" : i % 2 === 0 ? "#FFFFFF" : "#FAFBFC" }}>
                  <td style={{ padding: "6px 12px", color: C.muted }}>{i + 1}</td>
                  {displayKeys.map(k => <td key={k} style={{ padding: "6px 12px", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text }} title={String(row[k] ?? "")}>{row[k] || <span style={{ color: C.border, fontStyle: "italic" }}>—</span>}</td>)}
                  <td style={{ padding: "6px 12px" }}>
                    {row._errors?.length
                      ? <span style={{ display: "flex", alignItems: "center", gap: 4, color: C.warn, fontSize: 11 }}><AlertTriangle size={11} strokeWidth={1.8} />{row._errors[0]}</span>
                      : <CircleCheck size={13} strokeWidth={1.8} style={{ color: C.success }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 20 && <div style={{ padding: "7px 16px", fontSize: 12, color: C.muted, borderTop: `1px solid ${C.sep}`, background: "#FAFBFC" }}>Showing first 20 of {data.rows.length} rows</div>}
        </div>
      )}
    </div>
  );
}

/* ─── Confidence badge ────────────────────────────────────────────────────── */
function ConfidenceBadge({ confidence, source }: { confidence: number; source: string }) {
  if (source === "exact") return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#ECFDF5", color: C.success, border: `1px solid rgba(22,163,74,0.18)` }}>Exact</span>;
  if (source === "ai")   return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#EFF6FF", color: C.blue, border: `1px solid rgba(37,99,235,0.18)` }}>AI · {Math.round(confidence * 100)}%</span>;
  if (confidence >= 0.90) return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#ECFDF5", color: C.success, border: `1px solid rgba(22,163,74,0.18)` }}>{Math.round(confidence * 100)}%</span>;
  if (confidence >= 0.70) return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#FFFBEB", color: C.warn, border: `1px solid rgba(217,119,6,0.18)` }}>{Math.round(confidence * 100)}%</span>;
  return null;
}

/* ─── Auth helpers ────────────────────────────────────────────────────────── */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("pf_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function mapFetchError(err: unknown, status?: number): string {
  if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) return "Network connection failed. Check your connection and try again.";
  if (status === 401) return "Import request could not authenticate. Please refresh the page and try again.";
  if (status === 403) return "Permission denied. You don't have access to import data.";
  if (status === 404) return "Import route not found. Please contact support.";
  if (status === 413) return "File is too large. Maximum size is 50 MB.";
  if (status === 415) return "Unsupported file type. Supported formats: CSV, TSV, XLSX, JSON, TXT, DOCX, PDF.";
  if (status === 422) return "Could not read the file. Make sure it contains valid CSV or XLSX data.";
  if (status === 500) return "Server upload error. Please try again.";
  if (err instanceof Error) return err.message;
  return "An unknown error occurred. Please try again.";
}

/* ─── CSV import templates ─────────────────────────────────────────────────── */
const IMPORT_TEMPLATES: Record<string, { headers: string[]; sample: string[] }> = {
  participants: {
    headers: ["First Name", "Last Name", "Date of Birth", "Gender", "NDIS Number", "Plan Start Date", "Plan End Date", "Funding Type", "Email", "Phone", "Address", "Suburb", "State", "Postcode", "Status"],
    sample:  ["Jane", "Smith", "1990-05-15", "Female", "430123456789", "2024-07-01", "2025-06-30", "Plan Managed", "jane.smith@email.com", "0400 000 001", "12 Main St", "Melbourne", "VIC", "3000", "active"],
  },
  staff: {
    headers: ["First Name", "Last Name", "Email", "Phone", "Position", "Employment Type", "Start Date", "Hourly Rate ($)", "Status"],
    sample:  ["Alex", "Brown", "alex.brown@org.com.au", "0400 000 002", "Support Worker", "casual", "2023-01-15", "35.50", "active"],
  },
  shifts: {
    headers: ["Date", "Participant Name", "Staff Name", "Service Type", "Start Time", "End Time", "Status", "Notes"],
    sample:  ["2024-08-01", "Jane Smith", "Alex Brown", "Daily Activities", "09:00", "12:00", "completed", "Assisted with morning routine"],
  },
  contacts: {
    headers: ["Participant Name", "Contact Name", "Relationship", "Phone", "Email", "Is Primary Contact"],
    sample:  ["Jane Smith", "Michael Smith", "Father", "0400 000 003", "michael@email.com", "Yes"],
  },
  agreements: {
    headers: ["Participant Name", "Agreement Number", "Agreement Start Date", "Agreement End Date", "Total Budget ($)", "Status"],
    sample:  ["Jane Smith", "SA-2024-001", "2024-07-01", "2025-06-30", "48000.00", "active"],
  },
  casenotes: {
    headers: ["Participant Name", "Staff Name", "Note Date", "Note Type", "Content", "Goal Reference", "Follow-Up Required", "Follow-Up Date"],
    sample:  ["Jane Smith", "Alex Brown", "2024-08-01", "Progress Note", "Participant engaged well in daily activities today.", "Goal 1: Community participation", "No", ""],
  },
  incidents: {
    headers: ["Participant Name", "Incident Date", "Incident Type", "Severity", "Location", "Description", "Actions Taken", "Reportable to NDIS"],
    sample:  ["Jane Smith", "2024-08-05", "Falls", "Low", "Home", "Participant tripped on rug, no injury sustained.", "Rug removed, family notified.", "No"],
  },
  documents: {
    headers: ["Participant Name", "Document Type", "Title", "File Name", "Expiry Date", "Notes"],
    sample:  ["Jane Smith", "NDIS Plan", "2024-2025 NDIS Plan", "ndis-plan-2024.pdf", "2025-06-30", "Reviewed and filed"],
  },
  medication: {
    headers: ["Participant Name", "Medication Name", "Dosage", "Frequency", "Route / Method", "Prescriber", "Start Date", "End Date", "Notes"],
    sample:  ["Jane Smith", "Metformin", "500mg", "Twice daily", "Oral", "Dr. Lee", "2024-01-01", "", "Take with food"],
  },
  careplans: {
    headers: ["Participant Name", "Goal Description", "Goal Category", "Support Needed", "Responsible Person", "Review Date", "Progress", "Status", "Notes"],
    sample:  ["Jane Smith", "Increase independent living skills for morning routine", "Daily Living", "Prompting and supervision for personal care tasks", "Alex Brown", "2025-01-01", "On track", "active", ""],
  },
  timesheets: {
    headers: ["Staff Name", "Week Starting", "Work Date", "Participant Name", "Actual Hours", "Scheduled Hours", "Break (minutes)", "Approval Status", "Notes"],
    sample:  ["Alex Brown", "2024-07-29", "2024-07-31", "Jane Smith", "3.00", "3.00", "30", "approved", ""],
  },
  invoices: {
    headers: ["Invoice Number", "Participant Name", "Period Start", "Period End", "Total Amount ($)", "GST Amount ($)", "Invoice Status", "Paid Date"],
    sample:  ["INV-2024-001", "Jane Smith", "2024-07-01", "2024-07-31", "1050.00", "95.45", "paid", "2024-08-15"],
  },
  quotes: {
    headers: ["Quote Number", "Quote Title", "Participant Name", "Total Amount ($)", "Valid Until", "Status", "Notes"],
    sample:  ["QUO-2024-001", "Support Services July", "Jane Smith", "4800.00", "2024-08-01", "accepted", ""],
  },
  tasks: {
    headers: ["Task Title", "Task Description", "Assigned To", "Participant Name", "Due Date", "Priority", "Status", "Task Category"],
    sample:  ["Review NDIS plan", "Review and update plan goals for next review", "Alex Brown", "Jane Smith", "2024-09-01", "High", "pending", "Care Coordination"],
  },
  forms: {
    headers: ["Form Title", "Category", "Description"],
    sample:  ["Daily Progress Template", "Progress Notes", "Standard daily progress note template"],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function Migration() {
  const [step, setStep]               = useState<Step>(1);
  const [selected, setSelected]       = useState<string[]>([]);
  const [isAutoDetect, setIsAutoDetect] = useState(false);
  const [files, setFiles]             = useState<{ participants: File | null; staff: File | null; shifts: File | null }>({ participants: null, staff: null, shifts: null });
  const [singleFile, setSingleFile]   = useState<File | null>(null);
  const [detect, setDetect]           = useState<DetectResult | null>(null);
  const [detecting, setDetecting]     = useState(false);
  const [userMappings, setUserMappings] = useState<Record<string, string | null>>({});
  const [resolvedImportType, setResolvedImportType] = useState<string | null>(null);
  const [preview, setPreview]         = useState<PreviewData | null>(null);
  const [parsing, setParsing]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any | null>(null);

  const isCoreMulti    = !isAutoDetect && selected.filter(id => ["participants","staff","shifts"].includes(id)).length > 1;
  const isSingleMode   = isAutoDetect || selected.length === 1 || (selected.length > 0 && !isCoreMulti);
  const activeFile     = isSingleMode ? singleFile : (files.participants || files.staff || files.shifts);
  const hasAnyFile     = isSingleMode ? !!singleFile : !!(files.participants || files.staff || files.shifts);
  const canContinue1   = isAutoDetect || selected.length > 0;
  const singleTypeHint = isSingleMode && !isAutoDetect ? selected[0] : undefined;
  const isPreviewOnly  = !!singleTypeHint && PREVIEW_ONLY_TYPES.includes(singleTypeHint);

  const toggleType = (id: string) => {
    setIsAutoDetect(false);
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const selectAutoDetect = () => { setIsAutoDetect(true); setSelected([]); };

  const handleDownloadTemplates = useCallback(() => {
    const csvLine = (row: string[]) => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    const targetTypes = isAutoDetect || selected.length === 0 ? Object.keys(IMPORT_TEMPLATES) : selected.filter(id => IMPORT_TEMPLATES[id]);
    if (targetTypes.length === 1) {
      const id = targetTypes[0]; const tpl = IMPORT_TEMPLATES[id]; if (!tpl) return;
      const csv = [csvLine(tpl.headers), csvLine(tpl.sample)].join("\n");
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([csv], { type: "text/csv" })), download: `providerflo-template-${id}.csv` });
      a.click(); URL.revokeObjectURL(a.href);
    } else {
      const sections: string[] = [];
      for (const id of targetTypes) {
        const tpl = IMPORT_TEMPLATES[id]; if (!tpl) continue;
        sections.push(`"=== ${getTypeLabel(id).toUpperCase()} ==="`, csvLine(tpl.headers), csvLine(tpl.sample), "");
      }
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([sections.join("\n")], { type: "text/csv" })), download: "providerflo-import-templates.csv" });
      a.click(); URL.revokeObjectURL(a.href);
    }
  }, [isAutoDetect, selected]);

  const runDetect = async (file: File, hint?: string) => {
    const content = await fileToBase64(file);
    const res = await fetch("/api/migration/detect", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ filename: file.name, content, hint }) });
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw Object.assign(new Error(body.error || "Detect failed"), { status: res.status }); }
    const data: DetectResult = await res.json();
    setDetect(data);
    const initial: Record<string, string | null> = {};
    for (const [header, mapping] of Object.entries(data.mappings)) initial[header] = mapping.field;
    setUserMappings(initial);
    setResolvedImportType(hint ?? (data.detectedType !== "unknown" ? data.detectedType : null));
    return data;
  };

  const handleDetect = async () => {
    if (!hasAnyFile) return;
    setDetecting(true); setError(null);
    try { await runDetect(isSingleMode ? singleFile! : (files.participants || files.staff || files.shifts)!, singleTypeHint); setStep(3); }
    catch (e: any) { setError(mapFetchError(e, e.status)); }
    finally { setDetecting(false); }
  };

  const handleRerunAI = async () => {
    if (!hasAnyFile) return;
    setDetecting(true); setError(null);
    try { await runDetect(isSingleMode ? singleFile! : (files.participants || files.staff || files.shifts)!, singleTypeHint); }
    catch (e: any) { setError(mapFetchError(e, e.status)); }
    finally { setDetecting(false); }
  };

  const handlePreview = async () => {
    if (!hasAnyFile) return;
    setParsing(true); setError(null);
    try {
      let previewBody: Record<string, unknown>;
      if (isSingleMode) {
        const importType = resolvedImportType ?? singleTypeHint ?? "unknown";
        previewBody = { importType, filename: singleFile!.name, content: await fileToBase64(singleFile!), mappings: JSON.stringify(userMappings) };
      } else {
        previewBody = { mappings: JSON.stringify(userMappings) };
        if (files.participants) previewBody.participants = { filename: files.participants.name, content: await fileToBase64(files.participants) };
        if (files.staff)        previewBody.staff        = { filename: files.staff.name,        content: await fileToBase64(files.staff) };
        if (files.shifts)       previewBody.shifts       = { filename: files.shifts.name,       content: await fileToBase64(files.shifts) };
      }
      const res = await fetch("/api/migration/preview", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(previewBody) });
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw Object.assign(new Error(body.error || "Preview failed"), { status: res.status }); }
      setPreview(await res.json()); setStep(4);
    } catch (e: any) { setError(mapFetchError(e, e.status)); }
    finally { setParsing(false); }
  };

  const handleImport = async () => {
    if (!preview) return;
    setStep(6); setError(null);
    try {
      let body: any;
      if (isSingleMode) {
        const importType = resolvedImportType ?? singleTypeHint ?? "unknown";
        body = { importType, rows: preview[importType]?.rows ?? [] };
      } else {
        body = {};
        if (preview.participants?.rows) body.participants = preview.participants.rows;
        if (preview.staff?.rows)        body.staff        = preview.staff.rows;
        if (preview.shifts?.rows)       body.shifts       = preview.shifts.rows;
      }
      const res = await fetch("/api/migration/import", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw Object.assign(new Error(b.error || "Import failed"), { status: res.status }); }
      setImportResult(await res.json());
    } catch (e: any) { setError(mapFetchError(e, e.status)); setStep(5); }
  };

  const totalReady  = preview ? Object.values(preview).reduce((acc, v) => acc + (v ? v.rows.filter(r => !r._errors?.length).length : 0), 0) : 0;
  const totalIssues = preview ? Object.values(preview).reduce((acc, v) => acc + (v ? v.rows.filter(r =>  r._errors?.length).length : 0), 0) : 0;

  const reset = () => {
    setStep(1); setSelected([]); setIsAutoDetect(false);
    setFiles({ participants: null, staff: null, shifts: null }); setSingleFile(null);
    setPreview(null); setImportResult(null); setError(null); setDetect(null);
    setUserMappings({}); setResolvedImportType(null);
  };

  /* ── Right sidebar ── */
  const Sidebar = () => (
    <div className="min-w-0">
      <SidePanel icon={ShieldCheck} title="Security & Compliance">
        <CheckItem text="Your data is secure and never used to train AI models" />
        <CheckItem text="Only headers and sample rows are analysed by AI" />
        <CheckItem text="Data stays within your organisation" />
        <CheckItem text="Fully encrypted in transit and at rest" />
        <CheckItem text="100% NDIS compliant and audit logged" />
      </SidePanel>
      <SidePanel icon={Bot} title="Import process overview">
        {STEPS.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "7px 0", borderBottom: i < STEPS.length - 1 ? `1px solid ${C.sep}` : "none" }}>
            <div style={{ width: 22, height: 22, borderRadius: 999, background: C.navy, color: "#FFFFFF", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.label}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>{s.sub}</div>
            </div>
          </div>
        ))}
      </SidePanel>
      <SidePanel icon={Headphones} title="Need help?">
        <p style={{ fontSize: 12, color: C.sub, marginBottom: 12, lineHeight: 1.5 }}>Visit our Help Centre or contact support for assistance with importing your data.</p>
        <button style={{ height: 34, padding: "0 12px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#FFFFFF", fontSize: 12, fontWeight: 600, color: C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, transition: "background-color 140ms ease", fontFamily: FF }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}>
          Go to Help Centre <ArrowRight size={12} strokeWidth={2} />
        </button>
      </SidePanel>
    </div>
  );

  /* ── Shared error alert ── */
  const ErrorAlert = ({ msg }: { msg: string }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.error, background: "#FEF2F2", border: `1px solid rgba(220,38,38,0.2)`, borderRadius: 10, padding: "11px 14px" }}>
      <AlertCircle size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />{msg}
    </div>
  );

  /* ── Shared back button ── */
  const BackBtn = ({ to, label }: { to: Step; label?: string }) => (
    <button onClick={() => { setStep(to); setError(null); }} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: C.sub, background: "none", border: "none", cursor: "pointer", fontFamily: FF }}>
      <ArrowLeft size={14} strokeWidth={1.8} /> {label ?? "Back"}
    </button>
  );

  /* ── Shared panel wrapper ── */
  const Panel = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div style={{ background: "#FFFFFF", border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, boxShadow: "0 1px 2px rgba(16,24,40,0.04)", ...style }}>
      {children}
    </div>
  );

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
     ───────────────────────────────────────────────────────────────────────── */
  return (
    <AppLayout>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 40px", background: "#FFFFFF", minHeight: "100%", fontFamily: FF }}>

        {/* Title area */}
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.01em", lineHeight: "28px", margin: 0 }}>Import</h1>
        <p style={{ fontSize: 14, color: C.sub, marginTop: 4, marginBottom: 20, lineHeight: 1.55 }}>Import your existing provider data with AI-powered mapping and validation.</p>

        <Stepper current={step} />

        {/* ══ STEP 1: Choose Data Type ══════════════════════════════════════ */}
        {step === 1 && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

              {/* Info banner */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, background: "#F0F7FF", border: `1px solid #BFDBFE`, marginBottom: 20 }}>
                <Info size={14} strokeWidth={1.8} style={{ color: C.blue, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.45, flex: 1 }}>We support CSV, TSV, XLSX, JSON, TXT, DOCX and PDF files up to 50MB. Our AI will help map your columns, even if headers don't match our system.</span>
                <button style={{ fontSize: 12, fontWeight: 600, color: C.blue, background: "none", border: "none", cursor: "pointer", flexShrink: 0, fontFamily: FF, whiteSpace: "nowrap" as const }}>View import guides →</button>
              </div>

              {/* Choose heading */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Choose what you want to import</div>
                <div style={{ fontSize: 13, color: C.sub }}>Select one or more data types — or let AI auto-detect from your file.</div>
              </div>

              {/* AI Auto-Detect row */}
              <div onClick={selectAutoDetect}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  background: isAutoDetect ? C.aiBg : "#FAFBFC",
                  border: `1px solid ${isAutoDetect ? C.aiBorder : C.border}`,
                  borderRadius: 8, padding: "14px 16px", cursor: "pointer", marginBottom: 20,
                  transition: "border-color 140ms ease, background-color 140ms ease",
                }}
                onMouseEnter={e => { if (!isAutoDetect) (e.currentTarget as HTMLElement).style.background = "#F0F6FF"; }}
                onMouseLeave={e => { if (!isAutoDetect) (e.currentTarget as HTMLElement).style.background = "#FAFBFC"; }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: "#EBF5FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Star size={16} strokeWidth={1.8} style={{ color: C.aiStar }} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>AI Auto-Detect</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#EFF6FF", color: C.blue }}>Recommended</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.sub }}>Upload any file and let AI automatically detect the data type and map all fields.</div>
                  </div>
                </div>
                <div style={{ width: 16, height: 16, borderRadius: 999, border: `1.5px solid ${isAutoDetect ? C.blue : C.border}`, background: isAutoDetect ? C.blue : "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 120ms ease" }}>
                  {isAutoDetect && <Check size={10} strokeWidth={3} style={{ color: "#FFFFFF" }} />}
                </div>
              </div>

              {/* Core Data */}
              <SectionHeading label="Core Data" icon={Users} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12, marginBottom: 0 }}>
                {CORE.map(cat => <CategoryCard key={cat.id} cat={cat} selected={selected.includes(cat.id)} onToggle={() => toggleType(cat.id)} />)}
              </div>

              {/* Care & Compliance */}
              <SectionHeading label="Care & Compliance" icon={ShieldCheck} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                {CARE.map(cat => <CategoryCard key={cat.id} cat={cat} selected={selected.includes(cat.id)} onToggle={() => toggleType(cat.id)} />)}
              </div>

              {/* Operations */}
              <SectionHeading label="Operations" icon={Receipt} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 12 }}>
                {OPS.map(cat => <CategoryCard key={cat.id} cat={cat} selected={selected.includes(cat.id)} onToggle={() => toggleType(cat.id)} />)}
              </div>

              {/* Sticky action bar */}
              <div style={{ position: "sticky", bottom: 0, marginTop: 24, paddingTop: 14, borderTop: `1px solid ${C.border}`, background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <button onClick={handleDownloadTemplates}
                  style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 6, border: `1px solid ${C.border}`, background: "#FFFFFF", fontSize: 13, fontWeight: 600, color: C.sub, cursor: "pointer", fontFamily: FF, transition: "background-color 140ms ease" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}>
                  <Download size={13} /> Download templates
                </button>
                <PrimaryBtn onClick={() => setStep(2)} disabled={!canContinue1}>
                  Continue to Upload <ArrowRight size={14} strokeWidth={2} />
                </PrimaryBtn>
              </div>
            </div>
            <Sidebar />
          </div>
        )}

        {/* ══ STEP 2: Upload Files ══════════════════════════════════════════ */}
        {step === 2 && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Panel>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>Upload Files</div>
                <p style={{ fontSize: 13, color: C.sub, marginBottom: 20, lineHeight: 1.5 }}>
                  We support CSV, TSV, XLSX, JSON, TXT, DOCX and PDF files up to 50MB. Our AI will help map your columns, even if headers don't match our system.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {isSingleMode ? (
                    <DropZone
                      label={isAutoDetect ? "Upload your data file" : `Upload ${getTypeLabel(singleTypeHint ?? "")} data`}
                      icon={isAutoDetect ? Wand2 : (getTypeIcon(singleTypeHint ?? ""))}
                      file={singleFile}
                      onFile={f => setSingleFile(f)}
                      onClear={() => setSingleFile(null)}
                      description={isAutoDetect ? "AI will auto-detect the data type from your file" : `Upload a .csv or .xlsx file containing your ${getTypeLabel(singleTypeHint ?? "")} data`}
                    />
                  ) : (
                    <>
                      {selected.includes("participants") && <DropZone label="Participants / Clients" icon={Users} file={files.participants} onFile={f => setFiles(prev => ({ ...prev, participants: f }))} onClear={() => setFiles(prev => ({ ...prev, participants: null }))} description="Import client profiles, NDIS details, plan dates and contacts." />}
                      {selected.includes("staff") && <DropZone label="Support Workers / Staff" icon={User} file={files.staff} onFile={f => setFiles(prev => ({ ...prev, staff: f }))} onClear={() => setFiles(prev => ({ ...prev, staff: null }))} description="Import worker profiles, roles, employment details and pay rates." />}
                      {selected.includes("shifts") && <DropZone label="Shifts / Appointments" icon={CalendarDays} file={files.shifts} onFile={f => setFiles(prev => ({ ...prev, shifts: f }))} onClear={() => setFiles(prev => ({ ...prev, shifts: null }))} description="Import shifts, times, participants, workers and services." />}
                    </>
                  )}
                </div>

                {error && <div style={{ marginTop: 14 }}><ErrorAlert msg={error} /></div>}
              </Panel>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <BackBtn to={1} />
                <PrimaryBtn onClick={handleDetect} disabled={!hasAnyFile || detecting}>
                  {detecting ? <><Loader2 size={14} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} /> Analysing…</> : <>Analyse File <ArrowRight size={14} strokeWidth={2} /></>}
                </PrimaryBtn>
              </div>
            </div>
            <Sidebar />
          </div>
        )}

        {/* ══ STEP 3: AI Mapping ═══════════════════════════════════════════ */}
        {step === 3 && detect && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {detect.detectedType && detect.detectedType !== "unknown" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderRadius: 10, background: C.aiBg, border: `1px solid ${C.aiBorder}` }}>
                  <Star size={14} strokeWidth={1.8} style={{ color: C.aiStar, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: C.blue }}>
                    AI detected: <strong>{getTypeLabel(detect.detectedType)}</strong>
                    {detect.detectedTypeConfidence > 0 && ` (${Math.round(detect.detectedTypeConfidence * 100)}% confidence)`}
                    {detect.detectedTypeReason && <span style={{ color: C.sub }}> — {detect.detectedTypeReason}</span>}
                  </span>
                </div>
              )}

              {detect.anomalies.length > 0 && (
                <Panel style={{ padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                    <AlertTriangle size={14} strokeWidth={1.8} style={{ color: C.warn }} /> Data Quality Notices
                  </div>
                  {detect.anomalies.map((a, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 7, padding: "7px 10px", borderRadius: 8, background: a.type === "error" ? "#FEF2F2" : "#FFFBEB", border: `1px solid ${a.type === "error" ? "rgba(220,38,38,0.15)" : "rgba(217,119,6,0.15)"}` }}>
                      {a.type === "error" ? <X size={13} strokeWidth={2} style={{ color: C.error, flexShrink: 0, marginTop: 1 }} /> : <Info size={13} strokeWidth={1.8} style={{ color: C.warn, flexShrink: 0, marginTop: 1 }} />}
                      <span style={{ fontSize: 12, color: a.type === "error" ? C.error : "#92400E", lineHeight: 1.4 }}>{a.message}</span>
                    </div>
                  ))}
                </Panel>
              )}

              <Panel>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Sparkles size={16} strokeWidth={1.8} style={{ color: C.blue }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>AI Column Mapping</div>
                    {detect.aiUsed && (
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "#EFF6FF", color: C.blue, border: `1px solid rgba(37,99,235,0.18)` }}>AI used</span>
                    )}
                  </div>
                  <button onClick={handleRerunAI} disabled={detecting}
                    style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", borderRadius: 9, border: `1px solid ${C.border}`, background: "#FFFFFF", fontSize: 12, fontWeight: 600, color: C.text, cursor: detecting ? "not-allowed" : "pointer", opacity: detecting ? 0.6 : 1, flexShrink: 0, transition: "background-color 140ms ease", fontFamily: FF }}
                    onMouseEnter={e => { if (!detecting) (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}>
                    {detecting ? <><Loader2 size={12} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} /> Re-running…</> : <><Sparkles size={12} strokeWidth={2} /> Re-run AI</>}
                  </button>
                </div>

                <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>
                  <strong style={{ color: C.text }}>{detect.totalRows}</strong> rows · <strong style={{ color: C.text }}>{detect.originalHeaders.length}</strong> columns detected. {" "}
                  <span style={{ color: C.success, fontWeight: 600 }}>{Object.values(userMappings).filter(Boolean).length} of {detect.originalHeaders.length} mapped.</span>
                </p>

                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", background: "#FAFBFC", borderBottom: `1px solid ${C.border}`, padding: "8px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Your Column</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Maps To Field</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>Confidence</span>
                  </div>
                  {detect.originalHeaders.map((h, i) => {
                    const mapping      = detect.mappings[h];
                    const currentField = userMappings[h] ?? null;
                    const isEdited     = currentField !== mapping?.field;
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", padding: "8px 14px", borderBottom: i < detect.originalHeaders.length - 1 ? `1px solid ${C.sep}` : "none", background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC", alignItems: "center", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={h}>{h}</span>
                          {isEdited && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 99, background: "#FFFBEB", color: C.warn, border: `1px solid rgba(217,119,6,0.2)`, flexShrink: 0 }}>edited</span>}
                        </div>
                        <div>
                          <select value={currentField ?? ""} onChange={e => setUserMappings(prev => ({ ...prev, [h]: e.target.value || null }))}
                            style={{ width: "100%", height: 30, borderRadius: 8, border: `1px solid ${C.border}`, background: currentField ? "#FFFFFF" : "#FAFBFC", fontSize: 12, fontWeight: currentField ? 600 : 400, color: currentField ? C.text : C.muted, padding: "0 8px", outline: "none", cursor: "pointer", fontFamily: FF }}>
                            <option value="">— Ignore this column —</option>
                            {SYSTEM_FIELDS.map(sf => <option key={sf.value} value={sf.value}>{sf.label}</option>)}
                          </select>
                        </div>
                        <div>
                          {currentField && mapping && <ConfidenceBadge confidence={mapping.confidence} source={mapping.source} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {detect.sample.length > 0 && (
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "8px 14px", background: "#FAFBFC", borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      Sample Data — first {Math.min(detect.sample.length, 5)} rows
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            {detect.originalHeaders.slice(0, 6).map(h => <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontWeight: 600, color: C.sub, whiteSpace: "nowrap" }}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {detect.sample.slice(0, 5).map((row, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.sep}`, background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC" }}>
                              {detect.originalHeaders.slice(0, 6).map(h => <td key={h} style={{ padding: "6px 12px", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text }}>{row[h] || <span style={{ color: C.border }}>—</span>}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </Panel>

              {error && <ErrorAlert msg={error} />}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <BackBtn to={2} />
                <PrimaryBtn onClick={handlePreview} disabled={parsing}>
                  {parsing ? <><Loader2 size={14} strokeWidth={2} style={{ animation: "spin 1s linear infinite" }} /> Parsing…</> : <>Preview Import <ArrowRight size={14} strokeWidth={2} /></>}
                </PrimaryBtn>
              </div>
            </div>
            <Sidebar />
          </div>
        )}

        {/* ══ STEP 4: Preview & Validate ═══════════════════════════════════ */}
        {step === 4 && preview && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Panel>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>Data Preview</div>
                <p style={{ fontSize: 13, color: C.sub, marginBottom: 16, lineHeight: 1.5 }}>
                  Review your data before importing. Rows with issues will be skipped.{" "}
                  <strong style={{ color: C.success }}>{totalReady} rows ready</strong>
                  {totalIssues > 0 && <>, <strong style={{ color: C.warn }}>{totalIssues} with issues</strong></>}.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {Object.entries(preview).map(([typeKey, data]) => {
                    if (!data) return null;
                    const Icon = getTypeIcon(typeKey);
                    return <PreviewTable key={typeKey} title={getTypeLabel(typeKey)} icon={Icon} data={data} />;
                  })}
                </div>
              </Panel>

              {isPreviewOnly && (
                <div style={{ background: "#FFFBEB", border: `1px solid rgba(217,119,6,0.3)`, borderRadius: 10, padding: "11px 14px", display: "flex", gap: 10 }}>
                  <Info size={14} strokeWidth={1.8} style={{ color: C.warn, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#92400E", lineHeight: 1.5 }}>This data type is <strong>preview only</strong> — no records will be written to the database. You can review the parsed data but import is not available for this type yet.</span>
                </div>
              )}
              {error && <ErrorAlert msg={error} />}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <BackBtn to={3} label="Back to Mapping" />
                <PrimaryBtn onClick={() => setStep(5)} disabled={totalReady === 0 || isPreviewOnly}>
                  Continue <ArrowRight size={14} strokeWidth={2} />
                </PrimaryBtn>
              </div>
            </div>
            <Sidebar />
          </div>
        )}

        {/* ══ STEP 5: Confirm Import ════════════════════════════════════════ */}
        {step === 5 && preview && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Panel>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 16 }}>Confirm Import</div>

                <div style={{ background: "#FAFBFC", border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
                  {Object.entries(preview).map(([typeKey, data]) => {
                    if (!data) return null;
                    const validCount = data.rows.filter(r => !r._errors?.length).length;
                    const errorCount = data.rows.filter(r =>  r._errors?.length).length;
                    const Icon = getTypeIcon(typeKey);
                    return (
                      <div key={typeKey} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${C.sep}` }}>
                        <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={16} strokeWidth={1.8} style={{ color: C.blue }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{getTypeLabel(typeKey)}</div>
                          <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                            <span style={{ color: C.success, fontWeight: 600 }}>{validCount} records ready</span>
                            {errorCount > 0 && <span style={{ color: C.warn, fontWeight: 600 }}> · {errorCount} will be skipped</span>}
                          </div>
                        </div>
                        <CircleCheck size={18} strokeWidth={1.8} style={{ color: C.success }} />
                      </div>
                    );
                  })}
                </div>

                <div style={{ background: "#EFF6FF", border: `1px solid #BFDBFE`, borderRadius: 10, padding: "11px 14px", display: "flex", gap: 10, marginBottom: 16 }}>
                  <ShieldCheck size={14} strokeWidth={1.8} style={{ color: C.blue, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: "#1E40AF", lineHeight: 1.5 }}>This import will be logged in your audit trail. Existing records (matched by NDIS number, email, or ID) will be skipped — no data will be overwritten.</span>
                </div>

                {error && <div style={{ marginBottom: 14 }}><ErrorAlert msg={error} /></div>}
              </Panel>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <BackBtn to={4} label="Back to Preview" />
                <PrimaryBtn onClick={handleImport}>Confirm Import <ArrowRight size={14} strokeWidth={2} /></PrimaryBtn>
              </div>
            </div>
            <Sidebar />
          </div>
        )}

        {/* ══ STEP 6: Complete ══════════════════════════════════════════════ */}
        {step === 6 && (
          <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
            <Panel style={{ textAlign: "center" as const, padding: 32 }}>
              {!importResult ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <Loader2 size={36} strokeWidth={1.5} style={{ color: C.blue, animation: "spin 1s linear infinite" }} />
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>Importing your data…</div>
                  <div style={{ fontSize: 13, color: C.sub }}>Please don't close this page.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 64, height: 64, borderRadius: 999, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircleCheck size={32} strokeWidth={1.8} style={{ color: C.success }} />
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>Import Complete</div>
                  <div style={{ fontSize: 14, color: C.sub, maxWidth: 380, lineHeight: 1.5 }}>Your data has been imported and your audit trail has been updated.</div>

                  <div style={{ width: "100%", maxWidth: 480, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", marginTop: 8 }}>
                    {importResult.importType ? (
                      <div style={{ padding: "14px 18px" }}>
                        {(() => {
                          const Icon = getTypeIcon(importResult.importType);
                          return (
                            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                              <div style={{ width: 34, height: 34, borderRadius: 9, background: "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <Icon size={16} strokeWidth={1.8} style={{ color: C.blue }} />
                              </div>
                              <div style={{ flex: 1, textAlign: "left" as const }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{getTypeLabel(importResult.importType)}</div>
                                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
                                  <span style={{ color: C.success, fontWeight: 600 }}>{importResult.imported} imported</span>
                                  {importResult.skipped > 0 && <> · <span style={{ color: C.muted }}>{importResult.skipped} skipped</span></>}
                                  {importResult.errors?.length > 0 && <> · <span style={{ color: C.error }}>{importResult.errors.length} errors</span></>}
                                </div>
                                {importResult.errors?.length > 0 && (
                                  <div style={{ marginTop: 8, fontSize: 12, color: C.error, background: "#FEF2F2", borderRadius: 8, padding: "8px 10px", textAlign: "left" as const }}>
                                    {importResult.errors.slice(0, 3).map((e: string, i: number) => <div key={i}>{e}</div>)}
                                    {importResult.errors.length > 3 && <div>…and {importResult.errors.length - 3} more</div>}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      (["participants", "staff", "shifts"] as const).map(typeKey => {
                        const r = importResult[typeKey]; if (!r) return null;
                        const Icon = getTypeIcon(typeKey);
                        return (
                          <div key={typeKey} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: `1px solid ${C.sep}` }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F3F6FB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Icon size={14} strokeWidth={1.8} style={{ color: C.blue }} />
                            </div>
                            <div style={{ flex: 1, textAlign: "left" as const }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{getTypeLabel(typeKey)}</div>
                              <div style={{ fontSize: 12, color: C.sub, marginTop: 1 }}>
                                <span style={{ color: C.success, fontWeight: 600 }}>{r.imported} imported</span>
                                {r.skipped > 0 && <> · <span style={{ color: C.muted }}>{r.skipped} skipped</span></>}
                                {r.errors?.length > 0 && <> · <span style={{ color: C.error }}>{r.errors.length} errors</span></>}
                              </div>
                            </div>
                            <CircleCheck size={16} strokeWidth={1.8} style={{ color: C.success }} />
                          </div>
                        );
                      })
                    )}
                  </div>

                  <button onClick={reset}
                    style={{ height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${C.border}`, background: "#FFFFFF", fontSize: 13, fontWeight: 600, color: C.text, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8, marginTop: 8, transition: "background-color 140ms ease", fontFamily: FF }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#F9FAFB"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}>
                    Import more data
                  </button>
                </div>
              )}
            </Panel>
            <Sidebar />
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </AppLayout>
  );
}
