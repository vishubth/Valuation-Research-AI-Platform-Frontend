"use client";

import { useParams } from "next/navigation";
import { useEngagement, useGates } from "../../lib/hooks";
import { StatusBadge, Badge } from "../../components/Badge";
import { Spinner } from "../../components/Spinner";

function formatTs(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-600">{label}</dt>
      <dd className="text-sm text-slate-200">{children}</dd>
    </div>
  );
}

export default function OverviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const engQuery = useEngagement(id);
  const gatesQuery = useGates(id);
  const eng = engQuery.data;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-slate-600">Engagement Details</h2>
        {eng ? (
          <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
            <Field label="Client name">{eng.client_name || "—"}</Field>
            <Field label="Purpose">{eng.purpose || "—"}</Field>
            <Field label="Status"><StatusBadge status={eng.status} /></Field>
            <Field label="Current stage">
              <span className="font-mono text-xs text-slate-400">{eng.current_stage || "—"}</span>
            </Field>
            <Field label="Created">{formatTs(eng.created_at)}</Field>
            <Field label="Updated">{formatTs(eng.updated_at)}</Field>
          </dl>
        ) : <Spinner />}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
        <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-widest text-slate-600">Gate Summary</h2>
        {gatesQuery.isLoading ? <Spinner /> : (gatesQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-600">No gates yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {(gatesQuery.data ?? []).map((g) => (
              <div key={g.gate_key} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <span className="w-7 font-mono text-xs font-bold text-slate-600">{g.gate_key}</span>
                  {g.label && <span className="text-sm text-slate-300">{g.label}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={g.status === "approved" ? "green" : g.status === "rejected" ? "red" : "gray"}>
                    {g.status ?? "pending"}
                  </Badge>
                  {(g.approved_by_name || g.approved_by_email) && (
                    <span className="text-xs text-slate-500">{g.approved_by_name || g.approved_by_email}</span>
                  )}
                  {g.notes && (
                    <span className="max-w-xs truncate text-xs italic text-slate-600">"{g.notes}"</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
