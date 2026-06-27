"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useAuditLog } from "../../../lib/hooks";
import { Spinner } from "../../../components/Spinner";
import { ErrorBox } from "../../../components/Section";
import { relativeTime, titleCase, triggerBlobDownload } from "../../../lib/format";
import type { AuditEntry } from "../../../lib/types";

const PAGE_SIZES = [10, 25, 50];

function summarizeDetails(entry: AuditEntry): string {
  const p = entry.payload ?? {};
  const action = entry.action.toLowerCase();
  if (action.startsWith("gate")) {
    const gate = (p.gate_key ?? p.gate ?? "") as string;
    const notes = p.notes ? ` — "${p.notes}"` : "";
    const approach = p.selected_approach ? ` (approach: ${p.selected_approach})` : "";
    return [gate, approach, notes].filter(Boolean).join("") || "—";
  }
  if (action.startsWith("config")) {
    return (p.config_key as string) ?? "—";
  }
  // Generic: show a couple of scalar payload fields as plain text.
  const scalars = Object.entries(p)
    .filter(([, v]) => v === null || ["string", "number", "boolean"].includes(typeof v))
    .slice(0, 3)
    .map(([k, v]) => `${titleCase(k)}: ${v === null ? "—" : String(v)}`);
  return scalars.length ? scalars.join(", ") : "—";
}

export default function AuditLogPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  const logQuery = useAuditLog(id, page, pageSize);
  const items = logQuery.data?.items ?? [];
  const total = (logQuery.data?.meta?.total as number) ?? undefined;
  const totalPages = total ? Math.max(1, Math.ceil(total / pageSize)) : undefined;

  async function doExport(format: "json" | "pdf") {
    setExporting(format);
    setExportError(null);
    try {
      const blob = await apiClient.getBlob(`/engagements/${id}/audit-log/export?format=${format}`);
      triggerBlobDownload(blob, `audit-log-${id}.${format}`);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-600">Page size</label>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
          >
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {exportError && <span className="text-sm text-red-400">{exportError}</span>}
          <button
            disabled={exporting === "json"}
            onClick={() => doExport("json")}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
          >
            {exporting === "json" ? "Exporting…" : "Export JSON"}
          </button>
          <button
            disabled={exporting === "pdf"}
            onClick={() => doExport("pdf")}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
          >
            {exporting === "pdf" ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#161b22]">
        {logQuery.isLoading ? (
          <div className="px-5"><Spinner /></div>
        ) : logQuery.isError ? (
          <div className="px-5 py-4">
            <ErrorBox>{logQuery.error instanceof ApiError ? logQuery.error.message : "Failed to load audit log."}</ErrorBox>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-600">No audit entries.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Time</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Actor</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Action</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {items.map((e) => (
                <tr key={e.id}>
                  <td className="px-5 py-3 text-slate-500" title={new Date(e.created_at).toLocaleString()}>
                    {relativeTime(e.created_at)}
                  </td>
                  <td className="px-5 py-3 text-slate-300">
                    {e.actor_full_name || e.actor_email || "—"}
                  </td>
                  <td className="px-5 py-3 text-slate-200">{titleCase(e.action)}</td>
                  <td className="px-5 py-3 text-slate-400">{summarizeDetails(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-3">
          <span className="text-xs text-slate-600">
            Page {page}{totalPages ? ` of ${totalPages}` : ""}
            {total !== undefined ? ` · ${total} total` : ""}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <button
              disabled={totalPages ? page >= totalPages : items.length < pageSize}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/[0.04] disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
