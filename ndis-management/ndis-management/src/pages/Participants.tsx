import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useListParticipants, useCreateParticipant, useDeleteParticipant, useUpdateParticipant } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Search, Plus, User, Trash2, Pencil, ShieldCheck, MapPin, Sparkles, RefreshCw } from "lucide-react";
import { fetchWithAuthJson } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListParticipantsQueryKey } from "@workspace/api-client-react";
import { AddressAutocomplete, type StructuredAddress } from "@/components/AddressAutocomplete";

const participantSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  ndisNumber: z.string().min(1, "Required"),
  status: z.enum(["active", "inactive", "pending", "discharged"]),
  fundingType: z.enum(["agency_managed", "plan_managed", "self_managed"]),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  primaryDiagnosis: z.string().optional(),
  planStartDate: z.string().optional(),
  planEndDate: z.string().optional(),
  totalFunding: z.number().optional(),
  address: z.string().optional(),
  suburb: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
});

type ParticipantForm = z.infer<typeof participantSchema>;

const GRADE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC" },
  B: { bg: "#DBEAFE", text: "#1D4ED8", border: "#93C5FD" },
  C: { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" },
  D: { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A" },
  F: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
};

export default function Participants() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);
  const [qualityData, setQualityData] = useState<any | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);

  const loadQuality = async () => {
    setQualityLoading(true);
    try {
      const data = await fetchWithAuthJson<any>("/api/ai/file-quality");
      setQualityData(data);
    } catch {
      // ignore
    }
    setQualityLoading(false);
  };

  const getQuality = (participantId: number) =>
    qualityData?.participants?.find((p: any) => p.participantId === participantId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = {
    ...(statusFilter !== "all" ? { status: statusFilter as "active" | "inactive" | "pending" | "discharged" } : {}),
    ...(search ? { search } : {}),
  };

  const { data: participants, isLoading } = useListParticipants(params);
  const createParticipant = useCreateParticipant();
  const updateParticipant = useUpdateParticipant();
  const deleteParticipant = useDeleteParticipant();

  const createForm = useForm<ParticipantForm>({
    resolver: zodResolver(participantSchema),
    defaultValues: { firstName: "", lastName: "", ndisNumber: "", status: "active", fundingType: "agency_managed", address: "", suburb: "", state: "", postcode: "" },
  });

  const editForm = useForm<ParticipantForm>({
    resolver: zodResolver(participantSchema),
    defaultValues: { firstName: "", lastName: "", ndisNumber: "", status: "active", fundingType: "agency_managed", address: "", suburb: "", state: "", postcode: "" },
  });

  const onCreateSubmit = (data: ParticipantForm) => {
    if (!consentGiven) {
      toast({ title: "Consent required", description: "Please confirm NDIS consent before creating the participant.", variant: "destructive" });
      return;
    }
    createParticipant.mutate({ data: { ...data, consentGiven: true } as any }, {
      onSuccess: () => {
        toast({ title: "Participant created successfully" });
        setShowCreate(false);
        setConsentGiven(false);
        createForm.reset();
        queryClient.invalidateQueries({ queryKey: getListParticipantsQueryKey() });
      },
      onError: (err) => toast({ title: `Failed to create participant: ${err.message}`, variant: "destructive" }),
    });
  };

  const handleOpenEdit = (p: any) => {
    setEditingId(p.id);
    editForm.reset({
      firstName: p.firstName ?? "",
      lastName: p.lastName ?? "",
      ndisNumber: p.ndisNumber ?? "",
      status: p.status ?? "active",
      fundingType: p.fundingType ?? "agency_managed",
      phone: p.phone ?? "",
      email: p.email ?? "",
      primaryDiagnosis: p.primaryDiagnosis ?? "",
      planStartDate: p.planStartDate ?? "",
      planEndDate: p.planEndDate ?? "",
      totalFunding: p.totalFunding ? Number(p.totalFunding) : undefined,
      address: p.address ?? "",
      suburb: p.suburb ?? "",
      state: p.state ?? "",
      postcode: p.postcode ?? "",
    });
  };

  const onEditSubmit = (data: ParticipantForm) => {
    if (!editingId) return;
    updateParticipant.mutate({ id: editingId, data }, {
      onSuccess: () => {
        toast({ title: "Participant updated successfully" });
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListParticipantsQueryKey() });
      },
      onError: (err) => toast({ title: `Failed to update participant: ${err.message}`, variant: "destructive" }),
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    deleteParticipant.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Participant deleted" });
        queryClient.invalidateQueries({ queryKey: getListParticipantsQueryKey() });
      },
      onError: (err) => toast({ title: `Failed to delete: ${err.message}`, variant: "destructive" }),
    });
  };

  const ParticipantFormFields = ({ form }: { form: any }) => {
    const handleAddressStructured = (data: StructuredAddress) => {
      form.setValue("address", data.address, { shouldDirty: true });
      form.setValue("suburb", data.suburb, { shouldDirty: true });
      form.setValue("state", data.state, { shouldDirty: true });
      form.setValue("postcode", data.postcode, { shouldDirty: true });
    };

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="firstName" render={({ field }) => (
            <FormItem><FormLabel>First Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="lastName" render={({ field }) => (
            <FormItem><FormLabel>Last Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="ndisNumber" render={({ field }) => (
            <FormItem><FormLabel>NDIS Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="primaryDiagnosis" render={({ field }) => (
            <FormItem><FormLabel>Primary Diagnosis</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="discharged">Discharged</SelectItem>
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="fundingType" render={({ field }) => (
            <FormItem><FormLabel>Funding Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="agency_managed">Agency Managed</SelectItem>
                  <SelectItem value="plan_managed">Plan Managed</SelectItem>
                  <SelectItem value="self_managed">Self Managed</SelectItem>
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        {/* Address section */}
        <div className="space-y-2 pt-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="w-3 h-3" /> Address
            <span className="text-[10px] font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full normal-case tracking-normal">Google Maps</span>
          </p>
          <FormField control={form.control} name="address" render={({ field }) => (
            <FormItem>
              <FormLabel>Street Address</FormLabel>
              <FormControl>
                <AddressAutocomplete
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  onStructuredChange={handleAddressStructured}
                  placeholder="Search for participant address…"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />
          <div className="grid grid-cols-3 gap-3">
            <FormField control={form.control} name="suburb" render={({ field }) => (
              <FormItem><FormLabel>Suburb</FormLabel><FormControl><Input {...field} placeholder="Suburb" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="state" render={({ field }) => (
              <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} placeholder="QLD" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="postcode" render={({ field }) => (
              <FormItem><FormLabel>Postcode</FormLabel><FormControl><Input {...field} placeholder="4000" /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={form.control} name="planStartDate" render={({ field }) => (
            <FormItem><FormLabel>Plan Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="planEndDate" render={({ field }) => (
            <FormItem><FormLabel>Plan End Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="totalFunding" render={({ field }) => (
            <FormItem><FormLabel>Total Funding ($)</FormLabel><FormControl>
              <Input type="number" {...field} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} value={field.value ?? ""} />
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Participants</h1>
          <p className="pf-page-desc">{participants?.length ?? 0} total participants</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={loadQuality} disabled={qualityLoading} className="gap-2">
            {qualityLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {qualityLoading ? "Scoring…" : qualityData ? "Refresh Quality" : "File Quality"}
          </Button>
          <Button data-testid="button-add-participant" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Participant
          </Button>
        </div>
      </div>

      <div className="pf-filter-bar">
        <div className="pf-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search className="pf-search-icon" style={{ width: 15, height: 15 }} />
          <input
            data-testid="input-search-participants"
            placeholder="Search by name or NDIS number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pf-input"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger data-testid="select-status-filter" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="discharged">Discharged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pf-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="pf-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Participant</th>
                <th>NDIS Number</th>
                <th>Funding Type</th>
                <th>Plan Period</th>
                <th>Status</th>
                <th>Funding</th>
                {qualityData && <th>File Score</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(7)].map((_, j) => (
                      <td key={j}><div className="pf-skeleton" style={{ height: 14, width: "80%" }} /></td>
                    ))}
                  </tr>
                ))
              ) : participants?.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="pf-empty">
                      <User className="pf-empty-icon" />
                      <p>No participants found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                participants?.map(p => (
                  <tr key={p.id} data-testid={`row-participant-${p.id}`}>
                    <td>
                      <Link href={`/participants/${p.id}`}>
                        <a style={{ cursor: "pointer" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{p.firstName} {p.lastName}</p>
                          {p.primaryDiagnosis && <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{p.primaryDiagnosis}</p>}
                        </a>
                      </Link>
                    </td>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{p.ndisNumber}</td>
                    <td><StatusBadge status={p.fundingType} /></td>
                    <td style={{ fontSize: 11, color: "var(--pf-muted)" }}>
                      {p.planStartDate ?? "—"}{p.planEndDate ? ` → ${p.planEndDate}` : ""}
                    </td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      {p.totalFunding ? (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-text)" }}>${(p.totalFunding as number).toLocaleString("en-AU")}</p>
                          <div style={{ width: 64, height: 4, background: "var(--pf-border)", borderRadius: 99, marginTop: 4 }}>
                            <div style={{ height: 4, borderRadius: 99, background: "var(--pf-primary)", width: `${Math.min(((p.usedFunding as number || 0) / (p.totalFunding as number)) * 100, 100)}%` }} />
                          </div>
                        </div>
                      ) : <span style={{ color: "var(--pf-muted)", fontSize: 12 }}>—</span>}
                    </td>
                    {qualityData && (() => {
                      const q = getQuality(p.id);
                      if (!q) return <td><span style={{ color: "var(--pf-muted)", fontSize: 12 }}>—</span></td>;
                      const gs = GRADE_STYLE[q.grade] ?? GRADE_STYLE.C;
                      return (
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 900, width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: gs.bg, color: gs.text, border: `1px solid ${gs.border}` }}>
                              {q.grade}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>{q.score}%</span>
                          </div>
                          {q.missing?.length > 0 && (
                            <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 2, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={q.missing.join(", ")}>
                              Missing: {q.missing.slice(0, 2).join(", ")}
                            </p>
                          )}
                        </td>
                      );
                    })()}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => handleOpenEdit(p)} title="Edit participant" className="pf-icon-button" style={{ width: 28, height: 28, borderRadius: 7 }}>
                          <Pencil style={{ width: 12, height: 12 }} />
                        </button>
                        <button data-testid={`button-delete-participant-${p.id}`} onClick={() => handleDelete(p.id, `${p.firstName} ${p.lastName}`)} title="Delete" className="pf-icon-button" style={{ width: 28, height: 28, borderRadius: 7, color: "var(--pf-error)", borderColor: "transparent" }}>
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={(open) => { setShowCreate(open); if (!open) { setConsentGiven(false); createForm.reset(); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add New Participant</DialogTitle></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <ParticipantFormFields form={createForm} />
              <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <Checkbox id="ndis-consent" checked={consentGiven} onCheckedChange={(v) => setConsentGiven(v === true)} className="mt-0.5" />
                <label htmlFor="ndis-consent" className="text-sm text-amber-800 cursor-pointer leading-snug">
                  <span className="font-medium flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 inline" /> NDIS Consent Confirmed</span>
                  <span className="block mt-0.5 text-amber-700">I confirm this participant has provided informed consent to collect and store their personal and medical information in compliance with NDIS requirements.</span>
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setShowCreate(false); setConsentGiven(false); createForm.reset(); }}>Cancel</Button>
                <Button data-testid="button-submit-participant" type="submit" disabled={createParticipant.isPending || !consentGiven}>
                  {createParticipant.isPending ? "Creating..." : "Create Participant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Participant</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <ParticipantFormFields form={editForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateParticipant.isPending}>
                  {updateParticipant.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
