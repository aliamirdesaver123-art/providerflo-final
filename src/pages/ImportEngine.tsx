import React, { useEffect, useRef, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, Bot, Check,
  CircleCheck, Clock, Download, FileText, Loader2, RefreshCw,
  ShieldCheck, Sparkles, Upload, X, Zap,
} from "lucide-react";
import {
  uploadImportFile, analyseImportJob, validateImportJob, commitImportJob,
  retryFailedRows, getAiRowFixes, getImportJob, listImportJobs,
  getImportErrorCsvUrl, invalidateImportTargets,
} from "@/lib/importApi";

const C = {
  navy:   "#0B1736",
  blue:   "#2563EB",
  blueFg: "#1D4ED8",
  border: "#E6EBF2",
  sep:    "#EEF2F7",
  bg:     "#F6F8FB",
  text:   "#111827",
  sub:    "#6B7280",
  muted:  "#9CA3AF",
  success:"#16A34A",
  warn:   "#D97706",
  error:  "#DC2626",
};
const FF = "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif";

type Stage = "upload" | "analysing" | "mapping" | "validating" | "fixes" | "committing" | "done";

const STAGE_LABELS: Record<Stage, string> = {
  upload:     "Upload",
  analysing:  "Analyse",
  mapping:    "Review Mapping",
  validating: "Validate",
  fixes:      "AI Fixes",
  committing: "Commit",
  done:       "Results",
};
const STAGES: Stage[] = ["upload", "analysing", "mapping", "validating", "fixes", "committing", "done"];

const IMPORT_TYPES = [
  "participants","staff","shifts","contacts","agreements","casenotes",
  "incidents","documents","medication","careplans","timesheets",
  "invoices","quotes","tasks","forms",
];
const TYPE_LABELS: Record<string, string> = {
  participants:"Participants",staff:"Staff",shifts:"Shifts",contacts:"Contacts",
  agreements:"Agreements",casenotes:"Case Notes",incidents:"Incidents",
  documents:"Documents",medication:"Medications",careplans:"Care Plans",
  timesheets:"Timesheets",invoices:"Invoices",quotes:"Quotes",tasks:"Tasks",forms:"Forms",
};

function statusColor(s: string) {
  if (["completed","committed"].includes(s)) return C.success;
  if (["failed","commit_failed"].includes(s)) return C.error;
  if (["completed_with_errors","validated"].includes(s)) return C.warn;
  return C.blue;
}

function statusDot(s: string) {
  return <span style={{ display:"inline-block", width:8, height:8, borderRadius:99, background: statusColor(s), marginRight:6, flexShrink:0 }} />;
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:"#fff", border:`1px solid ${C.border}`, borderRadius:10, padding:20, boxShadow:"0 1px 3px rgba(16,24,40,0.04)", ...style }}>
      {children}
    </div>
  );
}

function Btn({ children, onClick, disabled, variant = "primary" }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; variant?: "primary"|"ghost"|"danger";
}) {
  const base: React.CSSProperties = { height:38, padding:"0 16px", borderRadius:8, fontSize:13, fontWeight:700, display:"inline-flex", alignItems:"center", gap:6, cursor:disabled?"not-allowed":"pointer", transition:"background 140ms", fontFamily:FF, border:"none" };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: disabled ? C.border : C.blue, color: disabled ? C.muted : "#fff" },
    ghost:   { background:"#fff", color:C.sub, border:`1px solid ${C.border}` },
    danger:  { background:"#FEF2F2", color:C.error, border:`1px solid rgba(220,38,38,0.2)` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}
      onMouseEnter={e => { if (!disabled && variant==="primary") (e.currentTarget as HTMLElement).style.background = C.blueFg; }}
      onMouseLeave={e => { if (!disabled && variant==="primary") (e.currentTarget as HTMLElement).style.background = C.blue; }}>
      {children}
    </button>
  );
}

