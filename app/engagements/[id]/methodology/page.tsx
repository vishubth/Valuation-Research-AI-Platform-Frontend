"use client";

import { useParams } from "next/navigation";
import { ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useGates, useMethodology } from "../../../lib/hooks";
import { Badge, ConfidenceBadge, StatusBadge } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { Card, EmptyState, ErrorBox } from "../../../components/Section";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import { titleCase } from "../../../lib/format";

export default function MethodologyPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gatesQuery = useGates(id);
  const methQuery = useMethodology(id);

  const g4 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G4");
  const isNotFound =
    methQuery.isError && methQuery.error instanceof ApiError && methQuery.error.status === 404;

  if (methQuery.isLoading) return <Spinner />;
  if (isNotFound)
    return <EmptyState title="No methodology recommendation yet" subtitle="Approve G3 and wait for the methodology agent to run." />;
  if (methQuery.isError)
    return <ErrorBox>{methQuery.error instanceof ApiError ? methQuery.error.message : "Failed to load methodology."}</ErrorBox>;

  const m = methQuery.data;
  const selected = m?.analyst_selected_approach;
  const recommended = m?.recommended_approach;
  const hasOverride = selected && recommended && selected !== recommended;
  const aligned = selected && recommended && selected === recommended;

  return (
    <div className="space-y-4">
      {m?.error_message && <ErrorBox>{m.error_message}</ErrorBox>}

      <Card title="Recommended Approach">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xl font-semibold text-white">{titleCase(recommended)}</span>
          {m?.confidence_band && (
            <span title={m.confidence != null ? `Raw confidence: ${m.confidence.toFixed(3)}` : undefined}>
              <ConfidenceBadge band={m.confidence_band} />
            </span>
          )}
          {m?.status && <StatusBadge status={m.status} />}
        </div>
        {m?.rationale && (
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{m.rationale}</p>
        )}
      </Card>

      {hasOverride && (
        <div className="rounded-xl border-2 border-amber-500/40 bg-amber-500/10 px-6 py-5">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-bold uppercase tracking-wide text-amber-400">Analyst Override</span>
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Analyst selected <span className="font-semibold text-white">{titleCase(selected)}</span>, overriding the AI recommendation of <span className="font-semibold text-white">{titleCase(recommended)}</span>.
          </p>
        </div>
      )}

      {aligned && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4">
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Analyst selection aligned with the recommendation ({titleCase(selected)}).
          </div>
        </div>
      )}

      {g4 && user && (
        <GateApprovalPanel engagementId={id} gate={g4} currentUserRole={user.role} initialApproach={recommended ?? "income"}>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>Recommended:</span>
            <Badge tone="blue">{titleCase(recommended)}</Badge>
            {selected && (
              <>
                <span>Selected:</span>
                <Badge tone={hasOverride ? "orange" : "green"}>{titleCase(selected)}</Badge>
              </>
            )}
          </div>
        </GateApprovalPanel>
      )}
    </div>
  );
}
