import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useListIncidents, useCreateIncident, useListParticipants, useListStaff } from "@workspace/api-client-react";
import { getListIncidentsQueryKey } from "@workspace/api-client-react";
import type { Incident, Participant, StaffMember } from "@/types/entities";
import { Link } from "wouter";
import { Plus, AlertTriangle, Sparkles, RefreshCw, CheckCircle2, Clock, ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { fetchWithAuth, fetchWithAuthJson } from "@/lib/fetchWithAuth";

const incidentSchema = z.object({
  participantId: z.number({ required_error: "Required" }),
  reportedByStaffId: z.number().optional(),
  incidentType: z.enum(["injury", "medication_error", "behaviour", "missing_person", "property_damage", "complaint", "near_miss", "other"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["open", "under_review", "resolved", "closed"]),
  incidentDate: z.string().min(1, "Required"),
  location: z.string().optional(),
  description: z.string().min(1, "Required"),
  actionsTaken: z.string().optional(),
  reportableToNdis: z.boolean().default(false),
});

type IncidentForm = z.infer<typeof incidentSchema>;

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  immediate: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  urgent:    { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA" },
  standard:  { bg: "#DBEAFE", text: "#1D4ED8", border: "#BFDBFE" },
};

function IncidentActionsPanel({ incidentId, onClose }: { incidentId: number; onClose: () => void }) {
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [actions, setActions]     = useState<any[]>([]);
  const [summary, setSummary]     = useState<string | null>(null);
  const [loaded, setLoaded]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const { toast } = useToast();

  const loadActions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuthJson<any>(`/api/ai/incident-actions/${incidentId}`);
      setActions(data.actions ?? []);
      setLoaded(true);
    } catch {
      setError("Failed to load actions");
    }
    setLoading(false);
  };

  const generateActions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const data = await fetchWithAuthJson<any>(`/api/ai/incident-actions/${incidentId}`, { method: "POST" });
      setActions(data.actions ?? []);
      setSummary(data.summary ?? null);
      setLoaded(true);
      toast({ title: "AI action plan generated" });
    } catch {
      setError("Failed to generate actions");
    }
    setGenerating(false);
  };

  const completeAction = async (actionId: number) => {
    try {
      await fetchWithAuth(`/api/ai/incident-actions/${actionId}/complete`, { method: "PATCH" });
      setActions(prev => prev.map(a => a.id === actionId ? { ...a, status: "completed" } : a));
    } catch {
      toast({ title: "Failed to update action", variant: "destructive" });
    }
  };

  if (!loaded && !loading) {
    loadActions();
  }

  return (
    <div className="bg-slate-900 text-white rounded-xl p-5 mt-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-300" />
          <span className="text-sm font-bold text-blue-300 uppercase tracking-wide">AI Action Plan</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline"
            className="h-7 text-xs bg-white/10 border-white/20 text-white hover:bg-white/20"
            onClick={generateActions} disabled={generating}>
            {generating
              ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating…</>
              : <><Sparkles className="w-3 h-3 mr-1" />{actions.length > 0 ? "Regenerate" : "Generate Actions"}</>
            }
          </Button>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
      {summary && <p className="text-sm text-slate-300 mb-4 leading-relaxed border-l-2 border-blue-500 pl-3">{summary}</p>}

      {loading && (
        <div className="text-center py-6">
          <RefreshCw className="w-5 h-5 animate-spin text-white/40 mx-auto mb-2" />
          <p className="text-sm text-white/40">Loading actions…</p>
        </div>
      )}

      {!loading && actions.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-white/50">No actions generated yet. Click "Generate Actions" to create an AI follow-up plan.</p>
        </div>
      )}

      {!loading && actions.length > 0 && (
        <div className="space-y-2">
          {actions.map((action: any, i: number) => {
            const pc = PRIORITY_COLORS[action.priority] ?? PRIORITY_COLORS.standard;
            const isComplete = action.status === "completed";
            return (
              <div key={action.id ?? i}
                className={`rounded-lg p-3 border transition-all ${isComplete ? "opacity-50" : ""}`}
                style={{ background: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {action.priority && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{ background: pc.bg, color: pc.text, border: `1px solid ${pc.border}` }}>
                          {action.priority}
                        </span>
                      )}
                      {action.assignedTo && (
                        <span className="text-xs text-slate-400">{action.assignedTo}</span>
                      )}
                      {action.dueDate && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Due {action.dueDate}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-medium ${isComplete ? "line-through text-slate-500" : "text-white"}`}>
                      {action.action}
                    </p>
                  </div>
                  {!isComplete && action.id && (
                    <button
                      onClick={() => completeAction(action.id)}
                      className="shrink-0 text-white/30 hover:text-green-400 transition-colors mt-0.5"
                      title="Mark complete">
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                  )}
                  {isComplete && (
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-white/30 text-right pt-1">
            {actions.filter(a => a.status === "completed").length}/{actions.length} complete
          </p>
        </div>
      )}
    </div>
  );
}

export default function Incidents() {
  const [showCreate, setShowCreate]                     = useState(false);
  const [severityFilter, setSeverityFilter]             = useState<string>("all");
  const [statusFilter, setStatusFilter]                 = useState<string>("all");
  const [expandedIncident, setExpandedIncident]         = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = {
    ...(severityFilter !== "all" ? { severity: severityFilter as "low" | "medium" | "high" | "critical" } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter as "open" | "under_review" | "resolved" | "closed" } : {}),
  };

  const { data: incidents, isLoading } = useListIncidents(params);
  const { data: participants } = useListParticipants();
  const { data: staff } = useListStaff();
  const createIncident = useCreateIncident();

  const form = useForm<IncidentForm>({
    resolver: zodResolver(incidentSchema),
    defaultValues: {
      incidentType: "other",
      severity: "low",
      status: "open",
      incidentDate: new Date().toISOString().slice(0, 10),
      reportableToNdis: false,
    },
  });

  const onSubmit = (data: IncidentForm) => {
    createIncident.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Incident reported" });
        setShowCreate(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListIncidentsQueryKey() });
      },
      onError: () => toast({ title: "Failed to report incident", variant: "destructive" }),
    });
  };

  const toggleActions = (id: number) => {
    setExpandedIncident(prev => (prev === id ? null : id));
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Incidents</h1>
          <p className="pf-page-desc">{incidents?.length ?? 0} incidents recorded</p>
        </div>
        <Button data-testid="button-report-incident" onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Report Incident
        </Button>
      </div>

      <div className="pf-filter-bar">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger data-testid="select-severity-filter" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-incident-status-filter" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="pf-card" style={{ padding: 14 }}>
              <div className="pf-skeleton" style={{ height: 14, width: "75%" }} />
            </div>
          ))
        ) : incidents?.length === 0 ? (
          <div className="pf-card">
            <div className="pf-empty">
              <AlertTriangle className="pf-empty-icon" />
              <p>No incidents recorded</p>
            </div>
          </div>
        ) : (
          (incidents as Incident[] | undefined)?.map((inc: Incident) => (
            <div key={inc.id} data-testid={`row-incident-${inc.id}`} className="pf-card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto auto", alignItems: "center", gap: 14, padding: "12px 16px", minWidth: 640 }}>
                  <StatusBadge status={inc.severity} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{inc.participantName}</p>
                    <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{inc.reportedByStaffName || "—"}</p>
                  </div>
                  <span className="pf-chip" style={{ textTransform: "capitalize" }}>{inc.incidentType?.replace(/_/g, " ")}</span>
                  <p style={{ fontSize: 12, color: "var(--pf-muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inc.description}</p>
                  <span style={{ fontSize: 12, color: "var(--pf-text-soft)", whiteSpace: "nowrap" }}>{inc.incidentDate}</span>
                  <StatusBadge status={inc.status} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {inc.reportableToNdis && (
                      <span className="pf-chip pf-chip-warning">Reportable</span>
                    )}
                    <button onClick={() => toggleActions(inc.id)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--pf-primary)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", padding: 0 }}>
                      <Sparkles style={{ width: 13, height: 13 }} />
                      AI Actions
                      {expandedIncident === inc.id ? <ChevronUp style={{ width: 12, height: 12 }} /> : <ChevronDown style={{ width: 12, height: 12 }} />}
                    </button>
                  </div>
                </div>
              </div>
              {expandedIncident === inc.id && (
                <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--pf-border)" }}>
                  <IncidentActionsPanel incidentId={inc.id} onClose={() => setExpandedIncident(null)} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Report Incident</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="participantId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Participant</FormLabel>
                    <Select onValueChange={v => field.onChange(parseInt(v, 10))}>
                      <FormControl><SelectTrigger data-testid="select-incident-participant"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(participants as Participant[] | undefined)?.map((p: Participant) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reportedByStaffId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reported By</FormLabel>
                    <Select onValueChange={v => field.onChange(parseInt(v, 10))}>
                      <FormControl><SelectTrigger data-testid="select-incident-staff"><SelectValue placeholder="Select staff..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(staff as StaffMember[] | undefined)?.map((s: StaffMember) => <SelectItem key={s.id} value={s.id.toString()}>{s.firstName} {s.lastName}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="incidentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-incident-type"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="injury">Injury</SelectItem>
                        <SelectItem value="medication_error">Medication Error</SelectItem>
                        <SelectItem value="behaviour">Behaviour</SelectItem>
                        <SelectItem value="missing_person">Missing Person</SelectItem>
                        <SelectItem value="property_damage">Property Damage</SelectItem>
                        <SelectItem value="complaint">Complaint</SelectItem>
                        <SelectItem value="near_miss">Near Miss</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-incident-severity"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="incidentDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input data-testid="input-incident-date" type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="location" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl><Input data-testid="input-incident-location" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea data-testid="input-incident-description" rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="actionsTaken" render={({ field }) => (
                <FormItem>
                  <FormLabel>Actions Taken</FormLabel>
                  <FormControl><Textarea data-testid="input-incident-actions" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reportableToNdis" render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox data-testid="checkbox-ndis-reportable" checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">Reportable to NDIS Commission</FormLabel>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button data-testid="button-submit-incident" type="submit" disabled={createIncident.isPending}>
                  {createIncident.isPending ? "Submitting..." : "Report Incident"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
