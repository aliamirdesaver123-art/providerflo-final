import { useQuery, useMutation } from "@tanstack/react-query";

let authTokenGetter: (() => string | null) | null = null;

export function setAuthTokenGetter(getter: () => string | null) {
  authTokenGetter = getter;
}

function getAuthHeaders(): Record<string, string> {
  const token = authTokenGetter?.();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(url: string, init?: RequestInit): Promise<any> {
  const headers = new Headers(init?.headers ?? {});
  const authHeaders = getAuthHeaders();
  for (const [k, v] of Object.entries(authHeaders)) {
    headers.set(k, v);
  }
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

function makeListHook(resource: string) {
  const queryKeyFn = (params?: any) => [resource, ...(params ? [params] : [])];
  const hook = (params?: any, options?: any) => {
    const qp = params ? "?" + new URLSearchParams(params as Record<string, string>).toString() : "";
    return useQuery<any, any, any, any>({
      queryKey: queryKeyFn(params),
      queryFn: () => apiFetch(`/api/${resource}${qp}`),
      ...options,
    });
  };
  return { hook, queryKeyFn };
}

function makeGetHook(resource: string, subResource?: string) {
  const path = subResource ? `${resource}/${subResource}` : resource;
  const queryKeyFn = (id?: any) => [path, ...(id !== undefined ? [id] : [])];
  const hook = (idOrParams?: any, options?: any) => {
    const id = typeof idOrParams === "object" ? idOrParams?.id : idOrParams;
    return useQuery<any, any, any, any>({
      queryKey: queryKeyFn(id),
      queryFn: () => apiFetch(`/api/${resource}${id ? `/${id}` : ""}${subResource ? `/${subResource}` : ""}`),
      enabled: id !== undefined && id !== null,
      ...options,
    });
  };
  return { hook, queryKeyFn };
}

function makeCreateHook(resource: string) {
  return (options?: any) =>
    useMutation<any, any, any>({
      mutationFn: (vars: { data: any }) =>
        apiFetch(`/api/${resource}`, {
          method: "POST",
          body: JSON.stringify(vars.data),
        }),
      ...options,
    });
}

function makeUpdateHook(resource: string) {
  return (options?: any) =>
    useMutation<any, any, any>({
      mutationFn: (vars: { id: number | string; data: any }) =>
        apiFetch(`/api/${resource}/${vars.id}`, {
          method: "PATCH",
          body: JSON.stringify(vars.data),
        }),
      ...options,
    });
}

function makeDeleteHook(resource: string) {
  return (options?: any) =>
    useMutation<any, any, any>({
      mutationFn: (vars: { id: number | string }) =>
        apiFetch(`/api/${resource}/${vars.id}`, { method: "DELETE" }),
      ...options,
    });
}

// --- Participants ---
const participants = makeListHook("participants");
export const useListParticipants = participants.hook;
export const getListParticipantsQueryKey = participants.queryKeyFn;
export const useCreateParticipant = makeCreateHook("participants");
export const useUpdateParticipant = makeUpdateHook("participants");
export const useDeleteParticipant = makeDeleteHook("participants");

const getParticipant = makeGetHook("participants");
export const useGetParticipant = getParticipant.hook;
export const getGetParticipantQueryKey = getParticipant.queryKeyFn;

const getParticipantGoals = makeGetHook("participants", "goals");
export const useGetParticipantGoals = getParticipantGoals.hook;
export const getGetParticipantGoalsQueryKey = getParticipantGoals.queryKeyFn;

const getParticipantContacts = makeGetHook("participants", "contacts");
export const useGetParticipantContacts = getParticipantContacts.hook;

// --- Staff ---
const staff = makeListHook("staff");
export const useListStaff = staff.hook;
export const getListStaffQueryKey = staff.queryKeyFn;
export const useCreateStaff = makeCreateHook("staff");
export const useUpdateStaff = makeUpdateHook("staff");
export const useDeleteStaff = makeDeleteHook("staff");

const getStaff = makeGetHook("staff");
export const useGetStaff = getStaff.hook;
export const getGetStaffQueryKey = getStaff.queryKeyFn;

const getStaffCompliance = makeGetHook("staff", "compliance");
export const useGetStaffCompliance = getStaffCompliance.hook;
export const getGetStaffComplianceQueryKey = getStaffCompliance.queryKeyFn;

const getStaffAvailability = makeGetHook("staff", "availability");
export const useGetStaffAvailability = getStaffAvailability.hook;

// --- Shifts ---
const shifts = makeListHook("shifts");
export const useListShifts = shifts.hook;
export const getListShiftsQueryKey = shifts.queryKeyFn;
export const useCreateShift = makeCreateHook("shifts");
export const useUpdateShift = makeUpdateHook("shifts");
export const useDeleteShift = makeDeleteHook("shifts");

// --- Service Agreements ---
const serviceAgreements = makeListHook("service-agreements");
export const useListServiceAgreements = serviceAgreements.hook;
export const getListServiceAgreementsQueryKey = serviceAgreements.queryKeyFn;
export const useCreateServiceAgreement = makeCreateHook("service-agreements");

// --- Incidents ---
const incidents = makeListHook("incidents");
export const useListIncidents = incidents.hook;
export const getListIncidentsQueryKey = incidents.queryKeyFn;
export const useCreateIncident = makeCreateHook("incidents");

// --- Case Notes ---
const caseNotes = makeListHook("case-notes");
export const useListCaseNotes = caseNotes.hook;
export const getListCaseNotesQueryKey = caseNotes.queryKeyFn;
export const useCreateCaseNote = makeCreateHook("case-notes");
export const useDeleteCaseNote = makeDeleteHook("case-notes");

// --- Invoices ---
const invoices = makeListHook("invoices");
export const useListInvoices = invoices.hook;
export const getListInvoicesQueryKey = invoices.queryKeyFn;

// --- Dashboard ---
const dashboardSummary = makeGetHook("dashboard", "summary");
export const useGetDashboardSummary = dashboardSummary.hook;

const dashboardUpcomingShifts = makeGetHook("dashboard", "upcoming-shifts");
export const useGetDashboardUpcomingShifts = dashboardUpcomingShifts.hook;

const dashboardComplianceOverview = makeGetHook("dashboard", "compliance-overview");
export const useGetDashboardComplianceOverview = dashboardComplianceOverview.hook;
