import { queryClient } from "@/lib/queryClient";

const API_BASE = "/api";

export class ImportApiError extends Error {
  code: string;
  details?: unknown;
  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ImportApiError";
    this.code = code;
    this.details = details;
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.success === false) {
    const error = body?.error ?? {};
    throw new ImportApiError(error.code || "IMPORT_REQUEST_FAILED", error.message || `Import request failed with ${res.status}`, error.details);
  }
  return (body?.data ?? body) as T;
}

export async function uploadImportFile(input: { file: File; importType?: string | null }) {
  const form = new FormData();
  form.append("file", input.file);
  if (input.importType) form.append("importType", input.importType);
  const res = await fetch(`${API_BASE}/import/upload`, { method: "POST", body: form, credentials: "include" });
  return parseResponse<{ jobId: string; fileId: string; headers: string[]; totalRows: number; status: string; extractionMode?: string; warnings?: string[] }>(res);
}

export async function analyseImportJob(jobId: string) {
  const res = await fetch(`${API_BASE}/import/jobs/${jobId}/analyse`, { method: "POST", credentials: "include" });
  return parseResponse<{ jobId: string; queued: boolean; status: string }>(res);
}

export async function validateImportJob(jobId: string, input: { importType: string; mappings: Record<string, string | null> }) {
  const res = await fetch(`${API_BASE}/import/jobs/${jobId}/validate`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseResponse<any>(res);
}

export async function commitImportJob(jobId: string) {
  const res = await fetch(`${API_BASE}/import/jobs/${jobId}/commit`, { method: "POST", credentials: "include" });
  const data = await parseResponse<any>(res);
  invalidateImportTargets(data?.importType || data?.type);
  return data;
}

export async function retryFailedRows(jobId: string, rowNumbers?: number[]) {
  const res = await fetch(`${API_BASE}/import/jobs/${jobId}/retry-failed`, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rowNumbers }),
  });
  return parseResponse<any>(res);
}

export async function getAiRowFixes(jobId: string) {
  const res = await fetch(`${API_BASE}/import/jobs/${jobId}/ai-row-fixes`, { method: "POST", credentials: "include" });
  return parseResponse<{ fixes: Array<{ rowNumber: number; issue: string; suggestedFix: string }> }>(res);
}

export async function getImportJob(jobId: string) {
  const res = await fetch(`${API_BASE}/import/jobs/${jobId}`, { credentials: "include" });
  return parseResponse<any>(res);
}

export async function listImportJobs() {
  const res = await fetch(`${API_BASE}/import/jobs`, { credentials: "include" });
  return parseResponse<any[]>(res);
}

export function getImportErrorCsvUrl(jobId: string) {
  return `${API_BASE}/import/jobs/${jobId}/errors.csv`;
}

export function getQueryKeysToInvalidate(importType?: string) {
  const base = [["import-jobs"]];
  const map: Record<string, unknown[][]> = {
    participants: [["participants"]],
    staff: [["staff"], ["workers"]],
    shifts: [["shifts"], ["scheduler"], ["roster"]],
    invoices: [["invoices"]],
    documents: [["documents"]],
    casenotes: [["case-notes"], ["notes"]],
    incidents: [["incidents"]],
    tasks: [["tasks"]],
    forms: [["forms"]],
    timesheets: [["timesheets"]],
    contacts: [["participants"]],
    agreements: [["service-agreements"], ["participants"]],
    quotes: [["quotes"]],
  };
  return [...base, ...(importType ? map[importType] ?? [] : [])];
}

export function invalidateImportTargets(importType?: string) {
  for (const key of getQueryKeysToInvalidate(importType)) {
    queryClient.invalidateQueries({ queryKey: key as any });
  }
}

export function humanImportError(error: unknown) {
  if (error instanceof ImportApiError) {
    return `${error.code}: ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return "Import failed. Please try again.";
}
