export type ShiftMode = "single" | "recurring" | "bulk";
export type ShiftPublishStatus = "draft" | "published";

export type ShiftKind =
  | "standard"
  | "sleepover"
  | "active_overnight"
  | "community_access"
  | "transport"
  | "telehealth"
  | "non_face_to_face";

export type LocationSource =
  | "participant_home"
  | "provider_office"
  | "custom"
  | "none";

export type RateOverrideReason =
  | "none"
  | "service_agreement"
  | "manual_adjustment"
  | "custom_quote"
  | "other";

export interface PremiumShiftPayload {
  mode: ShiftMode;
  participantId: number | null;
  staffId: number | null;
  publishStatus: ShiftPublishStatus;
  shiftKind: ShiftKind;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  startLocationSource: LocationSource;
  endLocationSource: LocationSource;
  startAddress: string;
  endAddress: string;
  recurrenceType: "none" | "daily" | "weekly" | "fortnightly" | "monthly" | "custom";
  recurrenceInterval: number;
  recurrenceDays: number[];
  recurrenceEndCondition: "none" | "date" | "count";
  recurrenceEndDate?: string;
  recurrenceCount?: number;
  bulkEndDate?: string;
  bulkDaysOfWeek: number[];
  isPublicHoliday: boolean;
  supportCategory: string;
  supportTypeId: string;
  dayRateType: string;
  ndisLineItem: string;
  supportDescription: string;
  hourlyRate: number | null;
  manualRateOverride: boolean;
  manualRateOverrideReason: RateOverrideReason;
  manualRateOverrideNote: string;
  travelTimeMinutes: number;
  travelKilometres: number;
  mileageRate: number;
  billTravelTime: boolean;
  billKilometres: boolean;
  nonFaceToFace: boolean;
  workerInstructions: string;
  participantNotes: string;
  internalNotes: string;
  tasks: Array<{ id: string; label: string; required: boolean }>;
  requireGpsClockIn: boolean;
  requireParticipantSignature: boolean;
  allowMobileNotes: boolean;
  skipConflicts: boolean;
}

export interface PremiumShiftPreview {
  summary: {
    totalShifts: number;
    validShifts: number;
    conflictedShifts: number;
    totalBillableHours: number;
    estimatedInvoiceTotal: number;
    estimatedTravelTotal: number;
    estimatedGrandTotal: number;
  };
  selectedLineItem: {
    code: string | null;
    description: string | null;
    rate: number | null;
    dayRateType: string | null;
  };
  warnings: Array<{
    code: string;
    severity: "critical" | "warning" | "info";
    message: string;
  }>;
  aiWorkerSuggestions: Array<{
    staffId: number;
    name: string;
    score: number;
    reasons: string[];
    risks: string[];
  }>;
  shifts: Array<{
    date: string;
    start: string;
    end: string;
    billableHours: number;
    lineItem: string | null;
    rate: number | null;
    estimatedCost: number;
    hasConflict: boolean;
    conflicts: string[];
  }>;
}
