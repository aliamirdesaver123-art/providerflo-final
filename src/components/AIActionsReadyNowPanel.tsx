import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Sparkles,
  TrendingUp,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import {
  approveAIAction,
  getAIAutomationSettings,
  listAIActionRuns,
  rejectAIAction,
  runAIActionNow,
  updateAIAutomationSettings,
  type AIActionName,
  type AIActionRun,
} from "../lib/api/aiActionsReadyNow";

/* ── Action metadata ─────────────────────────────────────────────────────── */
const ACTION_META: Record<AIActionName, { title: string; description: string; Icon: React.ElementType }> = {
  auto_schedule_staff: {
    title: "Auto Schedule Staff",
    description:
      "Generate draft roster assignments using worker availability, participant needs, shift gaps and compliance checks.",
    Icon: CalendarClock,
  },
  draft_documentation: {
    title: "Generate Draft Documentation",
    description:
      "Create draft progress summaries, service notes, care reports and participant documentation for review.",
    Icon: FileText,
  },
  resource_optimisation: {
    title: "Optimise Resource Allocation",
    description:
      "Find staffing gaps, cancellations, unassigned shifts, overloaded workers and operational improvement opportunities.",
    Icon: TrendingUp,
  },
};

const ACTION_KEYS: AIActionName[] = ["auto_schedule_staff", "draft_documentation", "resource_optimisation"];

/* ── Shared design tokens (inline) ──────────────────────────────────────── */
const AI_ICON_BG  = "var(--pf-ai-soft, #eef6ff)";
const AI_ICON_CLR = "var(--pf-ai, #78b9ff)";

/* ── Status chip ─────────────────────────────────────────────────────────── */
function StatusChip({ status }: { status: string }) {
  if (status === "approved")
    return (
      <span className="pf-chip pf-chip-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <CheckCircle2 style={{ width: 10, height: 10 }} /> Approved
      </span>
    );
  if (status === "rejected")
    return (
      <span className="pf-chip pf-chip-error" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <XCircle style={{ width: 10, height: 10 }} /> Rejected
      </span>
    );
  return (
    <span className="pf-chip pf-chip-warning" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <Clock style={{ width: 10, height: 10 }} /> Awaiting Review
    </span>
  );
}

