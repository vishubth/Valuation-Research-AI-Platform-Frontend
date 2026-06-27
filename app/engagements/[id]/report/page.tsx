"use client";

import { useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useGates, useReport } from "../../../lib/hooks";
import { Spinner } from "../../../components/Spinner";
import { EmptyState, ErrorBox } from "../../../components/Section";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import { titleCase, triggerBlobDownload } from "../../../lib/format";
import { REPORT_SECTION_ORDER, type ReportSection } from "../../../lib/types";

// Render content, styling citation markers like [1] as small indigo superscripts.
function renderContent(content: string): ReactNode[] {
  const parts = content.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (m) {
      return (
        <sup key={i} className="mx-0.5 rounded bg-indigo-500/20 px-1 text-[10px] font-semibold text-indigo-300">
          {m[1]}
        </sup>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function CitationIndicator({ passed }: { passed?: boolean | null }) {
  if (passed === null || passed === undefined) return null;
  if (passed) {
    return (
      <span title="Citations validated" className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        Citations OK
      </span>
    );
  }
  return (
    <span title="Citation validation failed (non-blocking)" className="inline-flex items-center gap-1 text-xs text-amber-400">
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      Citation warning
    </span>
  );
}

function SectionCard({ section, engagementId }: { section: ReportSection; engagementId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["report", engagementId] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.patch(
        `/engagements/${engagementId}/report/sections/${section.section_key}`,
        { content: draft }
      );
    },
    onSuccess: () => {
      setEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Save failed."),
  });

  const regenMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(
        `/engagements/${engagementId}/report/sections/${section.section_key}/regenerate`
      );
    },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Regenerate failed."),
  });

  const busy = regenMutation.isPending;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-white">{titleCase(section.section_key)}</h3>
          <CitationIndicator passed={section.citation_validation_passed} />
        </div>
        {!editing && (
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-emerald-400">Saved</span>}
            <button
              onClick={() => { setDraft(section.content ?? ""); setError(null); setEditing(true); }}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Edit
            </button>
            <button
              disabled={busy}
              onClick={() => { setError(null); regenMutation.mutate(); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 px-3 py-1.5 text-xs text-violet-300 hover:bg-violet-500/10 disabled:opacity-40 transition-colors"
            >
              {busy && (
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {busy ? "Regenerating…" : "Regenerate"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={saveMutation.isPending}
              onClick={() => { setError(null); saveMutation.mutate(); }}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              {saveMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setEditing(false); setError(null); }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : busy ? (
        <Spinner label="Regenerating section…" />
      ) : section.content ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{renderContent(section.content)}</p>
      ) : (
        <p className="text-sm text-slate-600">No content yet.</p>
      )}
      {error && !editing && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gatesQuery = useGates(id);
  const reportQuery = useReport(id);

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const g6 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G6");
  const isNotFound =
    reportQuery.isError && reportQuery.error instanceof ApiError && reportQuery.error.status === 404;

  async function exportDocx() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await apiClient.getBlob(`/engagements/${id}/report/export`);
      triggerBlobDownload(blob, `report-${id}.docx`);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (reportQuery.isLoading) return <Spinner />;
  if (isNotFound)
    return <EmptyState title="No report yet" subtitle="Approve G5 and wait for the report agent to run." />;
  if (reportQuery.isError)
    return <ErrorBox>{reportQuery.error instanceof ApiError ? reportQuery.error.message : "Failed to load report."}</ErrorBox>;

  const report = reportQuery.data;
  const sectionsByKey = new Map((report?.sections ?? []).map((s) => [s.section_key, s]));
  // Render in fixed canonical order; include any unexpected extra sections at the end.
  const ordered: ReportSection[] = [
    ...REPORT_SECTION_ORDER.map((key) => sectionsByKey.get(key) ?? { section_key: key, content: null }),
    ...(report?.sections ?? []).filter((s) => !REPORT_SECTION_ORDER.includes(s.section_key as never)),
  ];

  return (
    <div className="space-y-4">
      {report?.error_message && <ErrorBox>{report.error_message}</ErrorBox>}

      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Valuation Report</h2>
        <div className="flex items-center gap-3">
          {exportError && <span className="text-sm text-red-400">{exportError}</span>}
          <button
            disabled={exporting}
            onClick={exportDocx}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {exporting ? "Exporting…" : "Export DOCX"}
          </button>
        </div>
      </div>

      {ordered.map((s) => (
        <SectionCard key={s.section_key} section={s} engagementId={id} />
      ))}

      {g6 && user && (
        <GateApprovalPanel engagementId={id} gate={g6} currentUserRole={user.role}>
          <p className="text-sm text-slate-400">
            {(report?.sections ?? []).length} sections. Status: {report?.status ?? "—"}.
          </p>
        </GateApprovalPanel>
      )}
    </div>
  );
}
