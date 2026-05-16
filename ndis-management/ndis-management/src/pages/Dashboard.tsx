import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import {
  useGetDashboardSummary, useGetDashboardUpcomingShifts,
  useGetDashboardComplianceOverview,
} from "@workspace/api-client-react";
import {
  Users, UserCheck, Calendar, AlertTriangle, Receipt, TrendingUp,
  ShieldAlert, ChevronRight, Clock, FileText, UserPlus,
  RefreshCw, Activity, ArrowUp, ArrowDown, Minus, X,
} from "lucide-react";
import { format, parseISO, isToday, formatDistanceToNow } from "date-fns";
import { Link, useLocation } from "wouter";
import { fetchWithAuth, fetchWithAuthJson } from "@/lib/fetchWithAuth";
import { AIStar } from "@/components/pf/AIStar";

function useRecentActivity() {
  return useQuery<any[]>({
    queryKey: ["dashboard-recent-activity"],
    queryFn: () => fetchWithAuthJson<any[]>("/api/dashboard/recent-activity").catch(() => []),
    staleTime: 30_000,
  });
}

function InitialsAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = [
    { bg: "#eff6ff", color: "#1d4ed8" },
    { bg: "#f0fdf4", color: "#15803d" },
    { bg: "#fff7ed", color: "#c2410c" },
    { bg: "#fef2f2", color: "#b91c1c" },
    { bg: "#f5f3ff", color: "#7c3aed" },
  ];
  const c = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: 999, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: c.color }}>{initials}</span>
    </div>
  );
}

function activityIcon(entityType: string): { Icon: React.ElementType; bg: string; color: string } {
  switch (entityType) {
    case "shift":       return { Icon: Calendar,      bg: "#eff6ff", color: "#2563eb" };
    case "invoice":     return { Icon: Receipt,       bg: "#f0fdf4", color: "#15803d" };
    case "staff":       return { Icon: UserPlus,      bg: "#f5f3ff", color: "#7c3aed" };
    case "incident":    return { Icon: AlertTriangle, bg: "#fff7ed", color: "#c2410c" };
    case "participant": return { Icon: Users,         bg: "#eff6ff", color: "#2563eb" };
    default:            return { Icon: Activity,      bg: "#f1f5f9", color: "#64748b" };
  }
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  rostering:  Calendar,
  revenue:    TrendingUp,
  compliance: ShieldAlert,
  staffing:   UserCheck,
  clients:    Users,
};

const PRIORITY_CHIP: Record<string, string> = {
  high:   "pf-chip pf-chip-error",
  medium: "pf-chip pf-chip-warning",
  low:    "pf-chip pf-chip-success",
};

