import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { ShieldCheck, Download, RefreshCw, AlertTriangle, CheckCircle2, Info, FileText, Users, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAuthJson } from "@/lib/fetchWithAuth";

const GRADE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" },
  B: { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" },
  C: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  D: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  F: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
};

const FINDING_ICONS: Record<string, React.ElementType> = {
  critical: AlertTriangle,
  warning:  AlertTriangle,
  info:     Info,
};

const FINDING_COLORS: Record<string, string> = {
  critical: "text-red-600",
  warning:  "text-amber-600",
  info:     "text-blue-600",
};

export default function Compliance() {
  const today = new Date().toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);

  const [fromDate, setFromDate] = useState(ninetyDaysAgo);
  const [toDate,   setToDate]   = useState(today);
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState<any>(null);
  const [error,   setError]     = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuthJson<any>(`/api/ai/compliance-evidence?fromDate=${fromDate}&toDate=${toDate}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate compliance evidence");
    }
    setLoading(false);
  };

  const downloadCSV = () => {
    if (!result?.summary) return;
    const s = result.summary;
    const rows = [
      ["Compliance Evidence Pack"],
      ["Period", `${fromDate} to ${toDate}`],
      ["Generated", new Date().toLocaleString("en-AU")],
      [""],
      ["OVERALL SCORE", result.overallComplianceScore ?? "—"],
      ["GRADE", result.overallComplianceGrade ?? "—"],
      ["NDIS Readiness", result.ndisReadiness ?? "—"],
      [""],
      ["STAFF"],
      ["Total Staff", s.staff?.total ?? 0],
      ["Active Staff", s.staff?.active ?? 0],
      ["Compliance Expired", s.staff?.complianceExpired ?? 0],
      ["Compliance Expiring Soon", s.staff?.complianceExpiringSoon ?? 0],
      [""],
      ["PARTICIPANTS"],
      ["Total Participants", s.participants?.total ?? 0],
      ["Consent Given", s.participants?.consentGiven ?? 0],
      [""],
      ["SERVICE DELIVERY"],
      ["Total Shifts", s.shifts?.total ?? 0],
      ["Completed Shifts", s.shifts?.completed ?? 0],
      ["Signed Shifts", s.shifts?.signed ?? 0],
      ["Signature Rate", `${s.shifts?.signatureRate ?? 0}%`],
      [""],
      ["INCIDENTS"],
      ["Total Incidents", s.incidents?.total ?? 0],
      ["Critical Incidents", s.incidents?.critical ?? 0],
      ["Open Incidents", s.incidents?.open ?? 0],
      ["NDIS Reportable", s.incidents?.reportableToNdis ?? 0],
      [""],
      ["AI NARRATIVE"],
      ["Executive Summary", result.executiveSummary ?? ""],
      [""],
      ["RECOMMENDATIONS"],
      ...(result.recommendations ?? []).map((r: string, i: number) => [`${i + 1}.`, r]),
    ];
    const csv = rows.map(r => r.map((v: unknown) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-evidence-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grade = result?.overallComplianceGrade;
  const gradeStyle = grade ? (GRADE_COLORS[grade] ?? GRADE_COLORS.C) : null;

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Compliance Evidence Builder</h1>
          <p className="pf-page-desc">Generate AI-narrated compliance evidence packs from your live operational records</p>
        </div>
        {result && (
          <Button variant="outline" onClick={downloadCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Controls */}
      <div className="pf-card" style={{ marginBottom: 14 }}>
        <div className="pf-card-body" style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
          <div className="pf-field">
            <label>From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="pf-input" style={{ width: 176 }} />
          </div>
          <div className="pf-field">
            <label>To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="pf-input" style={{ width: 176 }} />
          </div>
          <Button onClick={generate} disabled={loading} className="gap-2 h-9">
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating…</>
              : <><Sparkles className="w-4 h-4" />{result ? "Regenerate" : "Generate Evidence Pack"}</>
            }
          </Button>
        </div>
        <div style={{ padding: "0 16px 14px", fontSize: 12, color: "var(--pf-muted)" }}>
          Analyses all operational records in the selected period and produces an AI-narrated compliance pack suitable for NDIS audits.
        </div>
      </div>

      {error && (
        <div className="pf-chip pf-chip-error" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", height: "auto", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>
          <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Score header */}
          <div className="pf-card">
            <div className="pf-card-body" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <ShieldCheck style={{ width: 16, height: 16, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-primary)" }}>AI Compliance Evidence Pack</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--pf-text)", lineHeight: 1.6, marginBottom: 12 }}>{result.executiveSummary}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`pf-chip ${result.ndisReadiness === "ready" ? "pf-chip-success" : "pf-chip-warning"}`}>
                    NDIS: {result.ndisReadinessNote ?? result.ndisReadiness}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--pf-muted)" }}>Period: {fromDate} → {toDate}</span>
                </div>
              </div>
              {gradeStyle && (
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ width: 72, height: 72, borderRadius: 16, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: gradeStyle.bg, border: `2px solid ${gradeStyle.border}` }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: gradeStyle.text, lineHeight: 1 }}>{grade}</span>
                  </div>
                  <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 6, fontWeight: 600 }}>Compliance Grade</p>
                  <p style={{ fontSize: 18, fontWeight: 800, color: "var(--pf-text)" }}>{result.overallComplianceScore ?? 0}/100</p>
                </div>
              )}
            </div>
          </div>

          {/* Stats grid */}
          {result.summary && (
            <div className="pf-grid pf-grid-4">
              {[
                { icon: Users, label: "Active Staff",      value: result.summary.staff?.active ?? 0,         sub: `${result.summary.staff?.complianceExpired ?? 0} compliance expired` },
                { icon: Users, label: "Participants",      value: result.summary.participants?.total ?? 0,    sub: `${result.summary.participants?.consentGiven ?? 0} consented` },
                { icon: Calendar, label: "Shifts Delivered", value: result.summary.shifts?.completed ?? 0,   sub: `${result.summary.shifts?.signatureRate ?? 0}% signed` },
                { icon: AlertTriangle, label: "Incidents", value: result.summary.incidents?.total ?? 0,       sub: `${result.summary.incidents?.critical ?? 0} critical` },
              ].map(({ icon: Icon, label, value, sub }) => (
                <div key={label} className="pf-card" style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div className="pf-metric-icon" style={{ width: 30, height: 30, borderRadius: 8 }}>
                      <Icon style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)" }}>{label}</span>
                  </div>
                  <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em" }}>{value}</p>
                  <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 2 }}>{sub}</p>
                </div>
              ))}
            </div>
          )}

          <div className="pf-grid pf-grid-2">
            {/* Evidence sections */}
            <div className="pf-card">
              <div className="pf-card-header">
                <span className="pf-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                  Evidence Sections
                </span>
              </div>
              <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {result.sections && Object.entries(result.sections).map(([key, value]) => (
                  <div key={key} style={{ borderLeft: "2px solid var(--pf-primary)", paddingLeft: 10 }}>
                    <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)", marginBottom: 3 }}>
                      {key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}
                    </p>
                    <p style={{ fontSize: 12, color: "var(--pf-text-soft)", lineHeight: 1.5 }}>{value as string}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Findings */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(result.strengths ?? []).length > 0 && (
                <div className="pf-card">
                  <div className="pf-card-header">
                    <span className="pf-card-title" style={{ color: "var(--pf-success)", display: "flex", alignItems: "center", gap: 8 }}>
                      <CheckCircle2 style={{ width: 14, height: 14 }} />Strengths
                    </span>
                  </div>
                  <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.strengths.map((s: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-text-soft)" }}>
                        <span style={{ color: "var(--pf-success)", flexShrink: 0, marginTop: 1 }}>✓</span>
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(result.criticalFindings ?? []).length > 0 && (
                <div className="pf-card">
                  <div className="pf-card-header">
                    <span className="pf-card-title" style={{ color: "var(--pf-error)", display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertTriangle style={{ width: 14, height: 14 }} />Critical Findings
                    </span>
                  </div>
                  <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.criticalFindings.map((f: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-text-soft)" }}>
                        <span style={{ color: "var(--pf-error)", flexShrink: 0, marginTop: 1 }}>!</span>{f}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(result.recommendations ?? []).length > 0 && (
                <div className="pf-card">
                  <div className="pf-card-header">
                    <span className="pf-card-title" style={{ color: "var(--pf-primary)", display: "flex", alignItems: "center", gap: 8 }}>
                      <Info style={{ width: 14, height: 14 }} />Recommendations
                    </span>
                  </div>
                  <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {result.recommendations.map((r: string, i: number) => (
                      <div key={i} style={{ display: "flex", gap: 8, fontSize: 12, color: "var(--pf-text-soft)" }}>
                        <span style={{ color: "var(--pf-primary)", flexShrink: 0, fontWeight: 700, marginTop: 1 }}>{i + 1}.</span>{r}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: 11, color: "var(--pf-muted)", textAlign: "center" }}>
            Generated by AI on {new Date(result.generatedAt).toLocaleString("en-AU")} · Based on live operational data · Not a substitute for professional legal or compliance advice
          </p>
        </div>
      )}

      {!result && !loading && (
        <div className="pf-card">
          <div className="pf-empty" style={{ padding: "64px 24px" }}>
            <ShieldCheck className="pf-empty-icon" />
            <p style={{ fontWeight: 600, color: "var(--pf-text-soft)" }}>Select a date range and generate your compliance evidence pack</p>
            <p style={{ fontSize: 12 }}>The AI will analyse your operational data and produce an audit-ready report</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
