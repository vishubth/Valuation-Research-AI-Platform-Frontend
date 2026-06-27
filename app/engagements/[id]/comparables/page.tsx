"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useComparableSet } from "../../../lib/hooks";
import { StatusBadge } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { Card, EmptyState, ErrorBox } from "../../../components/Section";
import { formatMoney, formatNumber, titleCase } from "../../../lib/format";
import type { ComparableSet, MultiplesSummary } from "../../../lib/types";

const CRITERIA_FIELDS = [
  { key: "naics_code", label: "NAICS Code" },
  { key: "sector", label: "Sector" },
  { key: "market_cap_min", label: "Market Cap Min" },
  { key: "market_cap_max", label: "Market Cap Max" },
];

function normalizeMultiples(
  raw: ComparableSet["multiples_summary"]
): MultiplesSummary[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as MultiplesSummary[];
  // Object form: { "ev_ebitda": { mean, median, ... }, ... }
  return Object.entries(raw).map(([metric, v]) => {
    const obj = (v ?? {}) as Record<string, number | null>;
    return { metric, ...obj } as MultiplesSummary;
  });
}

function CriteriaEditor({ set, engagementId }: { set: ComparableSet; engagementId: string }) {
  const queryClient = useQueryClient();
  const initial: Record<string, string> = {};
  CRITERIA_FIELDS.forEach((f) => {
    const v = (set.screening_criteria ?? {})[f.key];
    initial[f.key] = v === null || v === undefined ? "" : String(v);
  });
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValues(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const criteria: Record<string, unknown> = {};
      CRITERIA_FIELDS.forEach((f) => {
        const raw = values[f.key].trim();
        if (raw === "") return;
        const num = Number(raw);
        criteria[f.key] = f.key.includes("market_cap") && !Number.isNaN(num) ? num : raw;
      });
      await apiClient.patch(`/comparable-sets/${set.id}/criteria`, { screening_criteria: criteria });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["comparable-set", engagementId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Update failed."),
  });

  return (
    <Card title="Screening Criteria">
      <div className="grid gap-4 sm:grid-cols-2">
        {CRITERIA_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600">{f.label}</label>
            <input
              value={values[f.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={mutation.isPending}
          onClick={() => { setError(null); mutation.mutate(); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          {mutation.isPending ? "Saving…" : "Update criteria"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </Card>
  );
}

export default function ComparablesPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const setQuery = useComparableSet(id);

  const isNotFound =
    setQuery.isError && setQuery.error instanceof ApiError && setQuery.error.status === 404;

  if (setQuery.isLoading) return <Spinner />;
  if (isNotFound)
    return <EmptyState title="No comparable set yet" subtitle="Approve G4 and wait for the comparables agent to run." />;
  if (setQuery.isError)
    return <ErrorBox>{setQuery.error instanceof ApiError ? setQuery.error.message : "Failed to load comparable set."}</ErrorBox>;

  const set = setQuery.data;
  if (!set) return <EmptyState title="No comparable set yet" />;

  const noComps = set.status === "no_comparables_found";
  const comps = set.comparables ?? [];
  const multiples = normalizeMultiples(set.multiples_summary);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Comparable Companies</h2>
        <StatusBadge status={set.status} />
      </div>

      {set.error_message && <ErrorBox>{set.error_message}</ErrorBox>}

      {noComps ? (
        <Card title="No Matching Public Companies Found">
          <p className="text-sm leading-relaxed text-slate-300">
            The screening process did not find any public companies matching the criteria below.
            This is an honest result — no comparable set was fabricated.
          </p>
          {set.screening_criteria && (
            <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {Object.entries(set.screening_criteria).map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">{titleCase(k)}</dt>
                  <dd className="mt-1 text-sm text-slate-200">{v === null || v === undefined ? "—" : String(v)}</dd>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <>
          {comps.length > 0 && (
            <Card title="Companies">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Company</th>
                      <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Ticker</th>
                      <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">EV/EBITDA</th>
                      <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">EV/Revenue</th>
                      <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Market Cap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {comps.map((c, i) => (
                      <tr key={c.ticker ?? i}>
                        <td className="py-2.5 pr-5 text-slate-200">{c.name ?? "—"}</td>
                        <td className="py-2.5 pr-5 font-mono text-xs text-slate-400">{c.ticker ?? "—"}</td>
                        <td className="py-2.5 pr-5 text-right font-mono text-slate-300">{formatNumber(c.ev_ebitda, 1)}x</td>
                        <td className="py-2.5 pr-5 text-right font-mono text-slate-300">{formatNumber(c.ev_revenue, 1)}x</td>
                        <td className="py-2.5 text-right font-mono text-slate-300">{formatMoney(c.market_cap)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {multiples.length > 0 && (
            <Card title="Multiples Summary">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Metric</th>
                      <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Mean</th>
                      <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Median</th>
                      <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Min</th>
                      <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Max</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {multiples.map((m, i) => (
                      <tr key={i}>
                        <td className="py-2.5 pr-5 text-slate-200">{titleCase(m.metric)}</td>
                        <td className="py-2.5 pr-5 text-right font-mono text-slate-300">{formatNumber(m.mean, 1)}</td>
                        <td className="py-2.5 pr-5 text-right font-mono text-slate-300">{formatNumber(m.median, 1)}</td>
                        <td className="py-2.5 pr-5 text-right font-mono text-slate-300">{formatNumber(m.min, 1)}</td>
                        <td className="py-2.5 text-right font-mono text-slate-300">{formatNumber(m.max, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {set.selection_rationale && (
            <Card title="Selection Rationale">
              <p className="text-sm leading-relaxed text-slate-400">{set.selection_rationale}</p>
            </Card>
          )}
        </>
      )}

      <CriteriaEditor set={set} engagementId={id} />
    </div>
  );
}
