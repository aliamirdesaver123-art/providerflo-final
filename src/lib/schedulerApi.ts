import { fetchWithAuthJson } from "@/lib/fetchWithAuth";
import type { PremiumShiftPayload, PremiumShiftPreview } from "@/components/scheduler/schedulerTypes";

export async function previewPremiumShift(payload: PremiumShiftPayload): Promise<PremiumShiftPreview> {
  return fetchWithAuthJson<PremiumShiftPreview>("/api/scheduler/premium/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createPremiumShift(payload: PremiumShiftPayload): Promise<{
  created: number;
  skipped: number;
  locked: number;
  message: string;
}> {
  return fetchWithAuthJson("/api/scheduler/premium/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getWorkerMatches(payload: PremiumShiftPayload): Promise<{
  suggestions: PremiumShiftPreview["aiWorkerSuggestions"];
}> {
  return fetchWithAuthJson("/api/scheduler/premium/worker-matches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
