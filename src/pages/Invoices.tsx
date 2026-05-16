import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import InvoicePreview from "@/components/InvoicePreview";
import { useListInvoices, useListParticipants } from "@workspace/api-client-react";
import type { Invoice, Participant } from "@/types/entities";
import { getListInvoicesQueryKey, getListShiftsQueryKey } from "@workspace/api-client-react";
import { Plus, Receipt, RefreshCw, FileText, Ban, AlertTriangle, Info, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { fetchWithAuth, fetchWithAuthJson } from "@/lib/fetchWithAuth";

const invoiceSchema = z.object({
  participantId: z.number({ required_error: "Required" }),
  periodStart: z.string().min(1, "Required"),
  periodEnd: z.string().min(1, "Required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  periodStart: z.string().min(1, "Required"),
  periodEnd: z.string().min(1, "Required"),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;
type BulkForm = z.infer<typeof bulkSchema>;

const ISSUE_ICONS: Record<string, React.ElementType> = {
  error: AlertTriangle,
  warning: Info,
  info: Info,
};
const ISSUE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  error:   { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  warning: { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA" },
  info:    { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE" },
};

interface PreflightResult {
  canProceed: boolean;
  errorCount: number;
  warningCount: number;
  shiftCount: number;
  estimatedAmount: number;
  issues: { severity: string; code: string; message: string }[];
}

export default function Invoices() {
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightPendingData, setPreflightPendingData] = useState<InvoiceForm | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = statusFilter !== "all" ? { status: statusFilter as any } : {};
  const { data: invoices, isLoading } = useListInvoices(params);
  const { data: participants } = useListParticipants();

  // ── Create invoice mutation ─────────────────────────────────────────────────
  const createInvoice = useMutation({
    mutationFn: async (data: InvoiceForm) => {
      const res = await fetchWithAuth("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create invoice");
      return body;
    },
    onSuccess: (created) => {
      toast({ title: "Invoice generated" });
      setShowCreate(false);
      setPreflight(null);
      setPreflightPendingData(null);
      form.reset();
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      setPreviewId(created.id ?? null);
    },
    onError: (err: any) => toast({ title: err.message ?? "Failed to create invoice", variant: "destructive" }),
  });

  // ── Bulk generate mutation ──────────────────────────────────────────────────
  const bulkGenerate = useMutation({
    mutationFn: async (data: BulkForm) => {
      const res = await fetchWithAuth("/api/invoices/bulk-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to generate invoices");
      return body as any[];
    },
    onSuccess: (invoicesCreated) => {
      if (invoicesCreated.length === 0) {
        toast({ title: "No invoices generated — no billable shifts found for any participant in this period.", variant: "destructive" });
      } else {
        toast({ title: `${invoicesCreated.length} invoice${invoicesCreated.length !== 1 ? "s" : ""} generated` });
      }
      setShowBulk(false);
      bulkForm.reset();
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
      if (invoicesCreated.length === 1) setPreviewId(invoicesCreated[0].id ?? null);
    },
    onError: (err: any) => toast({ title: err.message ?? "Failed to generate invoices", variant: "destructive" }),
  });

  // ── Void mutation ───────────────────────────────────────────────────────────
  const voidInvoice = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetchWithAuth(`/api/invoices/${id}/void`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to void invoice");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Invoice voided — linked shifts are now unlocked" });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
    },
    onError: (err: any) => toast({ title: err.message ?? "Failed to void invoice", variant: "destructive" }),
  });

  // ── Submit mutation ─────────────────────────────────────────────────────────
  const submitInvoice = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetchWithAuth(`/api/invoices/${id}/submit`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to submit invoice");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Invoice submitted" });
      queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
    },
    onError: (err: any) => toast({ title: err.message ?? "Failed to submit invoice", variant: "destructive" }),
  });

  const form = useForm<InvoiceForm>({ resolver: zodResolver(invoiceSchema), defaultValues: {} });
  const bulkForm = useForm<BulkForm>({ resolver: zodResolver(bulkSchema), defaultValues: {} });

  const handleVoidInvoice = (id: number) => {
    if (!confirm("Void this invoice? All linked shifts will be unlocked and editable again.")) return;
    voidInvoice.mutate(id);
  };

  // ── Preflight check then create ─────────────────────────────────────────────
  const onSubmit = async (data: InvoiceForm) => {
    setPreflightLoading(true);
    setPreflight(null);
    try {
      const result = await fetchWithAuthJson<PreflightResult>("/api/invoices/preflight", {
        method: "POST",
        body: JSON.stringify({ participantId: data.participantId, periodStart: data.periodStart, periodEnd: data.periodEnd }),
      });

      if (result.canProceed && result.errorCount === 0 && result.warningCount === 0) {
        // Clean — proceed straight to generation
        createInvoice.mutate(data);
      } else if (!result.canProceed) {
        // Errors present — show issues, block generation
        setPreflight(result);
        setPreflightPendingData(null);
        toast({
          title: "Invoice preflight failed — generation blocked",
          description: `${result.errorCount} error(s) must be fixed before generating this invoice.`,
          variant: "destructive",
        });
      } else {
        // Warnings only — show issues, allow proceeding
        setPreflight(result);
        setPreflightPendingData(data);
      }
    } catch {
      // Preflight request itself failed — do NOT fall through to creation
      setPreflight(null);
      setPreflightPendingData(null);
      toast({
        title: "Invoice preflight failed",
        description: "Could not validate shift data. Invoice generation was blocked. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPreflightLoading(false);
    }
  };

  const onBulkSubmit = (data: BulkForm) => {
    bulkGenerate.mutate(data);
  };

  const typedInvoices = invoices as Invoice[] | undefined;
  const totalPending = typedInvoices?.filter((i: Invoice) => i.status === "draft" || i.status === "submitted")
    .reduce((sum: number, i: Invoice) => sum + (i.totalAmount as number), 0) ?? 0;
  const totalPaid = typedInvoices?.filter((i: Invoice) => i.status === "paid")
    .reduce((sum: number, i: Invoice) => sum + (i.totalAmount as number), 0) ?? 0;

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Invoices</h1>
          <p className="pf-page-desc">{invoices?.length ?? 0} invoices</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <Button data-testid="button-bulk-generate" variant="outline" onClick={() => setShowBulk(true)} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Bulk Generate
          </Button>
          <Button data-testid="button-create-invoice" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="pf-grid pf-grid-3" style={{ marginBottom: 14 }}>
        {[
          { label: "Total Invoices",  value: invoices?.length ?? 0,                                                     valueColor: "var(--pf-text)" },
          { label: "Pending Amount",  value: `$${totalPending.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`,  valueColor: "var(--pf-warning)" },
          { label: "Paid Amount",     value: `$${totalPaid.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`,     valueColor: "var(--pf-success)" },
        ].map(({ label, value, valueColor }) => (
          <div key={label} className="pf-card" style={{ padding: "14px 18px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em", color: "var(--pf-muted)" }}>{label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: valueColor, marginTop: 4 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="pf-filter-bar">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-invoice-status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="pf-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="pf-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Participant</th>
                <th>Period</th>
                <th>Amount</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j}><div className="pf-skeleton" style={{ height: 14, width: "80%" }} /></td>
                  ))}</tr>
                ))
              ) : invoices?.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="pf-empty">
                      <Receipt className="pf-empty-icon" />
                      <p>No invoices found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                typedInvoices?.map((inv: Invoice) => (
                  <tr key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{inv.invoiceNumber}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{inv.participantName}</td>
                    <td style={{ fontSize: 11, color: "var(--pf-muted)" }}>{inv.periodStart} → {inv.periodEnd}</td>
                    <td style={{ fontSize: 13, fontWeight: 700 }}>${(inv.totalAmount as number).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
                        <Button data-testid={`button-view-invoice-${inv.id}`} size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setPreviewId(inv.id)}>
                          <FileText className="w-3.5 h-3.5" />
                          View
                        </Button>
                        {inv.status === "draft" && (
                          <Button data-testid={`button-submit-invoice-${inv.id}`} size="sm" variant="outline" onClick={() => submitInvoice.mutate(inv.id)} disabled={submitInvoice.isPending} className="h-8">
                            Submit
                          </Button>
                        )}
                        {(inv.status as string) !== "voided" && (inv.status as string) !== "paid" && (
                          <Button data-testid={`button-void-invoice-${inv.id}`} size="sm" variant="ghost" onClick={() => handleVoidInvoice(inv.id)} disabled={voidInvoice.isPending} className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Ban className="w-3.5 h-3.5" />
                            Void
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Preview */}
      {previewId !== null && (
        <InvoicePreview
          invoiceId={previewId}
          onClose={() => setPreviewId(null)}
          onRegenerate={() => {
            queryClient.invalidateQueries({ queryKey: getListInvoicesQueryKey() });
            queryClient.invalidateQueries({ queryKey: getListShiftsQueryKey() });
          }}
        />
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={showCreate} onOpenChange={open => {
        setShowCreate(open);
        if (!open) { setPreflight(null); setPreflightPendingData(null); }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">
            Line items are generated from shifts in the selected period. A preflight check runs first.
          </p>

          {/* Preflight results panel */}
          {preflight && (
            <div className="space-y-2 border rounded-xl p-4 bg-muted/20">
              <div className="flex items-center gap-2 mb-1">
                {preflight.canProceed
                  ? <CheckCircle2 className="w-4 h-4 text-amber-500" />
                  : <AlertTriangle className="w-4 h-4 text-destructive" />}
                <span className="text-sm font-bold text-foreground">Invoice Preflight</span>
                <button onClick={() => setPreflight(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-2">
                {preflight.shiftCount ?? 0} shift(s) found · Est. ${(preflight.estimatedAmount ?? 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
              </p>
              {preflight.issues?.map((issue, i) => {
                const IssueIcon = ISSUE_ICONS[issue.severity] ?? Info;
                const ic = ISSUE_COLORS[issue.severity] ?? ISSUE_COLORS.warning;
                return (
                  <div key={i} className="flex items-start gap-2 rounded-lg p-2.5"
                    style={{ background: ic.bg, border: `1px solid ${ic.border}` }}>
                    <IssueIcon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: ic.text }} />
                    <p className="text-xs" style={{ color: ic.text }}>{issue.message}</p>
                  </div>
                );
              })}
              {preflight.canProceed
                ? <p className="text-xs text-amber-700 mt-1">⚠️ Warnings only — you may still proceed.</p>
                : <p className="text-xs text-red-600 mt-1">✗ Errors must be resolved before generating this invoice.</p>}
            </div>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="participantId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Participant</FormLabel>
                  <Select onValueChange={v => { field.onChange(parseInt(v, 10)); setPreflight(null); }}>
                    <FormControl>
                      <SelectTrigger data-testid="select-invoice-participant">
                        <SelectValue placeholder="Select participant" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(participants as Participant[] | undefined)?.map((p: Participant) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.firstName} {p.lastName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="periodStart" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period Start</FormLabel>
                    <FormControl>
                      <Input data-testid="input-invoice-period-start" type="date" {...field}
                        onChange={e => { field.onChange(e); setPreflight(null); }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="periodEnd" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Period End</FormLabel>
                    <FormControl>
                      <Input data-testid="input-invoice-period-end" type="date" {...field}
                        onChange={e => { field.onChange(e); setPreflight(null); }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (optional)</FormLabel>
                  <FormControl>
                    <Input data-testid="input-invoice-due-date" type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Notes (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Please include invoice number as reference" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setPreflight(null); }}>
                  Cancel
                </Button>

                {/* Warnings only — allow proceeding */}
                {preflight && preflight.canProceed && preflightPendingData && (
                  <Button
                    type="button"
                    onClick={() => createInvoice.mutate(preflightPendingData)}
                    disabled={createInvoice.isPending}
                    className="gap-1.5 bg-amber-600 hover:bg-amber-700"
                  >
                    {createInvoice.isPending ? "Generating…" : "Proceed Anyway"}
                  </Button>
                )}

                {/* Errors — blocked */}
                {preflight && !preflight.canProceed && (
                  <Button type="button" disabled className="gap-1.5 opacity-50">
                    Fix Errors First
                  </Button>
                )}

                {/* No preflight result yet — run preflight */}
                {!preflight && (
                  <Button
                    data-testid="button-submit-create-invoice"
                    type="submit"
                    disabled={createInvoice.isPending || preflightLoading}
                    className="gap-1.5"
                  >
                    {preflightLoading
                      ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" />Checking…</>
                      : createInvoice.isPending
                        ? "Generating…"
                        : "Preflight + Generate"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Generate Dialog */}
      <Dialog open={showBulk} onOpenChange={setShowBulk}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bulk Generate Invoices</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Generates invoices for all participants who have unbilled shifts in the selected period.
            Participants with no billable shifts are skipped.
          </p>
          <Form {...bulkForm}>
            <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
              <FormField control={bulkForm.control} name="periodStart" render={({ field }) => (
                <FormItem>
                  <FormLabel>Period Start</FormLabel>
                  <FormControl>
                    <Input data-testid="input-bulk-period-start" type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={bulkForm.control} name="periodEnd" render={({ field }) => (
                <FormItem>
                  <FormLabel>Period End</FormLabel>
                  <FormControl>
                    <Input data-testid="input-bulk-period-end" type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowBulk(false)}>Cancel</Button>
                <Button data-testid="button-submit-bulk" type="submit" disabled={bulkGenerate.isPending}>
                  {bulkGenerate.isPending ? "Generating…" : "Generate"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