function AIInsightsPanel({ insights, onClose }: { insights: any; onClose: () => void }) {
  if (!insights) return null;
  const growthIcon = insights.metrics?.revenueGrowthIndicator === "up"
    ? <ArrowUp style={{ width: 13, height: 13, color: "#15803d" }} />
    : insights.metrics?.revenueGrowthIndicator === "down"
    ? <ArrowDown style={{ width: 13, height: 13, color: "#b91c1c" }} />
    : <Minus style={{ width: 13, height: 13, color: "#64748b" }} />;
  return (
    <div className="pf-card" style={{ marginBottom: 14 }}>
      <div className="pf-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pf-ai-inline"><AIStar size={12} /> AI Business Analysis</span>
          {insights.headline && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{insights.headline}</span>}
        </div>
        <button onClick={onClose} className="pf-icon-button" style={{ width: 28, height: 28 }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {insights.metrics && (
        <div className="pf-card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10, borderBottom: "1px solid var(--pf-border)", marginBottom: 0, paddingBottom: 14 }}>
          {[
            { label: "30-Day Revenue",    value: `$${(insights.metrics.totalRevenue ?? 0).toLocaleString()}`, icon: growthIcon },
            { label: "Utilisation Rate",  value: `${insights.metrics.avgUtilisationRate ?? 0}%`, icon: null },
            { label: "Vacant Shift Rate", value: `${insights.metrics.vacantShiftRate ?? 0}%`, icon: null },
          ].map(({ label, value, icon }) => (
            <div key={label} style={{ background: "var(--pf-bg)", border: "1px solid var(--pf-border)", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--pf-text)" }}>{value}</span>
                {icon}
              </div>
              <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 3 }}>{label}</p>
            </div>
          ))}
          {insights.topOpportunities?.length > 0 && (
            <div style={{ background: "var(--pf-ai-soft)", border: "1px solid #cfeaff", borderRadius: 10, padding: "12px 14px" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--pf-primary)" }}>Top Opportunity</span>
              <p style={{ fontSize: 12, color: "var(--pf-text)", marginTop: 4, lineHeight: 1.4 }}>{insights.topOpportunities[0]}</p>
            </div>
          )}
        </div>
      )}
      {insights.insights?.length > 0 && (
        <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {insights.insights.map((insight: any, i: number) => {
            const CatIcon = CATEGORY_ICONS[insight.category] ?? Activity;
            return (
              <div key={i} style={{ background: "var(--pf-bg)", border: "1px solid var(--pf-border)", borderRadius: 10, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CatIcon style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-text)" }}>{insight.title}</span>
                  </div>
                  <span className={PRIORITY_CHIP[insight.priority] ?? "pf-chip"} style={{ textTransform: "capitalize" }}>{insight.priority}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--pf-muted)", lineHeight: 1.5 }}>{insight.message}</p>
                {insight.action && <p style={{ fontSize: 11, color: "var(--pf-primary)", marginTop: 6 }}>→ {insight.action}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SmartAlertsPanel({ alerts, lastUpdated, onDismiss }: { alerts: any[]; lastUpdated: Date | null; onDismiss: () => void }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div className="pf-card" style={{ marginBottom: 14 }}>
      <div className="pf-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert style={{ width: 15, height: 15, color: "var(--pf-warning)", strokeWidth: 1.8 }} />
          <span className="pf-card-title">Smart Alerts</span>
          {lastUpdated && <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}</span>}
        </div>
        <button onClick={onDismiss} className="pf-icon-button" style={{ width: 28, height: 28 }}>
          <X style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 }}>
        {alerts.slice(0, 6).map((alert: any, i: number) => {
          const chipCls = alert.priority === "high" ? "pf-chip-error" : alert.priority === "medium" ? "pf-chip-warning" : "pf-chip-success";
          const CatIcon = CATEGORY_ICONS[alert.category] ?? Activity;
          return (
            <div key={i} style={{ background: "var(--pf-bg)", border: "1px solid var(--pf-border)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                <CatIcon style={{ width: 13, height: 13, color: "var(--pf-muted)", flexShrink: 0, strokeWidth: 1.8 }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-text)", flex: 1, minWidth: 0 }}>{alert.title}</span>
                <span className={`pf-chip ${chipCls}`} style={{ textTransform: "uppercase", fontSize: 10 }}>{alert.priority}</span>
              </div>
              <p style={{ fontSize: 12, color: "var(--pf-muted)", lineHeight: 1.45 }}>{alert.message}</p>
              {alert.action && <p style={{ fontSize: 11, color: "var(--pf-primary)", marginTop: 5 }}>→ {alert.action}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: upcomingShifts = [] } = useGetDashboardUpcomingShifts();
  const { data: compliance } = useGetDashboardComplianceOverview();
  const { data: recentActivity = [] } = useRecentActivity();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [smartAlerts, setSmartAlerts] = useState<any[]>([]);
  const [alertsLastUpdated, setAlertsLastUpdated] = useState<Date | null>(null);
  const [alertsDismissed, setAlertsDismissed] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchWithAuthJson<any>("/api/ai/smart-alerts");
        if (Array.isArray(data?.alerts) && data.alerts.length > 0) {
          setSmartAlerts(data.alerts);
          setAlertsLastUpdated(new Date());
          setAlertsDismissed(false);
        }
      } catch { /* silent */ }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  const runAI = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const data = await fetchWithAuthJson<any>("/api/ai/business-insights");
      setAiInsights(data);
    } catch (err: any) {
      setAiError(err?.message ?? "AI analysis failed. Please try again.");
    }
    setAiLoading(false);
  };

  const s = summary as any;
  const shiftsToday      = s?.shiftsToday ?? 0;
  const unfilledShifts   = s?.unfilledShiftsCount ?? 0;
  const staffOnLeave     = s?.staffOnLeaveCount ?? 0;
  const incidents        = s?.openIncidents ?? 0;
  const complianceAlerts = s?.complianceExpiringCount ?? 0;

  const todayShifts   = (upcomingShifts as any[]).filter(sh => { try { return isToday(parseISO(sh.scheduledStart)); } catch { return false; } });
  const displayShifts = todayShifts.length > 0 ? todayShifts : (upcomingShifts as any[]);

  const actionRows = [
    { label: "Unfilled shifts",    sub: "Shifts that need a staff member", count: unfilledShifts,           Icon: Users,         chipCls: "pf-chip-warning", href: "/roster" },
    { label: "Expiring documents", sub: "Staff documents expiring soon",   count: complianceAlerts,         Icon: FileText,      chipCls: "pf-chip-info",    href: "/staff" },
    { label: "Open incidents",     sub: "Incidents requiring attention",   count: incidents,                Icon: AlertTriangle, chipCls: "pf-chip-error",   href: "/incidents" },
    { label: "Pending invoices",   sub: "Awaiting submission or payment",  count: s?.pendingInvoices ?? 0,  Icon: Receipt,       chipCls: "pf-chip-info",    href: "/invoices" },
    { label: "Staff on leave",     sub: "Currently on approved leave",     count: staffOnLeave,             Icon: Clock,         chipCls: "pf-chip-warning", href: "/staff" },
  ];

  return (
    <AppLayout>
      {/* Page head */}
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Dashboard</h1>
          <p className="pf-page-desc">{format(new Date(), "EEEE, d MMMM yyyy")}</p>
        </div>
        <button
          onClick={runAI}
          disabled={aiLoading}
          className={`pf-button ${aiLoading ? "pf-button-secondary" : "pf-button-primary"}`}
          style={{ gap: 8, height: 38, flexShrink: 0 }}
        >
          {aiLoading
            ? <RefreshCw style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
            : <AIStar size={14} />}
          {aiLoading ? "Analysing…" : aiInsights ? "Refresh Analysis" : "Run AI Analysis"}
        </button>
      </div>

      {/* AI error */}
      {aiError && (
        <div className="pf-chip pf-chip-error" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, height: "auto", marginBottom: 12, fontSize: 13 }}>
          <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{aiError}</span>
          <button onClick={() => setAiError(null)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}><X style={{ width: 14, height: 14 }} /></button>
        </div>
      )}

      {/* Smart Alerts */}
      {!alertsDismissed && smartAlerts.length > 0 && (
        <SmartAlertsPanel alerts={smartAlerts} lastUpdated={alertsLastUpdated} onDismiss={() => setAlertsDismissed(true)} />
      )}

      {/* AI Insights */}
      {aiInsights && <AIInsightsPanel insights={aiInsights} onClose={() => setAiInsights(null)} />}

      {/* Today at a glance */}
      <div className="pf-card" style={{ marginBottom: 14 }}>
        <div className="pf-card-header">
          <span className="pf-card-title">Today at a glance</span>
          <span style={{ fontSize: 12, color: "var(--pf-muted)" }}>{format(new Date(), "EEEE, d MMMM")}</span>
        </div>
        <div className="pf-card-body" style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12 }}>
          {[
            { label: "Shifts today",     value: shiftsToday,      Icon: Calendar,      color: "#1d4ed8" },
            { label: "Unfilled",         value: unfilledShifts,   Icon: Users,         color: "#c2410c" },
            { label: "Staff on leave",   value: staffOnLeave,     Icon: UserCheck,     color: "#15803d" },
            { label: "Incidents open",   value: incidents,        Icon: AlertTriangle, color: "#b91c1c" },
            { label: "Compliance alerts", value: complianceAlerts, Icon: ShieldAlert,  color: "#d97706" },
          ].map(({ label, value, Icon, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--pf-text)", lineHeight: 1 }}>{value}</p>
              <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 4, fontWeight: 600 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPI grid */}
      <div className="pf-grid pf-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Participants", value: s?.totalParticipants ?? 0, sub: "Active participants",    Icon: Users,         href: "/participants" },
          { label: "Total Staff",        value: s?.totalStaff ?? 0,        sub: "Active staff members",   Icon: UserCheck,     href: "/staff" },
          { label: "Shifts Today",       value: shiftsToday,               sub: "Scheduled for today",    Icon: Calendar,      href: "/roster" },
          { label: "Pending Invoices",   value: s?.pendingInvoices ?? 0,   sub: "Awaiting processing",    Icon: Receipt,       href: "/invoices" },
          { label: "Unfilled Shifts",    value: unfilledShifts,            sub: "Need staff assigned",    Icon: Users,         href: "/roster" },
          { label: "Funding Used",       value: `$${((s?.totalFundingUtilized ?? 0) as number).toLocaleString("en-AU", { maximumFractionDigits: 0 })}`, sub: "This month", Icon: TrendingUp, href: "/service-agreements" },
          { label: "Compliance Alerts",  value: complianceAlerts,          sub: "Expiring within 30 days", Icon: ShieldAlert,  href: "/staff" },
          { label: "Open Incidents",     value: incidents,                  sub: "Requiring attention",    Icon: AlertTriangle, href: "/incidents" },
        ].map(({ label, value, sub, Icon, href }) => {
          const [, navigate] = useLocation();
          return (
            <div
              key={label}
              className="pf-card"
              onClick={() => navigate(href)}
              style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, cursor: "pointer", transition: "box-shadow .14s ease, border-color .14s ease" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "var(--pf-shadow-lift)"; el.style.borderColor = "#bfdbfe"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.boxShadow = "var(--pf-shadow)"; el.style.borderColor = "var(--pf-border)"; }}
            >
              <div className="pf-metric-icon">
                <Icon style={{ width: 18, height: 18, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)" }}>{label}</p>
                <p className="pf-metric-value" style={{ fontSize: 22 }}>{value}</p>
                <p className="pf-metric-sub">{sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule + Action Required */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 14, marginBottom: 14 }}>
        {/* Today's schedule */}
        <div className="pf-card" style={{ minWidth: 0, overflow: "hidden" }}>
          <div className="pf-card-header">
            <span className="pf-card-title">Today's Schedule</span>
            <Link href="/roster">
              <a style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-primary)", display: "flex", alignItems: "center", gap: 4 }}>
                View roster <ChevronRight style={{ width: 13, height: 13 }} />
              </a>
            </Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pf-table" style={{ minWidth: 540 }}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Participant</th>
                  <th>Support Worker</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {displayShifts.slice(0, 6).map((sh: any) => {
                  const start = sh.scheduledStart ? new Date(sh.scheduledStart) : null;
                  const end   = sh.scheduledEnd   ? new Date(sh.scheduledEnd)   : null;
                  const timeStr = (start && end)
                    ? `${format(start, "h:mma")}–${format(end, "h:mma")}`
                    : start ? format(start, "h:mma") : "—";
                  const statusChip: Record<string, string> = {
                    completed:   "pf-chip pf-chip-success",
                    in_progress: "pf-chip pf-chip-info",
                    scheduled:   "pf-chip",
                    cancelled:   "pf-chip pf-chip-error",
                  };
                  const chip = statusChip[sh.status] ?? "pf-chip";
                  return (
                    <tr key={sh.id}>
                      <td style={{ fontWeight: 700, color: "var(--pf-text)", fontSize: 12, whiteSpace: "nowrap" }}>{timeStr}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {sh.participantName && <InitialsAvatar name={sh.participantName} size={26} />}
                          <span style={{ fontWeight: 600, color: "var(--pf-text)", fontSize: 12 }}>{sh.participantName ?? "—"}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{sh.staffName ?? <span style={{ color: "var(--pf-muted)" }}>Unassigned</span>}</td>
                      <td style={{ fontSize: 12 }}>{sh.serviceType?.replace(/_/g, " ") ?? "—"}</td>
                      <td><span className={chip} style={{ textTransform: "capitalize" }}>{sh.status?.replace(/_/g, " ") ?? "—"}</span></td>
                    </tr>
                  );
                })}
                {displayShifts.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px 16px", color: "var(--pf-muted)" }}>No shifts scheduled for today</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Required */}
        <div className="pf-card">
          <div className="pf-card-header">
            <span className="pf-card-title">Action Required</span>
          </div>
          <div>
            {actionRows.map(({ label, sub, count, Icon, chipCls, href }) => {
              const [, navigate] = useLocation();
              return (
                <div
                  key={label}
                  onClick={() => navigate(href)}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", borderBottom: "1px solid var(--pf-border)", cursor: "pointer", transition: "background .12s ease" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--pf-bg)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <div className="pf-metric-icon" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color: "var(--pf-muted)", strokeWidth: 1.8 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-text)" }}>{label}</p>
                    <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 1 }}>{sub}</p>
                  </div>
                  <span className={`pf-chip ${chipCls}`} style={{ fontSize: 13, fontWeight: 800, height: 26 }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: Compliance + Activity */}
      <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0,1fr)", gap: 14 }}>
        {/* Compliance snapshot */}
        <div className="pf-card">
          <div className="pf-card-header">
            <span className="pf-card-title">Compliance Snapshot</span>
            <Link href="/compliance">
              <a style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-primary)" }}>View →</a>
            </Link>
          </div>
          <div className="pf-card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, textAlign: "center" }}>
            {[
              { label: "Compliant",      value: (compliance as any)?.compliant ?? 0,     color: "#15803d" },
              { label: "Expiring Soon",  value: (compliance as any)?.expiringSoon ?? 0,   color: "#d97706" },
              { label: "Expired",        value: (compliance as any)?.expired ?? 0,         color: "#b91c1c" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: "var(--pf-bg)", border: "1px solid var(--pf-border)", borderRadius: 10, padding: "14px 10px" }}>
                <p style={{ fontSize: 24, fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</p>
                <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 3, fontWeight: 600 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="pf-card" style={{ minWidth: 0 }}>
          <div className="pf-card-header">
            <span className="pf-card-title">Recent Activity</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="pf-table" style={{ minWidth: 400 }}>
              <thead><tr><th>Event</th><th>When</th></tr></thead>
              <tbody>
                {(recentActivity as any[]).slice(0, 8).map((item: any) => {
                  const { Icon, bg, color } = activityIcon(item.entityType);
                  return (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Icon style={{ width: 13, height: 13, color, strokeWidth: 1.8 }} />
                          </div>
                          <span style={{ fontSize: 12, color: "var(--pf-text-soft)" }}>{item.text}</span>
                        </div>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12, color: "var(--pf-muted)" }}>
                        {item.time ? formatDistanceToNow(new Date(item.time), { addSuffix: true }) : ""}
                      </td>
                    </tr>
                  );
                })}
                {(recentActivity as any[]).length === 0 && (
                  <tr><td colSpan={2} style={{ textAlign: "center", padding: "32px 16px", color: "var(--pf-muted)" }}>No recent activity</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
