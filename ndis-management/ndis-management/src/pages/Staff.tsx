import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useListStaff, useCreateStaff, useDeleteStaff, useUpdateStaff } from "@workspace/api-client-react";
import { getListStaffQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Search, Plus, UserCheck, Trash2, Shield, Mail, Loader2, CheckCircle2, Pencil, MapPin, Sparkles, RefreshCw, AlertTriangle } from "lucide-react";
import { fetchWithAuthJson } from "@/lib/fetchWithAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AddressAutocomplete, type StructuredAddress } from "@/components/AddressAutocomplete";

const staffSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  position: z.string().min(1, "Required"),
  employmentType: z.enum(["full_time", "part_time", "casual", "contractor"]),
  status: z.enum(["active", "inactive", "on_leave"]),
  startDate: z.string().optional(),
  hourlyRate: z.number().optional(),
  address: z.string().optional(),
});

type StaffForm = z.infer<typeof staffSchema>;

const RISK_BADGE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA", label: "Critical Risk" },
  high:     { bg: "#FFF7ED", text: "#EA580C", border: "#FED7AA", label: "High Risk" },
  medium:   { bg: "#FEF3C7", text: "#B45309", border: "#FDE68A", label: "Medium Risk" },
  low:      { bg: "#DCFCE7", text: "#15803D", border: "#86EFAC", label: "Low Risk" },
};

