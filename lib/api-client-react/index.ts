import { useQuery, useMutation } from "@tanstack/react-query";

const noop = () => {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const emptyQuery = (key: string) => (..._args: any[]) =>
  useQuery({ queryKey: [key], queryFn: async () => ({}) as any, enabled: false });

const emptyMutation = <TVariables = void,>() => () =>
  useMutation({ mutationFn: async (_vars: TVariables) => ({}) as any });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const queryKeyFn = (key: string) => (...args: any[]) => [key, ...args];

export const useGetDashboardSummary = emptyQuery("dashboard-summary");
export const useGetDashboardUpcomingShifts = emptyQuery("dashboard-upcoming-shifts");
export const useGetDashboardComplianceOverview = emptyQuery("dashboard-compliance");
export const useListParticipants = emptyQuery("participants");
export const useListStaff = emptyQuery("staff");
export const useListShifts = emptyQuery("shifts");
export const useListIncidents = emptyQuery("incidents");
export const useListCaseNotes = emptyQuery("case-notes");
export const useListInvoices = emptyQuery("invoices");
export const useListServiceAgreements = emptyQuery("service-agreements");
export const useGetParticipant = emptyQuery("participant");
export const useGetParticipantGoals = emptyQuery("participant-goals");
export const useGetParticipantContacts = emptyQuery("participant-contacts");
export const useGetStaff = emptyQuery("staff-detail");
export const useGetStaffCompliance = emptyQuery("staff-compliance");
export const useGetStaffAvailability = emptyQuery("staff-availability");
interface CreatePayload { data: Record<string, unknown>; }
interface UpdatePayload { id: number; data: Record<string, unknown>; }
interface DeletePayload { id: number; }

export const useCreateParticipant = emptyMutation<CreatePayload>();
export const useDeleteParticipant = emptyMutation<DeletePayload>();
export const useUpdateParticipant = emptyMutation<UpdatePayload>();
export const useCreateStaff = emptyMutation<CreatePayload>();
export const useDeleteStaff = emptyMutation<DeletePayload>();
export const useUpdateStaff = emptyMutation<UpdatePayload>();
export const useCreateShift = emptyMutation<CreatePayload>();
export const useDeleteShift = emptyMutation<DeletePayload>();
export const useUpdateShift = emptyMutation<UpdatePayload>();
export const useCreateIncident = emptyMutation<CreatePayload>();
export const useCreateCaseNote = emptyMutation<CreatePayload>();
export const useDeleteCaseNote = emptyMutation<DeletePayload>();
export const useCreateServiceAgreement = emptyMutation<CreatePayload>();
export const getListParticipantsQueryKey = queryKeyFn("participants");
export const getListStaffQueryKey = queryKeyFn("staff");
export const getListShiftsQueryKey = queryKeyFn("shifts");
export const getListIncidentsQueryKey = queryKeyFn("incidents");
export const getListCaseNotesQueryKey = queryKeyFn("case-notes");
export const getListInvoicesQueryKey = queryKeyFn("invoices");
export const getListServiceAgreementsQueryKey = queryKeyFn("service-agreements");
export const getGetParticipantQueryKey = queryKeyFn("participant");
export const getGetParticipantGoalsQueryKey = queryKeyFn("participant-goals");
export const getGetStaffQueryKey = queryKeyFn("staff-detail");
export const getGetStaffComplianceQueryKey = queryKeyFn("staff-compliance");
export const setAuthTokenGetter: (fn: () => string | null) => void = noop;
