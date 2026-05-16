import AppLayout from "@/components/layout/AppLayout";
import StatusBadge from "@/components/StatusBadge";
import { useGetStaff, useGetStaffCompliance, useGetStaffAvailability } from "@workspace/api-client-react";
import { getGetStaffQueryKey, getGetStaffComplianceQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Mail, Phone, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const COMPLIANCE_LABELS: Record<string, string> = {
  wwc: "Working With Children Check",
  ndis_worker_screening: "NDIS Worker Screening",
  first_aid: "First Aid Certificate",
  police_check: "Police Check",
  driving_licence: "Driving Licence",
  insurance: "Insurance",
  qualification: "Qualification",
  other: "Other",
};

export default function StaffDetail() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = parseInt(idParam ?? "0", 10);

  const { data: staff, isLoading } = useGetStaff(id, {
    query: { queryKey: getGetStaffQueryKey(id) },
  });
  const { data: compliance } = useGetStaffCompliance(id, {
    query: { queryKey: getGetStaffComplianceQueryKey(id) },
  });
  const { data: availability } = useGetStaffAvailability(id);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="h-6 w-48 bg-muted animate-pulse rounded mb-6" />
          <div className="bg-card border border-border rounded-xl p-6 animate-pulse space-y-3">
            <div className="h-8 w-64 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!staff) {
    return (
      <AppLayout>
        <div className="p-6">
          <p className="text-muted-foreground">Staff member not found</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-5">
        <Link href="/staff">
          <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm cursor-pointer transition-colors w-fit">
            <ArrowLeft className="w-4 h-4" />
            Back to Staff
          </div>
        </Link>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start gap-4">
            {(staff as any).photoUrl ? (
              <img
                src={(staff as any).photoUrl}
                alt={`${staff.firstName} ${staff.lastName}`}
                className="w-14 h-14 rounded-xl object-cover shrink-0 ring-1 ring-black/10 shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold text-lg">{staff.firstName[0]}{staff.lastName[0]}</span>
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-foreground">{staff.firstName} {staff.lastName}</h1>
              <p className="text-muted-foreground text-sm">{staff.position}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={staff.status} />
                <span className="text-xs text-muted-foreground capitalize">{staff.employmentType?.replace(/_/g, " ")}</span>
              </div>
            </div>
            {staff.hourlyRate && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Hourly Rate</p>
                <p className="text-xl font-bold text-foreground">${(staff.hourlyRate as number).toFixed(2)}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-foreground">{staff.email}</span>
            </div>
            {staff.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">{staff.phone}</span>
              </div>
            )}
            {staff.startDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-foreground">Started: {staff.startDate}</span>
              </div>
            )}
          </div>
        </div>

        <Tabs defaultValue="compliance">
          <TabsList>
            <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance ({compliance?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="availability" data-testid="tab-availability">Availability</TabsTrigger>
            <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          </TabsList>

          <TabsContent value="compliance" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {compliance?.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No compliance documents recorded</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Document Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Issued</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Expiry</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {compliance?.map(doc => (
                      <tr key={doc.id} data-testid={`compliance-${doc.id}`} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm font-medium text-foreground">{COMPLIANCE_LABELS[doc.documentType] ?? doc.documentType}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{doc.documentNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{doc.issuedDate ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{doc.expiryDate ?? "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={doc.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          <TabsContent value="availability" className="mt-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Day</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Start</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">End</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {availability?.length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">No availability set</td></tr>
                  ) : (
                    availability?.map(avail => (
                      <tr key={avail.id} data-testid={`avail-${avail.id}`} className="hover:bg-muted/20">
                        <td className="px-4 py-3 text-sm text-foreground">{DAYS[avail.dayOfWeek]}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{avail.startTime ?? "—"}</td>
                        <td className="px-4 py-3 text-sm text-foreground">{avail.endTime ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium ${avail.isAvailable ? "text-green-600" : "text-red-600"}`}>
                            {avail.isAvailable ? "Available" : "Unavailable"}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="details" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-3">Employment Details</h3>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">Type</dt><dd className="capitalize">{staff.employmentType?.replace(/_/g, " ")}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Start Date</dt><dd>{staff.startDate ?? "—"}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Hourly Rate</dt><dd>{staff.hourlyRate ? `$${(staff.hourlyRate as number).toFixed(2)}` : "—"}</dd></div>
                </dl>
              </div>
              {(staff.emergencyContactName || staff.address) && (
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-semibold text-foreground mb-3">Emergency Contact</h3>
                  <dl className="space-y-2 text-sm">
                    {staff.emergencyContactName && <div><dt className="text-muted-foreground text-xs">Name</dt><dd className="font-medium">{staff.emergencyContactName}</dd></div>}
                    {staff.emergencyContactPhone && <div><dt className="text-muted-foreground text-xs">Phone</dt><dd>{staff.emergencyContactPhone}</dd></div>}
                  </dl>
                </div>
              )}
            </div>
            {staff.qualifications && staff.qualifications.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-5 mt-4">
                <h3 className="font-semibold text-foreground mb-3">Qualifications</h3>
                <div className="flex flex-wrap gap-2">
                  {staff.qualifications.map((q: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">{q}</span>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
