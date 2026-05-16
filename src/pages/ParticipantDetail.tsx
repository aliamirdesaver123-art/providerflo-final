import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useGetParticipant, useGetParticipantGoals, useGetParticipantContacts, useListShifts, useListCaseNotes } from "@workspace/api-client-react";
import { getGetParticipantQueryKey, getGetParticipantGoalsQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, User, Phone, Mail, MapPin, Calendar, FileText, Sparkles, RefreshCw, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { fetchWithAuthJson } from "@/lib/fetchWithAuth";
import type { ParticipantGoal, Shift, CaseNote, ParticipantContact } from "@/types/entities";


const RISK_COLORS: Record<string, { bg: string; text: string; border: string; Icon: React.ElementType }> = {
  critical: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", Icon: AlertTriangle },
  high:     { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA", Icon: AlertTriangle },
  medium:   { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A", Icon: AlertTriangle },
  low:      { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC", Icon: CheckCircle2 },
  unknown:  { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1", Icon: AlertTriangle },
};

const PROGRESS_COLORS: Record<string, string> = {
  strong:   "text-green-600",
  moderate: "text-blue-600",
  limited:  "text-amber-600",
  declining:"text-red-600",
};

function AIOutcomesTab({ participantId }: { participantId: number }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuthJson<any>(`/api/ai/participant-outcomes/${participantId}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate outcomes");
    }
    setLoading(false);
  };

  if (!result && !loading) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary/40" />
        <p className="font-medium text-foreground mb-1">AI Outcome Intelligence</p>
        <p className="text-sm text-muted-foreground mb-4">Analyse case notes, goals and shift history to generate outcome insights</p>
        <Button onClick={run} className="gap-2">
          <Sparkles className="w-4 h-4" />
          Run Outcome Analysis
        </Button>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
        <p className="text-muted-foreground">Analysing participant outcomes…</p>
      </div>
    );
  }

  const progColor = PROGRESS_COLORS[result?.overallProgress] ?? "text-foreground";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-300" />
              <span className="text-xs font-bold text-blue-300 uppercase tracking-widest">AI Outcome Analysis</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{result.summary}</p>
          </div>
          <div className="text-center shrink-0">
            <div className="w-16 h-16 rounded-xl bg-white/10 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{result.progressScore ?? 0}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Progress Score</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4">
          {[
            { label: "Completed Shifts", value: result.stats?.completedShifts ?? 0 },
            { label: "Case Notes", value: result.stats?.recentNotes ?? 0 },
            { label: "Support Hours", value: `${result.stats?.totalHours ?? 0}h` },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xl font-bold text-white">{value}</p>
              <p className="text-xs text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Goal progress */}
        {(result.goalProgress ?? []).length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-3 text-sm">Goal Area Insights</h3>
            <div className="space-y-2.5">
              {result.goalProgress.map((g: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${g.sentiment === "positive" ? "bg-green-500" : g.sentiment === "concerning" ? "bg-red-500" : "bg-amber-500"}`} />
                  <div>
                    <p className="text-xs font-semibold text-foreground">{g.goalArea}</p>
                    <p className="text-xs text-muted-foreground">{g.insight}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* Strengths */}
          {(result.strengths ?? []).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <h3 className="font-semibold text-green-800 text-sm mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />Strengths
              </h3>
              <ul className="space-y-1">
                {result.strengths.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-green-700 flex items-start gap-1.5">
                    <span className="mt-0.5">✓</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {/* Concerns */}
          {(result.concerns ?? []).length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="font-semibold text-amber-800 text-sm mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />Concerns
              </h3>
              <ul className="space-y-1">
                {result.concerns.map((c: string, i: number) => (
                  <li key={i} className="text-xs text-amber-700">• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {(result.recommendations ?? []).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 text-sm mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((r: string, i: number) => (
              <li key={i} className="text-sm text-blue-700">→ {r}</li>
            ))}
          </ul>
          {result.nextReviewNote && (
            <p className="text-xs text-blue-600 mt-3 pt-3 border-t border-blue-200">
              <strong>Next review focus:</strong> {result.nextReviewNote}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Refresh Analysis
        </Button>
      </div>
    </div>
  );
}

function FundingForecastTab({ participantId }: { participantId: number }) {
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<any>(null);
  const [error,   setError]   = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuthJson<any>(`/api/ai/funding-forecast/${participantId}`);
      setResult(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to generate forecast");
    }
    setLoading(false);
  };

  if (!result && !loading) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <TrendingDown className="w-8 h-8 mx-auto mb-3 text-primary/40" />
        <p className="font-medium text-foreground mb-1">Live Funding Forecast</p>
        <p className="text-sm text-muted-foreground mb-4">Project funding depletion based on current spend rate</p>
        <Button onClick={run} className="gap-2">
          <TrendingDown className="w-4 h-4" />
          Generate Forecast
        </Button>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12 bg-card border border-border rounded-xl">
        <RefreshCw className="w-8 h-8 mx-auto mb-3 text-primary animate-spin" />
        <p className="text-muted-foreground">Computing funding forecast…</p>
      </div>
    );
  }

  const risk = result?.riskLevel ?? "unknown";
  const rc = RISK_COLORS[risk] ?? RISK_COLORS.unknown;
  const RiskIcon = rc.Icon;
  const pct = result?.utilizationPct ?? 0;

  return (
    <div className="space-y-4">
      {/* Risk header */}
      <div className="rounded-xl p-5 border" style={{ background: rc.bg, borderColor: rc.border }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <RiskIcon className="w-4 h-4" style={{ color: rc.text }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: rc.text }}>
                {risk.toUpperCase()} FUNDING RISK
              </span>
            </div>
            <p className="text-sm font-medium" style={{ color: rc.text }}>{result.keyAlert}</p>
          </div>
          {result.daysRemaining !== null && (
            <div className="text-right shrink-0">
              <p className="text-3xl font-black" style={{ color: rc.text }}>{result.daysRemaining}</p>
              <p className="text-xs" style={{ color: rc.text }}>days remaining</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Funding", value: `$${(result.totalFunding ?? 0).toLocaleString("en-AU")}`, sub: "NDIS plan total" },
          { label: "Remaining", value: `$${(result.remainingFunding ?? 0).toLocaleString("en-AU")}`, sub: `${pct}% utilised` },
          { label: "Weekly Burn Rate", value: `$${(result.weeklyBurnRate ?? 0).toLocaleString("en-AU")}`, sub: "Based on 30-day spend" },
          { label: "Projected Depletion", value: result.projectedDepletionDate ?? "N/A", sub: result.planEndDate ? `Plan ends ${result.planEndDate}` : "No plan end date" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
            <p className="text-lg font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Utilisation bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex justify-between text-sm font-medium mb-2">
          <span className="text-foreground">Funding Utilisation</span>
          <span className="text-foreground">{pct}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 90 ? "#DC2626" : pct >= 75 ? "#F59E0B" : "#22C55E" }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>$0</span>
          <span>${(result.totalFunding ?? 0).toLocaleString("en-AU")}</span>
        </div>
      </div>

      {/* AI commentary */}
      {result.commentary && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <h3 className="font-semibold text-foreground text-sm mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI Funding Analysis
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{result.commentary}</p>
        </div>
      )}

      {/* Recommendations */}
      {(result.recommendations ?? []).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <h3 className="font-semibold text-blue-800 text-sm mb-2">Recommendations</h3>
          <ul className="space-y-1">
            {result.recommendations.map((r: string, i: number) => (
              <li key={i} className="text-sm text-blue-700">→ {r}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={run} disabled={loading} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />Refresh Forecast
        </Button>
      </div>
    </div>
  );
}

export default function ParticipantDetail() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = parseInt(idParam ?? "0", 10);

  const { data: participant, isLoading } = useGetParticipant(id, {
    query: { queryKey: getGetParticipantQueryKey(id) },
  });
  const { data: goals } = useGetParticipantGoals(id, {
    query: { queryKey: getGetParticipantGoalsQueryKey(id) },
  });
  const { data: contacts } = useGetParticipantContacts(id);
  const { data: shifts } = useListShifts({ participantId: id });
  const { data: notes } = useListCaseNotes({ participantId: id });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="h-6 w-48 bg-muted animate-pulse rounded mb-6" />
          <div className="bg-card border border-border rounded-xl p-6 animate-pulse space-y-3">
            <div className="h-8 w-64 bg-muted rounded" />
            <div className="h-4 w-40 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!participant) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Participant not found</p>
        </div>
      </AppLayout>
    );
  }

  const totalFunding = participant.totalFunding as number || 0;
  const usedFunding = participant.usedFunding as number || 0;
  const utilizationPercent = totalFunding > 0 ? Math.round((usedFunding / totalFunding) * 100) : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <Link href="/participants">
          <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm cursor-pointer transition-colors w-fit">
            <ArrowLeft className="w-4 h-4" />
            Back to Participants
          </div>
        </Link>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-lg">{participant.firstName[0]}{participant.lastName[0]}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{participant.firstName} {participant.lastName}</h1>
                <p className="text-muted-foreground text-sm">NDIS: <span className="font-mono">{participant.ndisNumber}</span></p>
                {participant.primaryDiagnosis && <p className="text-sm text-muted-foreground mt-0.5">{participant.primaryDiagnosis}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status={participant.status} />
                  <StatusBadge status={participant.fundingType} />
                </div>
              </div>
            </div>
            {totalFunding > 0 && (
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Funding Utilized</p>
                <p className="text-2xl font-bold text-foreground">{utilizationPercent}%</p>
                <div className="w-32 bg-muted rounded-full h-2 mt-1">
                  <div
                    className={`h-2 rounded-full ${utilizationPercent >= 90 ? "bg-red-500" : utilizationPercent >= 75 ? "bg-yellow-500" : "bg-green-500"}`}
                    style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">${usedFunding.toLocaleString("en-AU")} / ${totalFunding.toLocaleString("en-AU")}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-5 border-t border-border">
            {participant.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{participant.phone}</span>
              </div>
            )}
            {participant.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{participant.email}</span>
              </div>
            )}
            {participant.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{participant.address}{participant.suburb ? `, ${participant.suburb}` : ""}</span>
              </div>
            )}
            {participant.planEndDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">Plan ends: {participant.planEndDate}</span>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">Goals ({goals?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="shifts" data-testid="tab-shifts">Shifts ({shifts?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Case Notes ({notes?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
            <TabsTrigger value="outcomes" data-testid="tab-outcomes">✨ Outcomes</TabsTrigger>
            <TabsTrigger value="forecast" data-testid="tab-forecast">📈 Funding Forecast</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-3">Plan Information</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Plan Start</dt><dd>{participant.planStartDate ?? "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Plan End</dt><dd>{participant.planEndDate ?? "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Funding Type</dt><dd><StatusBadge status={participant.fundingType} /></dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Total Funding</dt><dd>${totalFunding.toLocaleString("en-AU")}</dd></div>
                </dl>
              </div>
              {(participant.supportCoordinatorName || participant.planManagerName) && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-3">Support Team</h3>
                  <dl className="space-y-2 text-sm">
                    {participant.supportCoordinatorName && (
                      <div><dt className="text-muted-foreground text-xs">Support Coordinator</dt><dd className="font-medium">{participant.supportCoordinatorName}</dd></div>
                    )}
                    {participant.planManagerName && (
                      <div><dt className="text-muted-foreground text-xs">Plan Manager</dt><dd className="font-medium">{participant.planManagerName}</dd></div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="goals" className="mt-4">
            <div className="bg-card border border-border rounded-xl">
              {goals?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No goals recorded</div>
              ) : (
                <div className="divide-y divide-border">
                  {(goals as ParticipantGoal[] | undefined)?.map((goal: ParticipantGoal) => (
                    <div key={goal.id} data-testid={`goal-${goal.id}`} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground text-sm">{goal.goalArea}</p>
                          <p className="text-sm text-muted-foreground mt-1">{goal.description}</p>
                          {goal.notes && <p className="text-xs text-muted-foreground mt-1">{goal.notes}</p>}
                        </div>
                        <StatusBadge status={goal.progress} />
                      </div>
                      {goal.targetDate && <p className="text-xs text-muted-foreground mt-2">Target: {goal.targetDate}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="shifts" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Hours</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shifts?.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No shifts recorded</td></tr>
                  ) : (
                    (shifts as Shift[] | undefined)?.slice(0, 20).map((shift: Shift) => (
                      <tr key={shift.id} data-testid={`shift-${shift.id}`} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm text-foreground">{shift.scheduledStart.slice(0, 10)}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{shift.staffName}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{shift.serviceType ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{shift.totalHours ? `${(shift.totalHours as number).toFixed(2)}h` : "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={shift.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <div className="space-y-3">
              {notes?.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">No case notes recorded</div>
              ) : (
                (notes as CaseNote[] | undefined)?.slice(0, 15).map((note: CaseNote) => (
                  <div key={note.id} data-testid={`note-${note.id}`} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <StatusBadge status={note.noteType} />
                          <span className="text-xs text-muted-foreground">{note.staffName} · {note.createdAt?.slice(0, 10)}</span>
                        </div>
                        <p className="text-sm text-foreground">{note.content}</p>
                      </div>
                      {note.requiresFollowUp && <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 rounded shrink-0">Follow-up</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="contacts" className="mt-4">
            <div className="bg-card border border-border rounded-xl divide-y divide-border">
              {contacts?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No emergency contacts recorded</div>
              ) : (
                (contacts as ParticipantContact[] | undefined)?.map((contact: ParticipantContact) => (
                  <div key={contact.id} data-testid={`contact-${contact.id}`} className="p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground text-sm">{contact.name}</p>
                        {contact.isPrimary && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Primary</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{contact.relationship}</p>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="text-xs text-foreground">{contact.phone}</span>
                        {contact.email && <span className="text-xs text-muted-foreground">{contact.email}</span>}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="outcomes" className="mt-4">
            <AIOutcomesTab participantId={id} />
          </TabsContent>

          <TabsContent value="forecast" className="mt-4">
            <FundingForecastTab participantId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
