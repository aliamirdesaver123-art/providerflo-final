import AppLayout from "@/components/layout/AppLayout";
import { useListParticipants, useListStaff, useListShifts } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { Download, TrendingUp, Users, Clock, DollarSign, FileText, AlertTriangle, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const CAT_COLORS: Record<string, string> = {
  Participants: "bg-blue-100 text-blue-700",
  Staff: "bg-purple-100 text-purple-700",
  Compliance: "bg-red-100 text-red-700",
  Finance: "bg-green-100 text-green-700",
  Clinical: "bg-teal-100 text-teal-700",
};

const REPORT_TYPES = [
  { title: "Participant Summary Report", desc: "Overview of all participants, their plans, and funding utilisation.", category: "Participants" },
  { title: "Staff Hours Report", desc: "Detailed breakdown of staff hours by week, participant, and service type.", category: "Staff" },
  { title: "Incident Summary Report", desc: "All incidents recorded, severity analysis, and resolution status.", category: "Compliance" },
  { title: "NDIS Claiming Report", desc: "Shift data formatted for NDIS portal bulk upload submission.", category: "Finance" },
  { title: "Service Agreement Utilisation", desc: "Funding usage, remaining balances, and projected depletion dates.", category: "Finance" },
  { title: "Compliance Status Report", desc: "Staff compliance documents — expired, expiring, and valid items.", category: "Compliance" },
  { title: "Timesheet Approval Report", desc: "Weekly timesheet statuses across all staff members.", category: "Staff" },
  { title: "Case Notes Summary", desc: "Case note activity by participant and staff over a selected period.", category: "Clinical" },
];

const CHART_COLORS = ["#1a6fe8", "#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#f97316"];

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] gap-2">
      <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground">No data yet — {label} will appear here once shifts are recorded</p>
    </div>
  );
}

