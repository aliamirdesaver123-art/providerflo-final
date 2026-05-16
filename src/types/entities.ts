export interface Participant {
  id: number;
  firstName: string;
  lastName: string;
  ndisNumber: string;
  status: string;
  fundingType: string;
  phone?: string;
  email?: string;
  primaryDiagnosis?: string;
  planStartDate?: string;
  planEndDate?: string;
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
  totalFunding?: number;
  usedFunding?: number;
}

export interface StaffMember {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  position: string;
  employmentType?: string;
  status: string;
  startDate?: string;
  hourlyRate?: number;
  address?: string;
}

export interface Shift {
  id: number;
  participantId: number;
  staffId?: number | null;
  staffName?: string;
  participantName?: string;
  scheduledStart: string;
  scheduledEnd: string;
  serviceType?: string;
  supportCategory?: string;
  ndisLineItem?: string;
  hourlyRate?: number;
  address?: string;
  notes?: string;
  status: string;
  totalHours?: number;
  seriesId?: number | null;
}

export interface CaseNote {
  id: number;
  content: string;
  noteType: string;
  participantId: number;
  participantName?: string;
  staffId: number;
  staffName?: string;
  isPrivate: boolean;
  requiresFollowUp: boolean;
  goalReference?: string;
  followUpDate?: string;
  createdAt?: string;
}

export interface Incident {
  id: number;
  description: string;
  incidentType?: string;
  severity: string;
  status: string;
  participantId: number;
  participantName?: string;
  reportedByStaffId?: number;
  reportedByStaffName?: string;
  incidentDate: string;
  reportableToNdis?: boolean;
  location?: string;
  witnesses?: string;
  actionsTaken?: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  participantId: number;
  participantName?: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  status: string;
}

export interface ServiceAgreement {
  id: number;
  participantId: number;
  participantName?: string;
  agreementNumber?: string;
  startDate: string;
  endDate: string;
  totalBudget: number;
  usedBudget?: number;
  status: string;
  notes?: string;
}

export interface ParticipantGoal {
  id: number;
  goalArea: string;
  description: string;
  notes?: string;
  progress: string;
  targetDate?: string;
}

export interface ParticipantContact {
  id: number;
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  isPrimary?: boolean;
}

export interface ComplianceDocument {
  id: number;
  documentType: string;
  documentNumber?: string;
  issuedDate?: string;
  expiryDate?: string;
  status: string;
}

export interface StaffAvailability {
  id: number;
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  isAvailable: boolean;
}
