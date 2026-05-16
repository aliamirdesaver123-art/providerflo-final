import { cn } from "@/lib/utils";

type Status = string;

const statusConfig: Record<string, { label: string; className: string }> = {
  // Participant status
  active: { label: "Active", className: "bg-green-100 text-green-800 border-green-200" },
  inactive: { label: "Inactive", className: "bg-gray-100 text-gray-600 border-gray-200" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  discharged: { label: "Discharged", className: "bg-red-100 text-red-700 border-red-200" },
  on_leave: { label: "On Leave", className: "bg-blue-100 text-blue-700 border-blue-200" },
  // Shift status
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-700 border-blue-200" },
  in_progress: { label: "In Progress", className: "bg-orange-100 text-orange-700 border-orange-200" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 border-green-200" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  no_show: { label: "No Show", className: "bg-purple-100 text-purple-700 border-purple-200" },
  // Incident severity
  low: { label: "Low", className: "bg-blue-50 text-blue-700 border-blue-200" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  high: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-200" },
  critical: { label: "Critical", className: "bg-red-100 text-red-800 border-red-200" },
  // Incident status
  open: { label: "Open", className: "bg-red-100 text-red-700 border-red-200" },
  under_review: { label: "Under Review", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-700 border-green-200" },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-600 border-gray-200" },
  // Invoice status
  draft: { label: "Draft", className: "bg-gray-100 text-gray-600 border-gray-200" },
  submitted: { label: "Submitted", className: "bg-blue-100 text-blue-700 border-blue-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700 border-green-200" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 border-red-200" },
  voided: { label: "Voided", className: "bg-slate-100 text-slate-500 border-slate-200 line-through" },
  // Compliance
  valid: { label: "Valid", className: "bg-green-100 text-green-700 border-green-200" },
  expiring_soon: { label: "Expiring Soon", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  expired: { label: "Expired", className: "bg-red-100 text-red-700 border-red-200" },
  // Agreement
  not_started: { label: "Not Started", className: "bg-gray-100 text-gray-600 border-gray-200" },
  in_progress_goal: { label: "In Progress", className: "bg-blue-100 text-blue-700 border-blue-200" },
  achieved: { label: "Achieved", className: "bg-green-100 text-green-700 border-green-200" },
  discontinued: { label: "Discontinued", className: "bg-gray-100 text-gray-500 border-gray-200" },
  // Funding
  agency_managed: { label: "Agency Managed", className: "bg-blue-100 text-blue-700 border-blue-200" },
  plan_managed: { label: "Plan Managed", className: "bg-purple-100 text-purple-700 border-purple-200" },
  self_managed: { label: "Self Managed", className: "bg-teal-100 text-teal-700 border-teal-200" },
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: "bg-gray-100 text-gray-600 border-gray-200" };
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