export default function Reports() {
  const { toast } = useToast();
  const { data: participants = [] } = useListParticipants();
  const { data: staff = [] } = useListStaff();

  const now = new Date();
  const sixMonthsAgo = subMonths(now, 6);
  const { data: allShifts = [] } = useListShifts({
    startDate: format(sixMonthsAgo, "yyyy-MM-dd"),
    endDate: format(now, "yyyy-MM-dd"),
  });

  const shifts = allShifts as any[];

  const thisMonthStart = startOfMonth(now);
  const thisMonthShifts = shifts.filter((s: any) => {
    const d = new Date(s.scheduledStart || s.date || "");
    return d >= thisMonthStart && d <= endOfMonth(now);
  });

  const totalHoursThisMonth = useMemo(() => {
    return thisMonthShifts.reduce((sum: number, s: any) => {
      if (!s.scheduledStart || !s.scheduledEnd) return sum;
      const hrs = (new Date(s.scheduledEnd).getTime() - new Date(s.scheduledStart).getTime()) / 3600000;
      return sum + Math.max(0, hrs);
    }, 0);
  }, [thisMonthShifts]);

  const totalRevenueThisMonth = useMemo(() => {
    return thisMonthShifts.reduce((sum: number, s: any) => sum + (Number(s.totalCost) || 0), 0);
  }, [thisMonthShifts]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { hours: number; revenue: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      months[format(m, "MMM")] = { hours: 0, revenue: 0 };
    }
    shifts.forEach((s: any) => {
      if (!s.scheduledStart) return;
      const key = format(new Date(s.scheduledStart), "MMM");
      if (!months[key]) return;
      const hrs = s.scheduledEnd
        ? (new Date(s.scheduledEnd).getTime() - new Date(s.scheduledStart).getTime()) / 3600000
        : 0;
      months[key].hours += Math.round(Math.max(0, hrs) * 10) / 10;
      months[key].revenue += Number(s.totalCost) || 0;
    });
    return Object.entries(months).map(([month, v]) => ({ month, ...v }));
  }, [shifts]);

  const serviceCategories = useMemo(() => {
    const counts: Record<string, number> = {};
    shifts.forEach((s: any) => {
      const t = s.serviceType || s.service_type || "Other";
      counts[t] = (counts[t] || 0) + 1;
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(counts)
      .map(([name, count], i) => ({ name, value: Math.round((count / total) * 100), color: CHART_COLORS[i % CHART_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [shifts]);

  const staffHours = useMemo(() => {
    const staffMap = staff as any[];
    const hours: Record<number, number> = {};
    thisMonthShifts.forEach((s: any) => {
      if (!s.staffId && !s.staff_id) return;
      const id = s.staffId || s.staff_id;
      const hrs = s.scheduledStart && s.scheduledEnd
        ? (new Date(s.scheduledEnd).getTime() - new Date(s.scheduledStart).getTime()) / 3600000
        : 0;
      hours[id] = (hours[id] || 0) + Math.max(0, hrs);
    });
    return Object.entries(hours)
      .map(([id, hrs]) => {
        const member = staffMap.find((m: any) => m.id === Number(id));
        const name = member ? `${member.firstName || member.first_name} ${member.lastName || member.last_name}` : `Staff #${id}`;
        return { name, hours: Math.round(hrs * 10) / 10 };
      })
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6);
  }, [thisMonthShifts, staff]);

  const hasMonthlyData = monthlyData.some(m => m.hours > 0);
  const hasCategoryData = serviceCategories.length > 0;
  const hasStaffData = staffHours.length > 0;

  const handleExportAll = useCallback(() => {
    try {
      const participantRows = [
        ["=== PARTICIPANTS ==="],
        ["Name", "NDIS Number", "Status", "Funding Type", "Plan Start", "Plan End", "Total Funding"],
        ...(participants as any[]).map(p => [
          `${p.firstName} ${p.lastName}`, p.ndisNumber, p.status, p.fundingType,
          p.planStartDate ?? "", p.planEndDate ?? "", p.totalFunding ?? "",
        ]),
        [],
        ["=== STAFF ==="],
        ["Name", "Email", "Position", "Employment Type", "Status", "Hourly Rate"],
        ...(staff as any[]).map(s => [
          `${s.firstName} ${s.lastName}`, s.email, s.position, s.employmentType,
          s.status, s.hourlyRate ?? "",
        ]),
        [],
        ["=== SHIFTS (Last 6 Months) ==="],
        ["Date", "Participant", "Staff", "Service Type", "Start", "End", "Status", "Cost"],
        ...shifts.map((s: any) => [
          s.date ?? s.scheduledStart?.slice(0, 10) ?? "",
          s.participantName ?? "",
          s.staffName ?? "",
          s.serviceType ?? "",
          s.scheduledStart?.slice(11, 16) ?? "",
          s.scheduledEnd?.slice(11, 16) ?? "",
          s.status ?? "",
          s.totalCost ?? "",
        ]),
      ];
      downloadCsv(`providerflo-full-export-${format(now, "yyyy-MM-dd")}.csv`, participantRows);
      toast({ title: "All reports exported successfully" });
    } catch (err: any) {
      toast({ title: `Export failed: ${err.message}`, variant: "destructive" });
    }
  }, [participants, staff, shifts, now, toast]);

  const handleDownloadReport = useCallback((reportTitle: string) => {
    try {
      const title = reportTitle.toLowerCase();
      let rows: string[][] = [];
      if (title.includes("participant")) {
        rows = [
          ["Participant Summary Report", format(now, "d MMM yyyy")],
          [],
          ["Name", "NDIS Number", "Status", "Funding Type", "Plan Start", "Plan End", "Total Funding ($)", "Used Funding ($)"],
          ...(participants as any[]).map(p => [
            `${p.firstName} ${p.lastName}`, p.ndisNumber, p.status, p.fundingType,
            p.planStartDate ?? "", p.planEndDate ?? "",
            p.totalFunding ?? "0", p.usedFunding ?? "0",
          ]),
        ];
      } else if (title.includes("staff hours")) {
        rows = [
          ["Staff Hours Report", format(now, "d MMM yyyy")],
          [],
          ["Staff Name", "Position", "Hours This Month"],
          ...staffHours.map(s => [s.name, "", s.hours.toFixed(1)]),
        ];
      } else if (title.includes("incident")) {
        rows = [["Incident Summary Report", format(now, "d MMM yyyy")], [], ["Report", "Note"], [reportTitle, "Please export via Incidents page for full data"]];
      } else if (title.includes("ndis claiming") || title.includes("claiming")) {
        rows = [
          ["NDIS Claiming Report", format(now, "d MMM yyyy")],
          [],
          ["Date", "Participant", "Staff", "Service Type", "Hours", "Total Cost"],
          ...shifts.filter((s: any) => s.status === "completed").map((s: any) => [
            s.scheduledStart?.slice(0, 10) ?? "",
            s.participantName ?? "",
            s.staffName ?? "",
            s.serviceType ?? "",
            s.scheduledStart && s.scheduledEnd
              ? ((new Date(s.scheduledEnd).getTime() - new Date(s.scheduledStart).getTime()) / 3600000).toFixed(2)
              : "",
            s.totalCost ?? "",
          ]),
        ];
      } else if (title.includes("timesheet")) {
        rows = [
          ["Timesheet Approval Report", format(now, "d MMM yyyy")],
          [],
          ["Staff Name", "Email", "Total Shifts", "Completed Shifts"],
          ...(staff as any[]).map(s => {
            const name = `${s.firstName} ${s.lastName}`;
            const staffShifts = shifts.filter((sh: any) => sh.staffId === s.id || sh.staffName === name);
            return [name, s.email, staffShifts.length, staffShifts.filter((sh: any) => sh.status === "completed").length];
          }),
        ];
      } else {
        rows = [
          [reportTitle, format(now, "d MMM yyyy")],
          [],
          ["Report generated by ProviderFlo", `${format(now, "h:mm a, d MMM yyyy")}`],
        ];
      }
      const filename = `${reportTitle.toLowerCase().replace(/\s+/g, "-")}-${format(now, "yyyy-MM-dd")}.csv`;
      downloadCsv(filename, rows);
      toast({ title: `"${reportTitle}" downloaded` });
    } catch (err: any) {
      toast({ title: `Download failed: ${err.message}`, variant: "destructive" });
    }
  }, [participants, staff, shifts, staffHours, now, toast]);

  const statCards = [
    { label: "Total Participants", value: (participants as any[]).length, icon: Users, color: "text-blue-500", bg: "bg-blue-50", sub: (participants as any[]).length === 0 ? "No participants yet" : "Active NDIS participants" },
    { label: "Total Staff", value: (staff as any[]).length, icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-50", sub: (staff as any[]).length === 0 ? "No staff added yet" : "Registered workers" },
    { label: "Hours This Month", value: totalHoursThisMonth > 0 ? `${Math.round(totalHoursThisMonth)}h` : "0h", icon: Clock, color: "text-teal-500", bg: "bg-teal-50", sub: `${format(now, "MMMM yyyy")}` },
    { label: "Revenue This Month", value: totalRevenueThisMonth > 0 ? `$${totalRevenueThisMonth.toLocaleString("en-AU", { maximumFractionDigits: 0 })}` : "$0", icon: DollarSign, color: "text-green-500", bg: "bg-green-50", sub: "NDIS billed services" },
    { label: "Shifts This Month", value: thisMonthShifts.length, icon: FileText, color: "text-orange-500", bg: "bg-orange-50", sub: thisMonthShifts.length === 0 ? "No shifts scheduled" : "Scheduled & completed" },
    { label: "Total Shifts (6 Months)", value: shifts.length, icon: AlertTriangle, color: "text-indigo-500", bg: "bg-indigo-50", sub: `Last 6 months` },
  ];

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Reports</h1>
          <p className="pf-page-desc">Analytics and reporting for {format(now, "MMMM yyyy")}</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={handleExportAll}><Download className="w-4 h-4" />Export All</Button>
      </div>

      <div className="pf-grid pf-grid-3" style={{ marginBottom: 14 }}>
        {statCards.map(s => (
          <div key={s.label} className="pf-card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px" }}>
            <div className="pf-metric-icon" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}>
              <s.icon style={{ width: 18, height: 18, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
            </div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.03em", lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-text-soft)", marginTop: 2 }}>{s.label}</p>
              <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pf-grid pf-grid-2" style={{ marginBottom: 14 }}>
        <div className="pf-card">
          <div className="pf-card-header"><span className="pf-card-title">Monthly Hours &amp; Revenue</span></div>
          <div className="pf-card-body">
            {hasMonthlyData ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pf-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--pf-muted)" }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "var(--pf-muted)" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "var(--pf-muted)" }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any, n: string) => n === "hours" ? [`${v}h`, "Hours"] : [`$${Number(v).toLocaleString()}`, "Revenue"]} />
                  <Bar yAxisId="left" dataKey="hours" fill="var(--pf-primary)" radius={[3, 3, 0, 0]} name="hours" />
                  <Bar yAxisId="right" dataKey="revenue" fill="var(--pf-ai)" radius={[3, 3, 0, 0]} name="revenue" />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="hours and revenue" />}
          </div>
        </div>

        <div className="pf-card">
          <div className="pf-card-header"><span className="pf-card-title">Support Categories</span></div>
          <div className="pf-card-body">
            {hasCategoryData ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={serviceCategories} cx="50%" cy="50%" innerRadius={45} outerRadius={72} dataKey="value">
                      {serviceCategories.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v}%`, ""]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  {serviceCategories.map(c => (
                    <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                      <span style={{ color: "var(--pf-muted)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                      <span style={{ fontWeight: 700, color: "var(--pf-text)" }}>{c.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyChart label="service category breakdown" />}
          </div>
        </div>

        <div className="pf-card">
          <div className="pf-card-header"><span className="pf-card-title">Staff Hours (This Month)</span></div>
          <div className="pf-card-body">
            {hasStaffData ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={staffHours} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pf-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--pf-muted)" }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--pf-muted)" }} width={100} />
                  <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                  <Bar dataKey="hours" fill="var(--pf-primary)" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="staff hours" />}
          </div>
        </div>

        <div className="pf-card">
          <div className="pf-card-header"><span className="pf-card-title">Monthly Shift Volume</span></div>
          <div className="pf-card-body">
            {hasMonthlyData ? (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pf-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--pf-muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--pf-muted)" }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} />
                  <Line type="monotone" dataKey="hours" stroke="var(--pf-primary)" strokeWidth={2} dot={{ r: 3, fill: "var(--pf-primary)" }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="monthly shift trends" />}
          </div>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: "var(--pf-text)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".04em" }}>Available Reports</h3>
        <div className="pf-grid pf-grid-2">
          {REPORT_TYPES.map(r => (
            <div key={r.title} className="pf-card" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div className="pf-metric-icon" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}>
                  <FileText style={{ width: 15, height: 15, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{r.title}</p>
                  <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 2 }}>{r.desc}</p>
                  <span className="pf-chip" style={{ marginTop: 6, display: "inline-block" }}>{r.category}</span>
                </div>
              </div>
              <button onClick={() => handleDownloadReport(r.title)} className="pf-icon-button" style={{ flexShrink: 0 }} title={`Download ${r.title}`}>
                <Download style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
