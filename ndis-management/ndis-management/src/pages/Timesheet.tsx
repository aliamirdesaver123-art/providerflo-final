import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { useListStaff } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, parseISO, differenceInMinutes } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, CheckCircle, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

function getInitials(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
function hslFromName(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return `hsl(${h}, 55%, 45%)`; }

const DAY_KEYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const STATUS_STYLES: Record<string, string> = {
  approved: "bg-green-100 text-green-700 border-blue-200",
  submitted: "bg-blue-100 text-blue-700 border-blue-200",
  draft: "bg-yellow-100 text-yellow-700 border-yellow-200",
  nil: "bg-transparent text-muted-foreground",
};

function useShiftsForWeek(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["shifts-timesheet", startDate, endDate],
    queryFn: () =>
      fetchWithAuth(`/api/shifts?startDate=${startDate}&endDate=${endDate}`)
        .then(r => {
          if (!r.ok) throw new Error(`Failed to load shifts (${r.status})`);
          return r.json();
        })
        .then(d => Array.isArray(d) ? d : []),
  });
}

export default function Timesheet() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const { data: staff = [] } = useListStaff();
  const { toast } = useToast();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startDate = format(weekStart, "yyyy-MM-dd");
  const endDate = format(addDays(weekStart, 6), "yyyy-MM-dd");
  const { data: shifts = [] } = useShiftsForWeek(startDate, endDate);

  const staffList = (staff as any[]);
  const shiftList = (shifts as any[]);

  function getEntryForStaffDay(staffId: number, staffName: string, dayIdx: number): { hours: number; status: string; start?: string; end?: string } {
    const dayStr = format(days[dayIdx], "yyyy-MM-dd");
    const dayShifts = shiftList.filter(
      s => (s.staffId === staffId || s.staffName === staffName) && (s.scheduledStart?.startsWith(dayStr) || s.date?.startsWith(dayStr))
    );
    if (dayShifts.length === 0) return { hours: 0, status: "nil" };
    const totalMins = dayShifts.reduce((sum: number, s: any) => {
      try {
        if (s.scheduledStart && s.scheduledEnd) {
          return sum + differenceInMinutes(parseISO(s.scheduledEnd), parseISO(s.scheduledStart));
        }
        return sum;
      } catch { return sum; }
    }, 0);
    const hours = totalMins / 60;
    const first = dayShifts[0];
    const status = first.status === "completed" ? "approved" : first.status === "in_progress" ? "draft" : "submitted";
    return {
      hours,
      status,
      start: first.scheduledStart?.slice(11, 16),
      end: dayShifts[dayShifts.length - 1].scheduledEnd?.slice(11, 16),
    };
  }

  const totalHoursForStaff = (id: number, name: string) =>
    DAY_KEYS.reduce((sum, _, i) => sum + getEntryForStaffDay(id, name, i).hours, 0);
  const totalApprovedForStaff = (id: number, name: string) =>
    DAY_KEYS.reduce((sum, _, i) => { const e = getEntryForStaffDay(id, name, i); return e.status === "approved" ? sum + e.hours : sum; }, 0);

  const grandTotal = staffList.reduce((sum, s) => sum + totalHoursForStaff(s.id, `${s.firstName} ${s.lastName}`), 0);
  const grandApproved = staffList.reduce((sum, s) => sum + totalApprovedForStaff(s.id, `${s.firstName} ${s.lastName}`), 0);
  const pendingCount = staffList.filter(s =>
    DAY_KEYS.some((_, i) => getEntryForStaffDay(s.id, `${s.firstName} ${s.lastName}`, i).status === "submitted")
  ).length;

  const handleExport = () => {
    try {
      const weekLabel = format(weekStart, "yyyy-MM-dd");
      const headers = ["Staff Name", "Email", "Position", ...days.map(d => format(d, "EEE d MMM")), "Total Hours", "Approved Hours"];
      const rows = staffList.map(s => {
        const name = `${s.firstName} ${s.lastName}`;
        const dayEntries = days.map((_, i) => {
          const e = getEntryForStaffDay(s.id, name, i);
          return e.hours > 0 ? `${e.hours.toFixed(1)}h (${e.status})` : "-";
        });
        return [
          name,
          s.email ?? "",
          s.position ?? "",
          ...dayEntries,
          totalHoursForStaff(s.id, name).toFixed(1),
          totalApprovedForStaff(s.id, name).toFixed(1),
        ];
      });
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheet-${weekLabel}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: `Timesheet exported for week of ${format(weekStart, "d MMM yyyy")}` });
    } catch (err: any) {
      toast({ title: `Export failed: ${err.message}`, variant: "destructive" });
    }
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Timesheet</h1>
          <p className="pf-page-desc">Week of {format(weekStart, "d MMM yyyy")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", background: "var(--pf-surface)", border: "1px solid var(--pf-border)", borderRadius: 8, overflow: "hidden" }}>
            <button onClick={() => setWeekStart(d => addDays(d, -7))} style={{ padding: "6px 8px", background: "none", border: "none", cursor: "pointer", color: "var(--pf-text-soft)", display: "flex", alignItems: "center" }}><ChevronLeft style={{ width: 16, height: 16 }} /></button>
            <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))} style={{ padding: "6px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "var(--pf-text-soft)" }}>This Week</button>
            <button onClick={() => setWeekStart(d => addDays(d, 7))} style={{ padding: "6px 8px", background: "none", border: "none", cursor: "pointer", color: "var(--pf-text-soft)", display: "flex", alignItems: "center" }}><ChevronRight style={{ width: 16, height: 16 }} /></button>
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExport}><Download className="w-4 h-4" />Export CSV</Button>
        </div>
      </div>

      <div className="pf-grid pf-grid-4" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Hours",      value: grandTotal.toFixed(1) + "h",    icon: Clock },
          { label: "Approved Hours",   value: grandApproved.toFixed(1) + "h", icon: CheckCircle },
          { label: "Pending Approval", value: `${pendingCount} staff`,         icon: AlertCircle },
          { label: "Staff on Roster",  value: staffList.length.toString(),     icon: AlertCircle },
        ].map(s => (
          <div key={s.label} className="pf-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px" }}>
            <div className="pf-metric-icon" style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}>
              <s.icon style={{ width: 16, height: 16, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
            </div>
            <div>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--pf-text)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>{s.value}</p>
              <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="pf-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="pf-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Staff Member</th>
                {days.map(d => (
                  <th key={d.toISOString()} style={{ textAlign: "center" }}>
                    <div style={{ fontWeight: 600, color: "var(--pf-muted)" }}>{format(d, "EEE")}</div>
                    <div style={{ fontWeight: 800, color: "var(--pf-text)" }}>{format(d, "d")}</div>
                  </th>
                ))}
                <th style={{ textAlign: "center" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {staffList.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "48px 16px", textAlign: "center", color: "var(--pf-muted)", fontSize: 13 }}>No staff members found</td></tr>
              ) : staffList.map(s => {
                const name = `${s.firstName} ${s.lastName}`;
                const total = totalHoursForStaff(s.id, name);
                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800, flexShrink: 0, background: hslFromName(name) }}>
                          {getInitials(name)}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{name}</p>
                          <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{s.position}</p>
                        </div>
                      </div>
                    </td>
                    {days.map((_, i) => {
                      const entry = getEntryForStaffDay(s.id, name, i);
                      return (
                        <td key={i} style={{ textAlign: "center" }}>
                          {entry.status !== "nil" ? (
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--pf-text)" }}>{entry.hours.toFixed(1)}h</span>
                              {entry.start && <span style={{ fontSize: 10, color: "var(--pf-muted)" }}>{entry.start}–{entry.end}</span>}
                              <span className={cn("pf-chip", entry.status === "approved" ? "pf-chip-success" : entry.status === "submitted" ? "pf-chip-info" : "pf-chip-warning")} style={{ fontSize: 10 }}>
                                {entry.status}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "var(--pf-muted)", fontSize: 12 }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: total > 0 ? "var(--pf-text)" : "var(--pf-muted)" }}>
                        {total > 0 ? `${total.toFixed(1)}h` : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--pf-surface)", borderTop: "2px solid var(--pf-border)" }}>
                <td style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)" }}>Weekly Total</td>
                {days.map((_, i) => {
                  const dayTotal = staffList.reduce((sum, s) => sum + getEntryForStaffDay(s.id, `${s.firstName} ${s.lastName}`, i).hours, 0);
                  return (
                    <td key={i} style={{ textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: dayTotal > 0 ? "var(--pf-text)" : "var(--pf-muted)" }}>
                        {dayTotal > 0 ? `${dayTotal.toFixed(1)}h` : "—"}
                      </span>
                    </td>
                  );
                })}
                <td style={{ textAlign: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "var(--pf-text)" }}>{grandTotal.toFixed(1)}h</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
