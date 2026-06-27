"use client";

import { useParams } from "next/navigation";
import { ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useGates, useReviewChecklist } from "../../../lib/hooks";
import { Spinner } from "../../../components/Spinner";
import { Card, EmptyState, ErrorBox } from "../../../components/Section";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import { titleCase } from "../../../lib/format";
import type { ChecklistItem } from "../../../lib/types";

const OVERALL: Record<string, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  pass_with_warnings: { label: "Pass with Warnings", cls: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  fail: { label: "Failed", cls: "border-red-500/30 bg-red-500/10 text-red-400" },
};

function ItemIcon({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "pass") {
    return (
      <svg className="h-4 w-4 flex-shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (s === "warning") {
    return (
      <svg className="h-4 w-4 flex-shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

export default function ReviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gatesQuery = useGates(id);
  const reviewQuery = useReviewChecklist(id);

  const g7 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G7");
  const isNotFound =
    reviewQuery.isError && reviewQuery.error instanceof ApiError && reviewQuery.error.status === 404;

  if (reviewQuery.isLoading) return <Spinner />;
  if (isNotFound)
    return <EmptyState title="No review checklist yet" subtitle="Approve G6 and wait for the review agent to run." />;
  if (reviewQuery.isError)
    return <ErrorBox>{reviewQuery.error instanceof ApiError ? reviewQuery.error.message : "Failed to load review checklist."}</ErrorBox>;

  const r = reviewQuery.data;
  const overall = OVERALL[(r?.overall_status ?? "").toLowerCase()] ?? {
    label: r?.overall_status ?? "Unknown",
    cls: "border-white/10 bg-white/[0.04] text-slate-400",
  };
  const items: ChecklistItem[] = r?.checklist_results ?? [];

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border-2 px-6 py-5 ${overall.cls}`}>
        <p className="text-[11px] font-semibold uppercase tracking-widest opacity-70">Overall Status</p>
        <p className="mt-1 text-2xl font-bold">{overall.label}</p>
      </div>

      <Card title="Checklist">
        {items.length === 0 ? (
          <p className="text-sm text-slate-600">No checklist items.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5"><ItemIcon status={it.status} /></span>
                <div>
                  <p className="text-sm font-medium text-slate-200">{it.description || titleCase(it.item)}</p>
                  {it.details && <p className="mt-0.5 text-xs text-slate-500">{it.details}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {g7 && user && (
        <div className="space-y-2">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-red-400">
            Final gate — admin approval required. Approving marks the engagement completed.
          </div>
          <GateApprovalPanel engagementId={id} gate={g7} currentUserRole={user.role}>
            <p className="text-sm text-slate-400">Overall review status: <span className="font-semibold text-white">{overall.label}</span></p>
          </GateApprovalPanel>
        </div>
      )}
    </div>
  );
}
