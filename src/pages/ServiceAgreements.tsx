import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useListServiceAgreements, useCreateServiceAgreement, useListParticipants } from "@workspace/api-client-react";
import { getListServiceAgreementsQueryKey } from "@workspace/api-client-react";
import type { ServiceAgreement, Participant } from "@/types/entities";
import { Link } from "wouter";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const agreementSchema = z.object({
  participantId: z.number({ required_error: "Required" }),
  agreementNumber: z.string().optional(),
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  status: z.enum(["active", "expired", "pending", "cancelled"]),
  totalBudget: z.number({ required_error: "Required" }),
  notes: z.string().optional(),
});

type AgreementForm = z.infer<typeof agreementSchema>;

function BudgetBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const barColor = pct >= 90 ? "var(--pf-error)" : pct >= 75 ? "var(--pf-warning)" : "var(--pf-success)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--pf-muted)", marginBottom: 4 }}>
        <span>${used.toLocaleString("en-AU", { maximumFractionDigits: 0 })}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div style={{ width: "100%", height: 5, background: "var(--pf-border)", borderRadius: 99 }}>
        <div style={{ height: 5, borderRadius: 99, background: barColor, width: `${pct}%`, transition: "width .3s ease" }} />
      </div>
    </div>
  );
}

export default function ServiceAgreements() {
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: agreements, isLoading } = useListServiceAgreements();
  const { data: participants } = useListParticipants();
  const createAgreement = useCreateServiceAgreement();

  const form = useForm<AgreementForm>({
    resolver: zodResolver(agreementSchema),
    defaultValues: {
      status: "active",
    },
  });

  const onSubmit = (data: AgreementForm) => {
    createAgreement.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Service agreement created" });
        setShowCreate(false);
        form.reset();
        queryClient.invalidateQueries({ queryKey: getListServiceAgreementsQueryKey() });
      },
      onError: () => toast({ title: "Failed to create service agreement", variant: "destructive" }),
    });
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
            <h1 className="pf-page-title">Service Agreements</h1>
            <p className="pf-page-desc">{agreements?.length ?? 0} agreements</p>
          </div>
          <Button data-testid="button-create-agreement" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Agreement
          </Button>
        </div>

        <div className="pf-card" style={{ overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table className="pf-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Agreement #</th>
                  <th>Period</th>
                  <th>Total Budget</th>
                  <th style={{ width: 200 }}>Utilization</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i}>{[...Array(6)].map((_, j) => (
                      <td key={j}><div className="pf-skeleton" style={{ height: 14, width: "80%" }} /></td>
                    ))}</tr>
                  ))
                ) : agreements?.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <div className="pf-empty">
                        <FileText className="pf-empty-icon" />
                        <p>No service agreements found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (agreements as ServiceAgreement[] | undefined)?.map((ag: ServiceAgreement) => (
                    <tr key={ag.id} data-testid={`row-agreement-${ag.id}`}>
                      <td>
                        <Link href={`/service-agreements/${ag.id}`}>
                          <a style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)", cursor: "pointer" }}>{ag.participantName || "—"}</a>
                        </Link>
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--pf-muted)" }}>{ag.agreementNumber ?? "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--pf-muted)" }}>{ag.startDate}<br />to {ag.endDate}</td>
                      <td style={{ fontSize: 13, fontWeight: 700 }}>${(ag.totalBudget as number).toLocaleString("en-AU")}</td>
                      <td style={{ width: 200 }}>
                        <BudgetBar used={ag.usedBudget as number || 0} total={ag.totalBudget as number} />
                      </td>
                      <td><StatusBadge status={ag.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Service Agreement</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="participantId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Participant</FormLabel>
                  <Select onValueChange={v => field.onChange(parseInt(v, 10))}>
                    <FormControl><SelectTrigger data-testid="select-agreement-participant"><SelectValue placeholder="Select participant" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(participants as Participant[] | undefined)?.map((p: Participant) => <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="agreementNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Agreement Number (optional)</FormLabel>
                  <FormControl><Input data-testid="input-agreement-number" placeholder="e.g. SA-2025-001" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl><Input data-testid="input-agreement-start" type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl><Input data-testid="input-agreement-end" type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="totalBudget" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Budget ($)</FormLabel>
                    <FormControl>
                      <Input
                        data-testid="input-agreement-budget"
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger data-testid="select-agreement-status"><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea data-testid="input-agreement-notes" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button data-testid="button-submit-agreement" type="submit" disabled={createAgreement.isPending}>
                  {createAgreement.isPending ? "Creating..." : "Create Agreement"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
