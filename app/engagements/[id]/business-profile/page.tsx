"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useGates } from "../../../lib/hooks";
import { Badge, ConfidenceBadge, severityTone } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import type { BusinessProfile } from "../../../lib/types";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
      <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-widest text-slate-600">{title}</h2>
      {children}
    </div>
  );
}

export default function BusinessProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gatesQuery = useGates(id);

  const profileQuery = useQuery({
    queryKey: ["business-profile", id],
    enabled: !!id,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get<BusinessProfile>(`/engagements/${id}/business-profile`);
      return res.data;
    },
  });

  const g2 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G2");
  const g1 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G1");
  const isNotFound =
    profileQuery.isError && profileQuery.error instanceof ApiError && profileQuery.error.status === 404;

  const [retriggered, setRetriggered] = useState(false);
  const retriggerMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/engagements/${id}/gates/G1/retrigger`, {});
    },
    onSuccess: () => { setRetriggered(true); setTimeout(() => setRetriggered(false), 3000); },
  });

  if (profileQuery.isLoading) return <Spinner />;

  if (isNotFound) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-20 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
          <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-400">Not yet generated</p>
        <p className="mt-1 text-xs text-slate-600">
          {g1?.status === "approved" ? "Pipeline may have stalled — retrigger below." : "Approve G1 and wait for the pipeline to run."}
        </p>
        {g1?.status === "approved" && (
          <button
            disabled={retriggerMutation.isPending}
            onClick={() => retriggerMutation.mutate()}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {retriggerMutation.isPending ? "Queuing…" : retriggered ? "Pipeline queued!" : "Retrigger Pipeline"}
          </button>
        )}
        {retriggerMutation.isError && (
          <p className="mt-2 text-xs text-red-400">
            {retriggerMutation.error instanceof ApiError ? retriggerMutation.error.message : "Failed to retrigger."}
          </p>
        )}
      </div>
    );
  }

  if (profileQuery.isError) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {profileQuery.error instanceof ApiError ? profileQuery.error.message : "Failed to load business profile."}
      </div>
    );
  }

  const p = profileQuery.data;
  const ic = p?.industry_classification;

  return (
    <div className="space-y-4">
      {p?.error_message && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {p.error_message}
        </div>
      )}

      <Card title="Industry Classification">
        {ic ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-semibold text-white">{ic.naics_code}</span>
              <span className="text-slate-300">{ic.naics_label}</span>
              <ConfidenceBadge band={ic.confidence_band} />
            </div>
            {ic.rationale && <p className="text-sm leading-relaxed text-slate-500">{ic.rationale}</p>}
          </div>
        ) : <p className="text-sm text-slate-600">—</p>}
      </Card>

      <Card title="Revenue Model">
        <p className="text-sm leading-relaxed text-slate-300">{p?.revenue_model_summary || "—"}</p>
      </Card>

      <Card title="Company Stage">
        {p?.company_stage ? <Badge tone="blue">{p.company_stage}</Badge> : <span className="text-sm text-slate-600">—</span>}
      </Card>

      {p?.growth_drivers && p.growth_drivers.length > 0 && (
        <Card title="Growth Drivers">
          <ul className="space-y-2">
            {p.growth_drivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                {d}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {p?.risk_factors && p.risk_factors.length > 0 && (
        <Card title="Risk Factors">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-3 pr-6 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Factor</th>
                <th className="pb-3 pr-6 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Severity</th>
                <th className="pb-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {p.risk_factors.map((r, i) => (
                <tr key={i}>
                  <td className="py-3 pr-6 text-slate-200">{r.factor}</td>
                  <td className="py-3 pr-6"><Badge tone={severityTone(r.severity)}>{r.severity || "—"}</Badge></td>
                  <td className="py-3 text-slate-500">{r.source || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {g2 && user && (
        <GateApprovalPanel engagementId={id} gate={g2} currentUserRole={user.role} />
      )}
    </div>
  );
}
