import { fetchWithAuthJson } from "../fetchWithAuth";

export type AIActionName =
  | "auto_schedule_staff"
  | "draft_documentation"
  | "resource_optimisation";

export type AIActionStatus = "draft" | "approved" | "rejected";

export interface AIActionRun {
  id: string;
  organizationId: string;
  userId: string | null;
  actionName: string;
  status: AIActionStatus;
  input: Record<string, unknown>;
  result: Record<string, unknown>;
  requiresApproval: boolean;
  approvedByUserId: string | null;
  approvedAt: string | null;
  rejectedByUserId: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function runAIActionNow(actionName: AIActionName, input: Record<string, unknown> = {}) {
  return fetchWithAuthJson<{ actionRun: AIActionRun; result: Record<string, unknown>; message: string }>(
    "/api/ai-actions/run",
    {
      method: "POST",
      body: JSON.stringify({ actionName, input }),
    },
  );
}

export async function listAIActionRuns() {
  return fetchWithAuthJson<{ runs: AIActionRun[] }>("/api/ai-actions/runs");
}

export async function approveAIAction(actionRunId: string) {
  return fetchWithAuthJson<{ actionRun: AIActionRun; message: string }>("/api/ai-actions/approve", {
    method: "POST",
    body: JSON.stringify({ actionRunId }),
  });
}

export async function rejectAIAction(actionRunId: string) {
  return fetchWithAuthJson<{ actionRun: AIActionRun }>("/api/ai-actions/reject", {
    method: "POST",
    body: JSON.stringify({ actionRunId }),
  });
}

export async function getAIAutomationSettings() {
  return fetchWithAuthJson<{
    aiFeaturesEnabled: boolean;
    aiPoweredActionsEnabled: boolean;
  }>("/api/ai-actions/settings");
}

export async function updateAIAutomationSettings(settings: {
  aiFeaturesEnabled: boolean;
  aiPoweredActionsEnabled: boolean;
}) {
  return fetchWithAuthJson<{
    aiFeaturesEnabled: boolean;
    aiPoweredActionsEnabled: boolean;
  }>("/api/ai-actions/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
