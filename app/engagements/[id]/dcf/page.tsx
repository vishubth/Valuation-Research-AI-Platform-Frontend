"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useComparableSet, useDcfModel, useGates } from "../../../lib/hooks";
import { StatusBadge } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { Card, EmptyState, ErrorBox } from "../../../components/Section";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import { formatMoney, formatNumber, formatPercent, formatTraceValue, titleCase } from "../../../lib/format";
import type { DcfModel, SensitivityGrid } from "../../../lib/types";

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function shadeColor(value: number, min: number, max: number): string {
  if (max === min) return "rgba(255,255,255,0.03)";
  const t = (value - min) / (max - min); // 0..1
  // red (low) -> green (high)
  const r = Math.round(220 * (1 - t));
  const g = Math.round(180 * t);
  return `rgba(${r}, ${g}, 80, 0.18)`;
}

function SensitivityGridTable({ grid }: { grid: SensitivityGrid }) {
  const rowValues = grid.row_values ?? [];
  const colValues = grid.col_values ?? [];
  const cells = grid.grid ?? [];
  const allValues = cells.flat().filter((v) => typeof v === "number");
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;

  const rowLabel = grid.row_param ?? "Discount Rate";
  const colLabel = grid.col_param ?? "Terminal Growth";

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-slate-600">
        Rows: {rowLabel} · Columns: {colLabel}
      </p>
      <table className="text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              ↓ {rowLabel} \ {colLabel} →
            </th>
            {colValues.map((c) => (
              <th key={c} className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">
                {formatPercent(c, 1)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowValues.map((rv, ri) => (
            <tr key={rv}>
              <td className="px-3 py-2 font-mono text-xs text-slate-400">{formatPercent(rv, 1)}</td>
              {colValues.map((_, ci) => {
                const ev = cells[ri]?.[ci];
                return (
                  <td
                    key={ci}
                    className="px-3 py-2 text-right font-mono text-xs text-slate-200"
                    style={{ backgroundColor: ev !== undefined ? shadeColor(ev, min, max) : undefined }}
                  >
                    {ev !== undefined ? formatMoney(ev) : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DcfEditForm({ model, engagementId }: { model: DcfModel; engagementId: string }) {
  const queryClient = useQueryClient();
  const [waccText, setWaccText] = useState(JSON.stringify(model.wacc_inputs ?? {}, null, 2));
  const [projText, setProjText] = useState(JSON.stringify(model.projection_inputs ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      let wacc_inputs: unknown;
      let projection_inputs: unknown;
      try {
        wacc_inputs = JSON.parse(waccText || "{}");
        projection_inputs = JSON.parse(projText || "{}");
      } catch {
        throw new ApiError("invalid_json", "WACC or projection inputs are not valid JSON.");
      }
      await apiClient.patch(`/dcf-models/${model.id}/inputs`, { wacc_inputs, projection_inputs });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["dcf-model", engagementId] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Update failed."),
  });

  return (
    <Card title="Edit Inputs (Power Tool)">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600">WACC Inputs (JSON)</label>
          <textarea
            value={waccText}
            onChange={(e) => setWaccText(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600">Projection Inputs (JSON)</label>
          <textarea
            value={projText}
            onChange={(e) => setProjText(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          disabled={mutation.isPending}
          onClick={() => { setError(null); mutation.mutate(); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          {mutation.isPending ? "Recalculating…" : "Recalculate"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved — model & narrative refreshed</span>}
      </div>
    </Card>
  );
}

export default function DcfPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gatesQuery = useGates(id);
  const dcfQuery = useDcfModel(id);
  const compQuery = useComparableSet(id);

  const g5 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G5");
  const isNotFound =
    dcfQuery.isError && dcfQuery.error instanceof ApiError && dcfQuery.error.status === 404;

  if (dcfQuery.isLoading) return <Spinner />;
  if (isNotFound)
    return <EmptyState title="No DCF model yet" subtitle="Approve G4 and wait for the DCF agent to run." />;
  if (dcfQuery.isError)
    return <ErrorBox>{dcfQuery.error instanceof ApiError ? dcfQuery.error.message : "Failed to load DCF model."}</ErrorBox>;

  const m = dcfQuery.data;
  if (!m) return <EmptyState title="No DCF model yet" />;

  // Backend stores results in nested sub-objects: wacc_result and dcf_result
  const waccResult = m.wacc_result ?? {};
  const dcfResult = m.dcf_result ?? {};
  const trace = waccResult.calculation_trace ?? {};
  const projections = dcfResult.year_by_year_breakdown ?? [];
  const sensitivity = m.sensitivity_grid;
  const comp = compQuery.data;

  // Flatten key values for display
  const enterpriseValue = dcfResult.enterprise_value;
  const pvCashFlows = dcfResult.pv_of_cash_flows;
  const pvTerminalValue = dcfResult.pv_of_terminal_value;
  const terminalMethod = dcfResult.terminal_value_method;
  const wacc = waccResult.wacc;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">DCF Model</h2>
        {m.status && <StatusBadge status={m.status} />}
      </div>

      {m.error_message && <ErrorBox>{m.error_message}</ErrorBox>}

      {/* Enterprise value summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBox label="Enterprise Value" value={formatMoney(enterpriseValue)} />
        <StatBox label="PV of Cash Flows" value={formatMoney(pvCashFlows)} />
        <StatBox label="PV of Terminal Value" value={formatMoney(pvTerminalValue)} />
      </div>

      {/* WACC breakdown — fully visible for auditability */}
      <Card title="WACC Breakdown">
        {Object.keys(waccResult).filter(k => k !== "calculation_trace").length > 0 || Object.keys(trace).length > 0 ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Top-level wacc_result fields first */}
            {Object.entries(waccResult).filter(([k]) => k !== "calculation_trace").map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="text-sm text-slate-400">{titleCase(k)}</span>
                <span className="font-mono text-sm text-slate-200">{formatTraceValue(k, v)}</span>
              </div>
            ))}
            {/* Intermediate calculation_trace values */}
            {Object.entries(trace as Record<string, unknown>).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="text-sm text-slate-400">{titleCase(k)}</span>
                <span className="font-mono text-sm text-slate-200">{formatTraceValue(k, v)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No calculation trace available.</p>
        )}
      </Card>

      {/* Projections */}
      {projections.length > 0 && (
        <Card title="Cash Flow Projections">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Year</th>
                  <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">FCF</th>
                  <th className="pb-2.5 pr-5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Discount Factor</th>
                  <th className="pb-2.5 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600">Present Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {projections.map((y) => (
                  <tr key={y.year}>
                    <td className="py-2.5 pr-5 text-slate-300">{y.year}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-slate-200">{formatMoney(y.fcf)}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-slate-400">{formatNumber(y.discount_factor, 4)}</td>
                    <td className="py-2.5 text-right font-mono text-slate-200">{formatMoney(y.present_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-xs text-slate-500">
            {terminalMethod && <span>Terminal Method: <span className="text-slate-300">{titleCase(terminalMethod)}</span></span>}
            {wacc != null && <span>WACC: <span className="font-mono text-slate-300">{formatPercent(wacc)}</span></span>}
          </div>
        </Card>
      )}

      {/* Sensitivity */}
      {sensitivity && (sensitivity.row_values?.length ?? 0) > 0 && (
        <Card title="Sensitivity Analysis (Enterprise Value)">
          <SensitivityGridTable grid={sensitivity} />
        </Card>
      )}

      {/* AI narrative — visually distinct from deterministic numbers */}
      {m.narrative && (
        <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 px-6 py-5">
          <div className="mb-3 flex items-center gap-2">
            <svg className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">AI-Generated Commentary</span>
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{m.narrative}</p>
        </div>
      )}

      <DcfEditForm model={m} engagementId={id} />

      {g5 && user && (
        <GateApprovalPanel engagementId={id} gate={g5} currentUserRole={user.role}>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              <span>Enterprise Value: <span className="font-mono text-white">{formatMoney(enterpriseValue)}</span></span>
              {terminalMethod && <span>Terminal Method: <span className="text-slate-300">{titleCase(terminalMethod)}</span></span>}
              {wacc != null && <span>WACC: <span className="font-mono text-slate-300">{formatPercent(wacc)}</span></span>}
            </div>
            {comp && (
              <div>
                Comparable set: <span className="text-slate-300">{comp.status === "no_comparables_found" ? "no comparables found" : `${comp.comparables?.length ?? 0} companies`}</span>
              </div>
            )}
          </div>
        </GateApprovalPanel>
      )}
    </div>
  );
}