function Stepper({ stage }: { stage: Stage }) {
  const idx = STAGES.indexOf(stage);
  return (
    <div style={{ display:"flex", gap:0, paddingBottom:18, marginBottom:20, borderBottom:`1px solid ${C.border}`, overflowX:"auto" }}>
      {STAGES.map((s, i) => {
        const done = i < idx, active = i === idx;
        return (
          <div key={s} style={{ display:"flex", alignItems:"flex-start", flexShrink:0 }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, minWidth:0 }}>
              <div style={{ width:28, height:28, borderRadius:99, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, background: active ? C.navy : done ? "#E8ECF4" : "#fff", color: active ? "#fff" : done ? C.navy : C.muted, border:`1px solid ${active ? C.navy : done ? "#D1D5DB" : C.border}`, flexShrink:0 }}>
                {done ? <Check size={12} strokeWidth={2.5} style={{ color:C.navy }} /> : i+1}
              </div>
              <span style={{ fontSize:11, fontWeight:600, color: active ? C.text : done ? C.sub : C.muted, textAlign:"center", maxWidth:70, lineHeight:1.2 }}>{STAGE_LABELS[s]}</span>
            </div>
            {i < STAGES.length-1 && (
              <div style={{ height:14, display:"flex", alignItems:"center", margin:"0 3px", paddingTop:7, flexShrink:0 }}>
                <div style={{ width:28, height:1, background: done ? C.navy : C.border }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ pct, color = C.blue }: { pct: number; color?: string }) {
  return (
    <div style={{ height:6, background:"#F0F2F6", borderRadius:99, overflow:"hidden", width:"100%" }}>
      <div style={{ height:"100%", width:`${Math.min(100, Math.max(0, pct))}%`, background:color, borderRadius:99, transition:"width 400ms ease" }} />
    </div>
  );
}

/* ── Job history row ── */
function JobRow({ job, onSelect }: { job: any; onSelect: () => void }) {
  const pct = Number(job.progress_percent ?? 0);
  return (
    <div onClick={onSelect} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, padding:"11px 16px", borderBottom:`1px solid ${C.sep}`, cursor:"pointer", transition:"background 100ms" }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FAFBFC"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
      <div style={{ minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
          {statusDot(job.status)}
          <span style={{ fontSize:13, fontWeight:600, color:C.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{job.original_filename || job.id}</span>
        </div>
        <div style={{ fontSize:11, color:C.muted, display:"flex", gap:8 }}>
          <span>{TYPE_LABELS[job.import_type] ?? job.import_type ?? "auto"}</span>
          <span>·</span>
          <span>{job.total_rows ?? 0} rows</span>
          {job.committed_rows > 0 && <><span>·</span><span style={{ color:C.success }}>{job.committed_rows} committed</span></>}
          {job.failed_rows > 0 && <><span>·</span><span style={{ color:C.error }}>{job.failed_rows} failed</span></>}
        </div>
        {pct > 0 && pct < 100 && <div style={{ marginTop:6 }}><ProgressBar pct={pct} /></div>}
      </div>
      <div style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap", paddingTop:2 }}>
        {job.created_at ? new Date(job.created_at).toLocaleDateString("en-AU", { day:"2-digit", month:"short" }) : ""}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════════ */
export default function ImportEngine() {
  const [tab, setTab]         = useState<"new"|"jobs">("new");
  const [stage, setStage]     = useState<Stage>("upload");
  const [jobId, setJobId]     = useState<string|null>(null);
  const [job, setJob]         = useState<any>(null);
  const [importType, setImportType] = useState<string>("auto");
  const [file, setFile]       = useState<File|null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [fixes, setFixes]     = useState<any[]>([]);
  const [fixesBusy, setFixesBusy] = useState(false);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extractionMode, setExtractionMode] = useState<string|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<number|null>(null);

  /* ── Poll job status ── */
  const pollJob = async (id: string) => {
    try {
      const data = await getImportJob(id);
      const j = data?.job ?? data;
      setJob(j);
      const s: string = j?.status ?? "";
      if (["uploaded"].includes(s) && stage === "analysing") return;
      if (["analysed","mapped"].includes(s)) setStage("mapping");
      if (["validated","ready_to_commit"].includes(s)) setStage("validating");
      if (["committed","completed","completed_with_errors"].includes(s)) { setStage("done"); stopPoll(); invalidateImportTargets(j?.import_type); }
      if (["failed","commit_failed"].includes(s)) { setStage("done"); stopPoll(); }
    } catch { /* silent */ }
  };

  const startPoll = (id: string) => {
    stopPoll();
    pollRef.current = window.setInterval(() => pollJob(id), 2000) as any;
  };
  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  useEffect(() => () => stopPoll(), []);

  /* ── Load recent jobs ── */
  const loadJobs = async () => {
    setJobsLoading(true);
    try { setRecentJobs((await listImportJobs()) ?? []); }
    catch { /* silent */ }
    finally { setJobsLoading(false); }
  };
  useEffect(() => { loadJobs(); }, []);

  const selectJob = (j: any) => {
    setJobId(j.id); setJob(j); setTab("new");
    const s: string = j?.status ?? "";
    if (["analysed","mapped"].includes(s)) setStage("mapping");
    else if (["validated","ready_to_commit"].includes(s)) setStage("validating");
    else if (["committed","completed","completed_with_errors","failed","commit_failed"].includes(s)) setStage("done");
    else setStage("upload");
    startPoll(j.id);
  };

  /* ── Upload ── */
  const handleUpload = async () => {
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const r = await uploadImportFile({ file, importType: importType === "auto" ? null : importType });
      setJobId(r.jobId); setWarnings(r.warnings ?? []); setExtractionMode((r as any).extractionMode ?? null);
      const d = await getImportJob(r.jobId);
      setJob(d?.job ?? d);
      setStage("analysing");
      startPoll(r.jobId);
      await analyseImportJob(r.jobId);
    } catch (e: any) { setError(e?.message ?? "Upload failed."); setBusy(false); return; }
    setBusy(false);
  };

  /* ── Validate ── */
  const handleValidate = async () => {
    if (!jobId || !job) return;
    setBusy(true); setError(null);
    try {
      const detectedType = job.import_type || job.detected_type || importType;
      await validateImportJob(jobId, { importType: detectedType, mappings: {} });
      setStage("validating");
      startPoll(jobId);
    } catch (e: any) { setError(e?.message ?? "Validate failed."); }
    finally { setBusy(false); }
  };

  /* ── AI Fixes ── */
  const handleAiFixes = async () => {
    if (!jobId) return;
    setFixesBusy(true); setError(null);
    try { const r = await getAiRowFixes(jobId); setFixes(r?.fixes ?? []); setStage("fixes"); }
    catch (e: any) { setError(e?.message ?? "AI fixes failed."); }
    finally { setFixesBusy(false); }
  };

  /* ── Commit ── */
  const handleCommit = async () => {
    if (!jobId) return;
    setBusy(true); setError(null);
    try {
      setStage("committing");
      await commitImportJob(jobId);
      startPoll(jobId);
    } catch (e: any) { setError(e?.message ?? "Commit failed."); setStage("validating"); }
    finally { setBusy(false); }
  };

  /* ── Retry failed ── */
  const handleRetry = async () => {
    if (!jobId) return;
    setBusy(true); setError(null);
    try {
      await retryFailedRows(jobId);
      setStage("validating");
      startPoll(jobId);
    } catch (e: any) { setError(e?.message ?? "Retry failed."); }
    finally { setBusy(false); }
  };

  /* ── Reset ── */
  const reset = () => {
    stopPoll(); setStage("upload"); setJobId(null); setJob(null);
    setFile(null); setError(null); setFixes([]); setWarnings([]); setExtractionMode(null);
    setImportType("auto"); loadJobs();
  };

  const jobStatus  = job?.status ?? "";
  const totalRows  = Number(job?.total_rows ?? 0);
  const validRows  = Number(job?.valid_rows ?? 0);
  const failedRows = Number(job?.failed_rows ?? 0);
  const skippedRows = Number(job?.skipped_rows ?? 0);
  const committed  = Number(job?.committed_rows ?? 0);
  const pct        = Number(job?.progress_percent ?? 0);
  const hasErrors  = failedRows > 0;

  return (
    <AppLayout>
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"24px 24px 48px", fontFamily:FF }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>Import Engine</h1>
            <p style={{ fontSize:13, color:C.sub, marginTop:3, marginBottom:0 }}>Upload, validate and commit data with full audit logging and AI row-fix suggestions.</p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => { setTab("new"); }} style={{ height:34, padding:"0 14px", borderRadius:8, border:`1px solid ${tab==="new" ? C.blue : C.border}`, background: tab==="new" ? "#EFF6FF" : "#fff", fontSize:13, fontWeight:600, color: tab==="new" ? C.blue : C.sub, cursor:"pointer", fontFamily:FF, display:"flex", alignItems:"center", gap:6 }}>
              <Upload size={13} /> New Import
            </button>
            <button onClick={() => { setTab("jobs"); loadJobs(); }} style={{ height:34, padding:"0 14px", borderRadius:8, border:`1px solid ${tab==="jobs" ? C.blue : C.border}`, background: tab==="jobs" ? "#EFF6FF" : "#fff", fontSize:13, fontWeight:600, color: tab==="jobs" ? C.blue : C.sub, cursor:"pointer", fontFamily:FF, display:"flex", alignItems:"center", gap:6 }}>
              <Clock size={13} /> Recent Jobs
            </button>
          </div>
        </div>

        {/* ── Recent Jobs tab ── */}
        {tab === "jobs" && (
          <Panel>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <span style={{ fontSize:14, fontWeight:700, color:C.text }}>Recent Import Jobs</span>
              <Btn variant="ghost" onClick={loadJobs}>
                <RefreshCw size={12} /> Refresh
              </Btn>
            </div>
            {jobsLoading
              ? <div style={{ display:"flex", justifyContent:"center", padding:24 }}><Loader2 size={20} style={{ color:C.blue, animation:"spin 1s linear infinite" }} /></div>
              : recentJobs.length === 0
                ? <p style={{ fontSize:13, color:C.muted, textAlign:"center", padding:"24px 0" }}>No import jobs yet. Start a new import above.</p>
                : recentJobs.map(j => <JobRow key={j.id} job={j} onSelect={() => selectJob(j)} />)
            }
          </Panel>
        )}

        {/* ── New Import tab ── */}
        {tab === "new" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            <Stepper stage={stage} />

            {error && (
              <div style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"11px 14px", borderRadius:10, background:"#FEF2F2", border:`1px solid rgba(220,38,38,0.2)`, fontSize:13, color:C.error }}>
                <AlertCircle size={15} strokeWidth={1.8} style={{ flexShrink:0, marginTop:1 }} />
                <span>{error}</span>
                <button onClick={() => setError(null)} style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", color:C.muted, flexShrink:0 }}><X size={13} /></button>
              </div>
            )}

            {/* ── Upload ── */}
            {stage === "upload" && (
              <Panel>
                <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>Upload a file</div>
                <p style={{ fontSize:13, color:C.sub, marginBottom:18, lineHeight:1.5 }}>
                  Supports CSV, TSV, XLSX, JSON, TXT, DOCX and PDF. The engine will auto-detect the data type and suggest field mappings.
                </p>

                {/* Type selector */}
                <div style={{ marginBottom:16 }}>
                  <label style={{ fontSize:12, fontWeight:700, color:C.sub, textTransform:"uppercase", letterSpacing:"0.04em", display:"block", marginBottom:6 }}>Data type</label>
                  <select value={importType} onChange={e => setImportType(e.target.value)} style={{ height:36, borderRadius:8, border:`1px solid ${C.border}`, fontSize:13, color:C.text, padding:"0 10px", outline:"none", fontFamily:FF, background:"#fff" }}>
                    <option value="auto">Auto-detect</option>
                    {IMPORT_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
                  </select>
                </div>

                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
                  onClick={() => !file && fileRef.current?.click()}
                  style={{ border:`1.5px dashed ${dragging ? C.blue : file ? C.success : C.border}`, borderRadius:12, padding:24, textAlign:"center", cursor:file?"default":"pointer", background: dragging ? "#F0F6FF" : file ? "#F0FDF4" : "#FAFBFC", transition:"all 140ms" }}>
                  <input ref={fileRef} type="file" accept=".csv,.tsv,.xlsx,.xls,.json,.txt,.docx,.pdf" style={{ display:"none" }} onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }} />
                  {file ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                      <CircleCheck size={20} style={{ color:C.success }} />
                      <span style={{ fontSize:14, fontWeight:600, color:C.success }}>{file.name}</span>
                      <span style={{ fontSize:12, color:C.muted }}>({(file.size/1024).toFixed(1)} KB)</span>
                      <button onClick={e => { e.stopPropagation(); setFile(null); }} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, display:"flex" }}><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      <FileText size={28} strokeWidth={1.5} style={{ color:C.muted, marginBottom:8 }} />
                      <p style={{ fontSize:13, fontWeight:600, color:C.text, margin:"0 0 4px" }}>Drop your file here</p>
                      <p style={{ fontSize:12, color:C.muted, margin:0 }}>or <span style={{ color:C.blue, fontWeight:600 }}>browse to upload</span> · CSV, XLSX, DOCX, PDF, JSON, TXT</p>
                    </>
                  )}
                </div>

                <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
                  <Btn onClick={handleUpload} disabled={!file || busy}>
                    {busy ? <><Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> Uploading…</> : <>Upload & Analyse <ArrowRight size={13} /></>}
                  </Btn>
                </div>
              </Panel>
            )}

            {/* ── Analysing (polling) ── */}
            {stage === "analysing" && (
              <Panel style={{ textAlign:"center", padding:36 }}>
                <Loader2 size={32} strokeWidth={1.5} style={{ color:C.blue, animation:"spin 1s linear infinite", marginBottom:12 }} />
                <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:6 }}>Analysing your file…</div>
                <div style={{ fontSize:13, color:C.sub }}>AI is detecting the data type and suggesting field mappings.</div>
                {warnings.length > 0 && (
                  <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:6, textAlign:"left" }}>
                    {warnings.map((w, i) => (
                      <div key={i} style={{ display:"flex", gap:8, padding:"8px 12px", borderRadius:8, background:"#FFFBEB", border:`1px solid rgba(217,119,6,0.2)`, fontSize:12, color:"#92400E" }}>
                        <AlertTriangle size={13} style={{ color:C.warn, flexShrink:0, marginTop:1 }} />
                        {w}
                      </div>
                    ))}
                  </div>
                )}
                {extractionMode && extractionMode !== "structured" && (
                  <div style={{ marginTop:12, fontSize:12, color:C.muted }}>Extraction mode: <strong>{extractionMode}</strong></div>
                )}
              </Panel>
            )}

            {/* ── Mapping review ── */}
            {stage === "mapping" && job && (
              <Panel>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <Sparkles size={16} style={{ color:C.blue }} />
                  <span style={{ fontSize:15, fontWeight:700, color:C.text }}>Analysis Complete</span>
                  {job.ai_used && <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99, background:"#EFF6FF", color:C.blue }}>AI used</span>}
                </div>
                <p style={{ fontSize:13, color:C.sub, marginBottom:16, lineHeight:1.5 }}>
                  The engine detected <strong>{job.total_rows ?? 0} rows</strong> as <strong>{TYPE_LABELS[job.import_type || job.detected_type] ?? (job.import_type || job.detected_type || "unknown")}</strong>. Review below then click Validate.
                </p>

                {warnings.length > 0 && (
                  <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:14 }}>
                    {warnings.map((w, i) => (
                      <div key={i} style={{ display:"flex", gap:8, padding:"8px 12px", borderRadius:8, background:"#FFFBEB", border:`1px solid rgba(217,119,6,0.2)`, fontSize:12, color:"#92400E" }}>
                        <AlertTriangle size={13} style={{ color:C.warn, flexShrink:0, marginTop:1 }} />{w}
                      </div>
                    ))}
                  </div>
                )}

                {job.ai_error_message && (
                  <div style={{ display:"flex", gap:8, padding:"8px 12px", borderRadius:8, background:"#FFF7ED", border:`1px solid rgba(234,88,12,0.2)`, fontSize:12, color:"#9A3412", marginBottom:14 }}>
                    <AlertCircle size={13} style={{ flexShrink:0, marginTop:1, color:C.warn }} />
                    <span><strong>AI mapping note:</strong> {job.ai_error_message}</span>
                  </div>
                )}

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20 }}>
                  {[
                    { label:"Total Rows", value:totalRows, color:C.text },
                    { label:"Valid",      value:validRows,  color:C.success },
                    { label:"Invalid",    value:failedRows, color:failedRows > 0 ? C.error : C.muted },
                  ].map(s => (
                    <div key={s.label} style={{ borderRadius:10, background:C.bg, padding:"12px 16px" }}>
                      <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.04em" }}>{s.label}</div>
                      <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.sub, background:"none", border:"none", cursor:"pointer", fontFamily:FF }}>
                    <ArrowLeft size={13} /> Start over
                  </button>
                  <Btn onClick={handleValidate} disabled={busy}>
                    {busy ? <><Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> Starting…</> : <>Validate Rows <ArrowRight size={13} /></>}
                  </Btn>
                </div>
              </Panel>
            )}

            {/* ── Validating / ready_to_commit ── */}
            {stage === "validating" && job && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {["validating","queued","processing"].includes(jobStatus) ? (
                  <Panel style={{ textAlign:"center", padding:36 }}>
                    <Loader2 size={28} strokeWidth={1.5} style={{ color:C.blue, animation:"spin 1s linear infinite", marginBottom:10 }} />
                    <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:4 }}>Validating rows…</div>
                    <ProgressBar pct={pct} />
                  </Panel>
                ) : (
                  <Panel>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text, marginBottom:14 }}>Validation Results</div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
                      {[
                        { label:"Total",     value:totalRows,   color:C.text },
                        { label:"Valid",     value:validRows,   color:C.success },
                        { label:"Skipped",   value:skippedRows, color:C.muted },
                        { label:"Failed",    value:failedRows,  color:failedRows > 0 ? C.error : C.muted },
                      ].map(s => (
                        <div key={s.label} style={{ borderRadius:10, background:C.bg, padding:"11px 14px" }}>
                          <div style={{ fontSize:11, color:C.muted, marginBottom:3, fontWeight:600, textTransform:"uppercase" as const, letterSpacing:"0.04em" }}>{s.label}</div>
                          <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>

                    {hasErrors && (
                      <div style={{ background:"#FEF2F2", border:`1px solid rgba(220,38,38,0.2)`, borderRadius:10, padding:14, marginBottom:14 }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                          <span style={{ fontSize:13, fontWeight:700, color:C.error }}>{failedRows} row(s) failed validation</span>
                          <div style={{ display:"flex", gap:8 }}>
                            <Btn variant="ghost" onClick={() => window.open(getImportErrorCsvUrl(jobId!), "_blank")}>
                              <Download size={12} /> Error CSV
                            </Btn>
                            <Btn variant="ghost" onClick={handleAiFixes} disabled={fixesBusy}>
                              {fixesBusy ? <><Loader2 size={12} style={{ animation:"spin 1s linear infinite" }} /> Getting…</> : <><Sparkles size={12} /> AI Suggestions</>}
                            </Btn>
                          </div>
                        </div>
                        <p style={{ fontSize:12, color:"#991B1B", margin:0 }}>You can commit valid rows now, or fix errors first and retry.</p>
                      </div>
                    )}

                    {skippedRows > 0 && (
                      <div style={{ background:"#F0F9FF", border:`1px solid rgba(3,105,161,0.15)`, borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#0C4A6E" }}>
                        <strong>{skippedRows} duplicate(s) skipped</strong> — these records already exist and were not overwritten.
                      </div>
                    )}

                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 14px", borderRadius:10, background:"#EFF6FF", border:`1px solid #BFDBFE`, marginBottom:16, fontSize:13, color:"#1E40AF" }}>
                      <ShieldCheck size={14} style={{ flexShrink:0 }} />
                      Committing <strong>{validRows}</strong> valid row(s) will be audit-logged. Existing records will not be overwritten.
                    </div>

                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", gap:8 }}>
                        <button onClick={reset} style={{ display:"flex", alignItems:"center", gap:6, fontSize:13, color:C.sub, background:"none", border:"none", cursor:"pointer", fontFamily:FF }}>
                          <ArrowLeft size={13} /> Start over
                        </button>
                        {hasErrors && (
                          <Btn variant="ghost" onClick={handleRetry} disabled={busy}>
                            <RefreshCw size={12} /> Retry failed
                          </Btn>
                        )}
                      </div>
                      <Btn onClick={handleCommit} disabled={busy || validRows === 0}>
                        {busy ? <><Loader2 size={13} style={{ animation:"spin 1s linear infinite" }} /> Committing…</> : <>Commit {validRows} row{validRows !== 1 ? "s" : ""} <Zap size={13} /></>}
                      </Btn>
                    </div>
                  </Panel>
                )}
              </div>
            )}

            {/* ── AI Fixes ── */}
            {stage === "fixes" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                <Panel>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                    <Sparkles size={16} style={{ color:C.blue }} />
                    <span style={{ fontSize:15, fontWeight:700, color:C.text }}>AI Row-Fix Suggestions</span>
                    <span style={{ fontSize:12, color:C.muted }}>({fixes.length} suggestions)</span>
                  </div>
                  {fixes.length === 0 ? (
                    <p style={{ fontSize:13, color:C.muted }}>No specific fixes suggested — the errors may require manual review.</p>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      {fixes.map((f, i) => (
                        <div key={i} style={{ padding:"10px 14px", borderRadius:10, background:C.bg, border:`1px solid ${C.border}` }}>
                          <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:4 }}>Row {f.rowNumber} — {f.issue}</div>
                          <div style={{ fontSize:12, color:C.sub }}>{f.suggestedFix}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </Panel>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <Btn variant="ghost" onClick={() => setStage("validating")}>
                    <ArrowLeft size={13} /> Back to Validation
                  </Btn>
                  <div style={{ display:"flex", gap:8 }}>
                    <Btn variant="ghost" onClick={handleRetry} disabled={busy}>
                      <RefreshCw size={12} /> Retry failed rows
                    </Btn>
                    <Btn onClick={handleCommit} disabled={busy || validRows === 0}>
                      Commit valid rows <Zap size={13} />
                    </Btn>
                  </div>
                </div>
              </div>
            )}

            {/* ── Committing ── */}
            {stage === "committing" && (
              <Panel style={{ textAlign:"center", padding:40 }}>
                <Loader2 size={32} strokeWidth={1.5} style={{ color:C.blue, animation:"spin 1s linear infinite", marginBottom:12 }} />
                <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:6 }}>Committing rows…</div>
                <div style={{ fontSize:13, color:C.sub, marginBottom:14 }}>Please don't close this page.</div>
                <div style={{ maxWidth:320, margin:"0 auto" }}><ProgressBar pct={pct} /></div>
              </Panel>
            )}

            {/* ── Done ── */}
            {stage === "done" && job && (
              <Panel style={{ textAlign:"center", padding:36 }}>
                {["failed","commit_failed"].includes(jobStatus) ? (
                  <>
                    <div style={{ width:56, height:56, borderRadius:99, background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                      <X size={26} strokeWidth={2} style={{ color:C.error }} />
                    </div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:6 }}>Import Failed</div>
                    <div style={{ fontSize:13, color:C.sub, marginBottom:20 }}>{job.error_message || "The import could not be completed."}</div>
                  </>
                ) : (
                  <>
                    <div style={{ width:56, height:56, borderRadius:99, background:"#ECFDF5", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 12px" }}>
                      <CircleCheck size={28} strokeWidth={1.8} style={{ color:C.success }} />
                    </div>
                    <div style={{ fontSize:18, fontWeight:700, color:C.text, marginBottom:6 }}>Import Complete</div>
                    <div style={{ fontSize:13, color:C.sub, marginBottom:20 }}>Your data has been committed and audit-logged.</div>

                    <div style={{ display:"inline-grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:24, minWidth:360 }}>
                      {[
                        { label:"Committed", value:committed, color:C.success },
                        { label:"Skipped",   value:skippedRows, color:C.muted },
                        { label:"Failed",    value:failedRows, color:failedRows > 0 ? C.error : C.muted },
                      ].map(s => (
                        <div key={s.label} style={{ borderRadius:10, background:C.bg, padding:"12px 16px" }}>
                          <div style={{ fontSize:11, color:C.muted, marginBottom:4, fontWeight:600, textTransform:"uppercase" as const }}>{s.label}</div>
                          <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, flexWrap:"wrap" }}>
                  {hasErrors && !["failed","commit_failed"].includes(jobStatus) && (
                    <Btn variant="ghost" onClick={handleRetry} disabled={busy}>
                      <RefreshCw size={13} /> Retry failed rows
                    </Btn>
                  )}
                  {hasErrors && (
                    <Btn variant="ghost" onClick={() => window.open(getImportErrorCsvUrl(jobId!), "_blank")}>
                      <Download size={13} /> Download error CSV
                    </Btn>
                  )}
                  <Btn onClick={reset}>
                    <Upload size={13} /> Import more data
                  </Btn>
                </div>
              </Panel>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }`}</style>
    </AppLayout>
  );
}
