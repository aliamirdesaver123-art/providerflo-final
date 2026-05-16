import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getImportErrorCsvUrl, getImportJob, retryFailedRows } from "@/lib/importApi";

type Props = { jobId: string; onRefresh?: () => void };

export function ImportJobStatusPanel({ jobId, onRefresh }: Props) {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      setJob(await getImportJob(jobId));
      onRefresh?.();
    } catch (e: any) {
      setError(e?.message || "Could not load import job.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 3500);
    return () => window.clearInterval(id);
  }, [jobId]);

  const j = job?.job;
  const progress = Number(j?.progress_percent ?? 0);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold text-sm truncate">Import job status</h3>
          <p className="text-xs text-muted-foreground truncate">{j?.original_filename || jobId}</p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}>Refresh</Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {j && (
        <>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <Stat label="Status" value={j.status} />
            <Stat label="Total" value={j.total_rows ?? 0} />
            <Stat label="Valid" value={j.valid_rows ?? 0} />
            <Stat label="Failed" value={j.failed_rows ?? job?.failedRows?.length ?? 0} />
            <Stat label="Committed" value={j.committed_rows ?? 0} />
          </div>

          {j.ai_error_message && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <strong>AI mapping warning:</strong> {j.ai_error_message}. Manual mapping can continue.
            </div>
          )}

          {!!job?.failedRows?.length && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-sm text-red-800">Failed rows: {job.failedRows.length}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.open(getImportErrorCsvUrl(jobId), "_blank")}>Download CSV</Button>
                  <Button size="sm" onClick={async () => { await retryFailedRows(jobId); await refresh(); }}>Retry Failed</Button>
                </div>
              </div>
              <div className="max-h-48 overflow-auto text-xs space-y-1">
                {job.failedRows.slice(0, 20).map((row: any) => (
                  <div key={row.id || row.row_number} className="rounded bg-white p-2 border">
                    <strong>Row {row.row_number}:</strong> {row.error_code} — {row.error_message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="rounded-lg bg-gray-50 p-2"><div className="text-muted-foreground">{label}</div><div className="font-bold truncate">{String(value)}</div></div>;
}