/* ── Result view — enterprise-coloured ──────────────────────────────────── */
function ActionResultView({ actionName, result }: { actionName: string; result: Record<string, unknown> }) {
  const sectionLabel = (label: string) => (
    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 8 }}>
      {label}
    </p>
  );

  const infoBox = (children: React.ReactNode, variant: "warning" | "error" = "warning") => (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 8,
      background: variant === "error" ? "#fef2f2" : "#fffbeb",
      border: `1px solid ${variant === "error" ? "#fecaca" : "#fde68a"}`,
      color: variant === "error" ? "#b91c1c" : "#b45309", fontSize: 12, lineHeight: 1.5,
    }}>
      <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
      <div>{children}</div>
    </div>
  );

  const resultCard = (children: React.ReactNode) => (
    <div style={{ border: "1px solid var(--pf-border)", borderRadius: 8, background: "var(--pf-surface)", padding: "10px 12px" }}>
      {children}
    </div>
  );

  if (actionName === "auto_schedule_staff") {
    const suggestions = (result.suggestions as any[]) ?? [];
    const summary     = result.summary as string | undefined;
    const warnings    = (result.warnings as string[]) ?? [];
    const gaps        = (result.coverageGaps as string[]) ?? [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {summary && <p style={{ fontSize: 13, color: "var(--pf-text-soft)", lineHeight: 1.6 }}>{summary}</p>}
        {warnings.length > 0 && infoBox(<ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 3 }}>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>)}
        {gaps.length > 0 && infoBox(<div><strong>Coverage Gaps:</strong><ul style={{ margin: "4px 0 0", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>{gaps.map((g, i) => <li key={i}>{g}</li>)}</ul></div>, "error")}
        {suggestions.length > 0 ? (
          <div>
            {sectionLabel(`Staff Suggestions (${suggestions.length})`)}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestions.map((s: any, i: number) => resultCard(
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <User style={{ width: 13, height: 13, color: "var(--pf-muted)" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{s.recommendedStaffName}</span>
                    <span className="pf-chip pf-chip-info" style={{ fontSize: 10 }}>{s.confidenceScore}% match</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--pf-muted)", marginBottom: 4 }}>
                    Client: {s.participantName} · {s.scheduledStart ? new Date(s.scheduledStart).toLocaleString("en-AU", { dateStyle: "short", timeStyle: "short" }) : "—"}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--pf-text-soft)", lineHeight: 1.5 }}>{s.rationale}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--pf-muted)" }}>No unassigned shifts to suggest staff for.</p>
        )}
      </div>
    );
  }

  if (actionName === "draft_documentation") {
    const documents = (result.documents as any[]) ?? [];
    const summary   = result.summary as string | undefined;
    const urgent    = (result.participantsRequiringUrgentAttention as string[]) ?? [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {summary && <p style={{ fontSize: 13, color: "var(--pf-text-soft)", lineHeight: 1.6 }}>{summary}</p>}
        {urgent.length > 0 && infoBox(<span>Urgent attention required: {urgent.join(", ")}</span>)}
        {documents.length > 0 ? (
          <div>
            {sectionLabel(`Draft Documents (${documents.length})`)}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {documents.map((doc: any, i: number) => resultCard(
                <div key={i}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{doc.participantName}</span>
                    {doc.followUpRequired && <span className="pf-chip pf-chip-warning" style={{ fontSize: 10 }}>Follow-up needed</span>}
                  </div>
                  {doc.ndisNumber && (
                    <p style={{ fontSize: 11, color: "var(--pf-muted)", marginBottom: 6 }}>NDIS: {doc.ndisNumber} · Period: {doc.period}</p>
                  )}
                  <p style={{ fontSize: 12, color: "var(--pf-text-soft)", lineHeight: 1.6, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as any }}>{doc.progressSummary}</p>
                  {doc.recommendations?.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-text-soft)", marginBottom: 4 }}>Recommendations:</p>
                      <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                        {doc.recommendations.map((r: string, j: number) => <li key={j} style={{ fontSize: 11, color: "var(--pf-text-soft)" }}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "var(--pf-muted)" }}>No participant documentation generated.</p>
        )}
      </div>
    );
  }

  if (actionName === "resource_optimisation") {
    const issues       = (result.criticalIssues as any[]) ?? [];
    const staffRecs    = (result.staffingRecommendations as any[]) ?? [];
    const coverageRecs = (result.coverageRecommendations as any[]) ?? [];
    const quickWins    = (result.quickWins as string[]) ?? [];
    const strategies   = (result.longerTermStrategies as string[]) ?? [];
    const summary      = result.executiveSummary as string | undefined;
    const score        = result.overallHealthScore as number | undefined;
    const grade        = result.overallHealthGrade as string | undefined;
    const stats        = result.stats as Record<string, number> | undefined;

    const priorityBorder: Record<string, string> = {
      critical: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "var(--pf-border)",
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(score !== undefined || grade) && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 10, background: "var(--pf-surface)", border: "1px solid var(--pf-border)" }}>
            {grade && (
              <div style={{ width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 10, background: "#fff", fontSize: 26, fontWeight: 900, color: "var(--pf-text)", border: "1px solid var(--pf-border)" }}>
                {grade}
              </div>
            )}
            <div>
              {score !== undefined && <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>Health Score: {score}/100</p>}
              {summary && <p style={{ fontSize: 12, color: "var(--pf-text-soft)", marginTop: 3, lineHeight: 1.5 }}>{summary}</p>}
            </div>
          </div>
        )}

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {[
              { label: "Active Staff",       value: stats.activeStaff },
              { label: "Unassigned Shifts",  value: stats.totalUnassigned },
              { label: "Overloaded",         value: stats.overloadedCount },
              { label: "Idle Staff",         value: stats.underutilisedCount },
            ].map(m => (
              <div key={m.label} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", textAlign: "center" }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em" }}>{m.value}</p>
                <p style={{ fontSize: 10, color: "var(--pf-muted)", marginTop: 2 }}>{m.label}</p>
              </div>
            ))}
          </div>
        )}

        {issues.length > 0 && (
          <div>
            {sectionLabel("Issues & Recommendations")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {issues.map((issue: any, i: number) => (
                <div key={i} style={{ borderLeft: `3px solid ${priorityBorder[issue.priority] ?? "var(--pf-border)"}`, borderRadius: "0 8px 8px 0", background: "var(--pf-surface)", border: "1px solid var(--pf-border)", borderLeftWidth: 3, padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{issue.title}</p>
                    <span className="pf-chip" style={{ fontSize: 10, textTransform: "capitalize", flexShrink: 0 }}>{issue.priority}</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--pf-text-soft)", lineHeight: 1.5 }}>{issue.description}</p>
                  {issue.recommendedAction && (
                    <p style={{ fontSize: 12, fontWeight: 600, color: "var(--pf-primary)", marginTop: 6 }}>→ {issue.recommendedAction}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {quickWins.length > 0 && (
          <div>
            {sectionLabel("Quick Wins")}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {quickWins.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--pf-text-soft)", lineHeight: 1.5 }}>
                  <CheckCircle2 style={{ width: 13, height: 13, color: "var(--pf-primary)", flexShrink: 0, marginTop: 2 }} />
                  {w}
                </div>
              ))}
            </div>
          </div>
        )}

        {(staffRecs.length > 0 || coverageRecs.length > 0 || strategies.length > 0) && (
          <details style={{ border: "1px solid var(--pf-border)", borderRadius: 8 }}>
            <summary style={{ cursor: "pointer", padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "var(--pf-text-soft)", listStyle: "none", userSelect: "none" }}>
              View all recommendations
            </summary>
            <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
              {staffRecs.length > 0 && (
                <div>
                  {sectionLabel("Staff")}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {staffRecs.map((r: any, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: "var(--pf-text-soft)" }}><strong style={{ color: "var(--pf-text)", fontWeight: 700 }}>{r.staffName}:</strong> {r.recommendation}</p>
                    ))}
                  </div>
                </div>
              )}
              {coverageRecs.length > 0 && (
                <div>
                  {sectionLabel("Coverage")}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {coverageRecs.map((r: any, i: number) => (
                      <p key={i} style={{ fontSize: 12, color: "var(--pf-text-soft)" }}><strong style={{ color: "var(--pf-text)", fontWeight: 700 }}>{r.participantName}:</strong> {r.recommendation}</p>
                    ))}
                  </div>
                </div>
              )}
              {strategies.length > 0 && (
                <div>
                  {sectionLabel("Longer-term")}
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {strategies.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "var(--pf-text-soft)" }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--pf-muted)", flexShrink: 0, marginTop: 6 }} />
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    );
  }

  return (
    <pre style={{ maxHeight: 220, overflowY: "auto", borderRadius: 8, background: "var(--pf-surface)", border: "1px solid var(--pf-border)", padding: "10px 12px", fontSize: 11, color: "var(--pf-text-soft)", lineHeight: 1.6 }}>
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

/* ── Run card ─────────────────────────────────────────────────────────────── */
function RunCard({ run, onApprove, onReject, busy }: {
  run: AIActionRun;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[run.actionName as AIActionName];
  const Icon = meta?.Icon ?? Sparkles;
  const isLoading = busy === run.id;

  return (
    <div className="pf-card" style={{ overflow: "hidden" }}>
      <div className="pf-card-body">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: AI_ICON_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon style={{ width: 16, height: 16, color: AI_ICON_CLR, strokeWidth: 1.8 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "var(--pf-text)" }}>{meta?.title ?? run.actionName}</p>
                <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 2 }}>
                  {new Date(run.createdAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <StatusChip status={run.status} />
                {run.status === "draft" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => onApprove(run.id)}
                      disabled={isLoading}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px",
                        borderRadius: 7, border: "1px solid #dcfce7", background: "#f0fdf4",
                        color: "#15803d", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      {isLoading ? <Loader2 style={{ width: 11, height: 11 }} className="animate-spin" /> : <CheckCircle2 style={{ width: 11, height: 11 }} />}
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(run.id)}
                      disabled={isLoading}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px",
                        borderRadius: 7, border: "1px solid #fecaca", background: "#fef2f2",
                        color: "#b91c1c", fontSize: 11, fontWeight: 700, cursor: "pointer",
                        opacity: isLoading ? 0.6 : 1,
                      }}
                    >
                      <XCircle style={{ width: 11, height: 11 }} /> Reject
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setExpanded(e => !e)}
              style={{ marginTop: 8, display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--pf-primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              {expanded ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
              {expanded ? "Hide results" : "View AI results"}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: "1px solid var(--pf-border)", padding: "14px 16px" }}>
          <ActionResultView actionName={run.actionName} result={run.result} />
        </div>
      )}
    </div>
  );
}

/* ── Main panel ──────────────────────────────────────────────────────────── */
export default function AIActionsReadyNowPanel() {
  const [runs, setRuns]                   = useState<AIActionRun[]>([]);
  const [busy, setBusy]                   = useState("");
  const [error, setError]                 = useState("");
  const [settings, setSettings]           = useState({ aiFeaturesEnabled: true, aiPoweredActionsEnabled: true });
  const [settingsLoading, setSettingsLoading] = useState(false);

  async function loadAll() {
    const [runsData, settingsData] = await Promise.all([
      listAIActionRuns().catch(() => ({ runs: [] as AIActionRun[] })),
      getAIAutomationSettings().catch(() => ({ aiFeaturesEnabled: true, aiPoweredActionsEnabled: true })),
    ]);
    setRuns(runsData.runs ?? []);
    setSettings(settingsData);
  }

  useEffect(() => { loadAll().catch(() => {}); }, []);

  async function handleRun(actionName: AIActionName) {
    setBusy(actionName); setError("");
    try { await runAIActionNow(actionName, {}); await loadAll(); }
    catch (err: any) { setError(err.message ?? "Failed to run AI action. Please try again."); }
    finally { setBusy(""); }
  }

  async function handleApprove(id: string) {
    setBusy(id); setError("");
    try { await approveAIAction(id); await loadAll(); }
    catch (err: any) { setError(err.message ?? "Failed to approve AI action."); }
    finally { setBusy(""); }
  }

  async function handleReject(id: string) {
    setBusy(id); setError("");
    try { await rejectAIAction(id); await loadAll(); }
    catch (err: any) { setError(err.message ?? "Failed to reject AI action."); }
    finally { setBusy(""); }
  }

  async function toggleSettings(field: "aiFeaturesEnabled" | "aiPoweredActionsEnabled") {
    setSettingsLoading(true);
    const updated = { ...settings, [field]: !settings[field] };
    try { const result = await updateAIAutomationSettings(updated); setSettings(result); }
    catch { setError("Failed to update AI settings."); }
    finally { setSettingsLoading(false); }
  }

  const draftRuns   = runs.filter(r => r.status === "draft");
  const decidedRuns = runs.filter(r => r.status !== "draft");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* ── Settings strip ─────────────────────────────────────────────── */}
      <div className="pf-card">
        <div className="pf-card-body" style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <p style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", flexShrink: 0 }}>
            AI Settings
          </p>
          {(
            [
              { field: "aiFeaturesEnabled" as const, label: "AI Features" },
              { field: "aiPoweredActionsEnabled" as const, label: "AI-Powered Actions" },
            ] as const
          ).map(({ field, label }) => (
            <button
              key={field}
              onClick={() => toggleSettings(field)}
              disabled={settingsLoading}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 8,
                border: "1px solid var(--pf-border)", background: "#fff",
                fontSize: 12, fontWeight: 700, color: "var(--pf-text-soft)",
                cursor: "pointer", opacity: settingsLoading ? 0.6 : 1,
                transition: "border-color .14s",
              }}
            >
              {settings[field]
                ? <ToggleRight style={{ width: 18, height: 18, color: "var(--pf-primary)" }} />
                : <ToggleLeft  style={{ width: 18, height: 18, color: "var(--pf-muted)" }} />}
              {label}:&nbsp;
              <span style={{ color: settings[field] ? "var(--pf-primary)" : "var(--pf-muted)" }}>
                {settings[field] ? "On" : "Off"}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: 13, fontWeight: 600 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* ── Run action cards ───────────────────────────────────────────── */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10 }}>
          Run an AI Action
        </p>
        <div className="pf-grid pf-grid-3">
          {ACTION_KEYS.map(key => {
            const { title, description, Icon } = ACTION_META[key];
            const isRunning  = busy === key;
            const isDisabled = !settings.aiFeaturesEnabled || !settings.aiPoweredActionsEnabled || !!busy;
            return (
              <div key={key} className="pf-card" style={{ display: "flex", flexDirection: "column" }}>
                <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: AI_ICON_BG, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                    <Icon style={{ width: 18, height: 18, color: AI_ICON_CLR, strokeWidth: 1.8 }} />
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "var(--pf-text)", marginBottom: 6 }}>{title}</p>
                  <p style={{ fontSize: 12, color: "var(--pf-muted)", lineHeight: 1.6, flex: 1, marginBottom: 14 }}>{description}</p>
                  <button
                    onClick={() => handleRun(key)}
                    disabled={isDisabled}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      width: "100%", height: 36, borderRadius: 8,
                      background: isDisabled ? "var(--pf-border)" : "var(--pf-sidebar)",
                      border: "none", color: isDisabled ? "var(--pf-muted)" : "#fff",
                      fontSize: 12, fontWeight: 700, cursor: isDisabled ? "not-allowed" : "pointer",
                      transition: "background .15s",
                    }}
                  >
                    {isRunning
                      ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" />Generating…</>
                      : <><Sparkles style={{ width: 13, height: 13 }} />Run now</>}
                  </button>
                  {isDisabled && !isRunning && (
                    <p style={{ fontSize: 10, color: "var(--pf-muted)", textAlign: "center", marginTop: 6 }}>
                      {!settings.aiFeaturesEnabled
                        ? "AI features disabled"
                        : !settings.aiPoweredActionsEnabled
                          ? "AI Actions disabled"
                          : "Another action is running…"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pending review ─────────────────────────────────────────────── */}
      {draftRuns.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10 }}>
            Pending Review ({draftRuns.length})
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {draftRuns.map(run => (
              <RunCard key={run.id} run={run} onApprove={handleApprove} onReject={handleReject} busy={busy} />
            ))}
          </div>
        </div>
      )}

      {/* ── Review history ─────────────────────────────────────────────── */}
      {decidedRuns.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10 }}>
            Review History
          </p>
          <div className="pf-card" style={{ overflow: "hidden" }}>
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Run at</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {decidedRuns.map(run => {
                  const meta = ACTION_META[run.actionName as AIActionName];
                  const Icon = meta?.Icon ?? Sparkles;
                  return (
                    <tr key={run.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 8, background: AI_ICON_BG, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon style={{ width: 13, height: 13, color: AI_ICON_CLR, strokeWidth: 1.8 }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{meta?.title ?? run.actionName}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--pf-muted)" }}>
                        {new Date(run.createdAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td><StatusChip status={run.status} /></td>
                      <td>
                        <RunCard run={run} onApprove={handleApprove} onReject={handleReject} busy={busy} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {runs.length === 0 && (
        <div className="pf-card">
          <div className="pf-empty">
            <Sparkles style={{ width: 32, height: 32, color: AI_ICON_CLR, opacity: 0.5 }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text-soft)" }}>No AI actions run yet</p>
            <p style={{ fontSize: 12, color: "var(--pf-muted)" }}>Use the cards above to generate your first AI draft.</p>
          </div>
        </div>
      )}
    </div>
  );
}