export default function Staff() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [riskData, setRiskData] = useState<any | null>(null);
  const [riskLoading, setRiskLoading] = useState(false);

  const loadRisk = async () => {
    setRiskLoading(true);
    try {
      const data = await fetchWithAuthJson<any>("/api/ai/worker-risk");
      setRiskData(data);
    } catch {
      // ignore
    }
    setRiskLoading(false);
  };

  const getRisk = (staffId: number) =>
    riskData?.assessments?.find((a: any) => a.staffId === staffId);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "support_worker">("support_worker");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError("");
    setInviteSending(true);
    try {
      const token = localStorage.getItem("pf_token");
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error ?? `Failed to send invite (${res.status})`);
      } else {
        setInviteSent(true);
      }
    } catch (err: any) {
      setInviteError(`Network error: ${err.message}`);
    } finally {
      setInviteSending(false);
    }
  };

  const resetInviteDialog = () => {
    setShowInvite(false);
    setInviteEmail("");
    setInviteRole("support_worker");
    setInviteSent(false);
    setInviteError("");
  };

  const params = {
    ...(statusFilter !== "all" ? { status: statusFilter as "active" | "inactive" | "on_leave" } : {}),
    ...(search ? { search } : {}),
  };

  const { data: staff, isLoading } = useListStaff(params);
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const createForm = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { firstName: "", lastName: "", email: "", position: "Support Worker", employmentType: "casual", status: "active", address: "" },
  });

  const editForm = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { firstName: "", lastName: "", email: "", position: "Support Worker", employmentType: "casual", status: "active", address: "" },
  });

  const onCreateSubmit = (data: StaffForm) => {
    createStaff.mutate({ data }, {
      onSuccess: () => {
        toast({ title: "Staff member created" });
        setShowCreate(false);
        createForm.reset();
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      },
      onError: (err) => toast({ title: `Failed to create staff: ${err.message}`, variant: "destructive" }),
    });
  };

  const handleOpenEdit = (s: any) => {
    setEditingId(s.id);
    editForm.reset({
      firstName: s.firstName ?? "",
      lastName: s.lastName ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      position: s.position ?? "Support Worker",
      employmentType: s.employmentType ?? "casual",
      status: s.status ?? "active",
      startDate: s.startDate ?? "",
      hourlyRate: s.hourlyRate ? Number(s.hourlyRate) : undefined,
      address: s.address ?? "",
    });
  };

  const onEditSubmit = (data: StaffForm) => {
    if (!editingId) return;
    updateStaff.mutate({ id: editingId, data }, {
      onSuccess: () => {
        toast({ title: "Staff member updated" });
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      },
      onError: (err) => toast({ title: `Failed to update staff: ${err.message}`, variant: "destructive" }),
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    deleteStaff.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Staff member deleted" });
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      },
      onError: (err) => toast({ title: `Failed to delete: ${err.message}`, variant: "destructive" }),
    });
  };

  const StaffFormFields = ({ form, isEdit = false }: { form: any; isEdit?: boolean }) => {
    const handleAddressStructured = (data: StructuredAddress) => {
      form.setValue("address", data.formattedAddress || data.address, { shouldDirty: true });
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
        <FormField control={form.control} name="email" render={({ field }) => (
          <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} disabled={isEdit} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="position" render={({ field }) => (
            <FormItem><FormLabel>Position</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="employmentType" render={({ field }) => (
            <FormItem><FormLabel>Employment Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="full_time">Full Time</SelectItem>
                  <SelectItem value="part_time">Part Time</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="status" render={({ field }) => (
            <FormItem><FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="on_leave">On Leave</SelectItem>
                </SelectContent>
              </Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={form.control} name="startDate" render={({ field }) => (
            <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="hourlyRate" render={({ field }) => (
            <FormItem><FormLabel>Hourly Rate ($)</FormLabel><FormControl>
              <Input type="number" step="0.01" {...field} onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)} value={field.value ?? ""} />
            </FormControl><FormMessage /></FormItem>
          )} />
        </div>
        <FormField control={form.control} name="address" render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1.5">
              <MapPin className="w-3 h-3" /> Home Address
              <span className="text-[10px] font-normal text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Google Maps</span>
            </FormLabel>
            <FormControl>
              <AddressAutocomplete
                value={field.value ?? ""}
                onChange={field.onChange}
                onStructuredChange={handleAddressStructured}
                placeholder="Search for staff home address…"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">Staff</h1>
          <p className="pf-page-desc">{staff?.length ?? 0} staff members</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <Button variant="outline" onClick={loadRisk} disabled={riskLoading} className="gap-2">
            {riskLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {riskLoading ? "Assessing…" : riskData ? "Refresh Risk" : "Worker Risk"}
          </Button>
          <Button variant="outline" onClick={() => { setShowInvite(true); setInviteSent(false); setInviteError(""); }} className="gap-2">
            <Mail className="w-4 h-4" />
            Invite Staff
          </Button>
          <Button data-testid="button-add-staff" onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Staff
          </Button>
        </div>
      </div>

      <div className="pf-filter-bar">
        <div className="pf-search" style={{ flex: 1, maxWidth: 360 }}>
          <Search className="pf-search-icon" style={{ width: 15, height: 15 }} />
          <input
            data-testid="input-search-staff"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pf-input"
            style={{ paddingLeft: 34 }}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="pf-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="pf-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Position</th>
                <th>Employment</th>
                <th>Hourly Rate</th>
                <th>Status</th>
                {riskData && <th>Risk</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(6)].map((_, j) => (
                    <td key={j}><div className="pf-skeleton" style={{ height: 14, width: "80%" }} /></td>
                  ))}</tr>
                ))
              ) : staff?.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="pf-empty">
                      <UserCheck className="pf-empty-icon" />
                      <p>No staff members found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                staff?.map(s => (
                  <tr key={s.id} data-testid={`row-staff-${s.id}`}>
                    <td>
                      <Link href={`/staff/${s.id}`}>
                        <a style={{ cursor: "pointer" }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{s.firstName} {s.lastName}</p>
                          <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>{s.email}</p>
                        </a>
                      </Link>
                    </td>
                    <td style={{ fontSize: 12 }}>{s.position}</td>
                    <td><span className="pf-chip" style={{ textTransform: "capitalize" }}>{s.employmentType?.replace(/_/g, " ")}</span></td>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{s.hourlyRate ? `$${(s.hourlyRate as number).toFixed(2)}/hr` : "—"}</td>
                    <td><StatusBadge status={s.status} /></td>
                    {riskData && (() => {
                      const risk = getRisk(s.id);
                      if (!risk) return <td><span style={{ color: "var(--pf-muted)", fontSize: 12 }}>—</span></td>;
                      const rb = RISK_BADGE[risk.riskLevel] ?? RISK_BADGE.low;
                      return (
                        <td>
                          <span className="pf-chip" style={{ background: rb.bg, color: rb.text, border: `1px solid ${rb.border}`, fontWeight: 700 }}>{rb.label}</span>
                          {risk.primaryRiskFactor && <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 2 }}>{risk.primaryRiskFactor}</p>}
                        </td>
                      );
                    })()}
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => handleOpenEdit(s)} title="Edit" className="pf-icon-button" style={{ width: 28, height: 28, borderRadius: 7 }}>
                          <Pencil style={{ width: 12, height: 12 }} />
                        </button>
                        <Link href={`/staff/${s.id}`}>
                          <a className="pf-icon-button" style={{ width: 28, height: 28, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Shield style={{ width: 12, height: 12 }} />
                          </a>
                        </Link>
                        <button data-testid={`button-delete-staff-${s.id}`} onClick={() => handleDelete(s.id, `${s.firstName} ${s.lastName}`)} title="Delete" className="pf-icon-button" style={{ width: 28, height: 28, borderRadius: 7, color: "var(--pf-error)", borderColor: "transparent" }}>
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
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Staff Member</DialogTitle></DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <StaffFormFields form={createForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button data-testid="button-submit-staff" type="submit" disabled={createStaff.isPending}>
                  {createStaff.isPending ? "Creating..." : "Add Staff Member"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Staff Member</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <StaffFormFields form={editForm} isEdit />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateStaff.isPending}>
                  {updateStaff.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) resetInviteDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite Staff Member</DialogTitle></DialogHeader>
          {inviteSent ? (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle2 className="text-green-500 w-10 h-10" />
              <p className="font-semibold text-gray-900">Invite sent!</p>
              <p className="text-sm text-gray-500">
                An invitation email has been sent to <strong>{inviteEmail}</strong>. They'll receive a link to create their account.
              </p>
              <Button variant="outline" onClick={resetInviteDialog} className="mt-2">Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSendInvite} className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Email address</label>
                <Input type="email" placeholder="worker@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required autoFocus />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Role</label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "admin" | "support_worker")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support_worker">Support Worker</SelectItem>
                    <SelectItem value="admin">Administrator</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400">Administrators can manage staff, participants, and settings.</p>
              </div>
              {inviteError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{inviteError}</p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={resetInviteDialog}>Cancel</Button>
                <Button type="submit" disabled={inviteSending} className="gap-2">
                  {inviteSending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send Invite</>}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
