"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useProjection, useGates, useDcfModel } from "../../../lib/hooks";
import { useAuth } from "../../../lib/auth-context";
import { ConfidenceBadge, StatusBadge } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { EmptyState, ErrorBox, Card } from "../../../components/Section";
import { formatMoney, formatPercent, formatNumber, titleCase } from "../../../lib/format";
import type {
  ProjectionModel,
  ProjectedYear,
  HistoricalYear,
  DriverSuggestion,
  ISDrivers,
  BSDrivers,
  CFDrivers,
  WACCSuggestion,
  SensitivityGrid,
} from "../../../lib/types";

// ── Unit scale ────────────────────────────────────────────────────────────────

function getUnitMultiplier(currency_unit?: string | null): number {
  const u = (currency_unit ?? "").toLowerCase();
  if (u.includes("million")) return 1e6;
  if (u.includes("billion")) return 1e9;
  if (u.includes("thousand")) return 1e3;
  return 1;
}

// ── Driver drawer ─────────────────────────────────────────────────────────────

interface DrawerState {
  label: string;
  driver: DriverSuggestion;
}

function DriverDrawer({ state, onClose }: { state: DrawerState; onClose: () => void }) {
  const { label, driver } = state;
  const sr = driver.sensitivity_range;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 z-50 flex h-full w-[420px] max-w-full flex-col border-l border-white/[0.08] bg-[#0d1117] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <h3 className="text-sm font-semibold text-white">{label}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Selected value + confidence */}
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-1">Selected Value</p>
              <p className="text-2xl font-bold text-white font-mono">
                {driver.value != null ? (driver.value > 1 ? formatNumber(driver.value, 1) : formatPercent(driver.value)) : "—"}
              </p>
            </div>
            {driver.confidence && (
              <div className="mt-4">
                <ConfidenceBadge band={driver.confidence} />
              </div>
            )}
          </div>

          {/* Method */}
          {driver.method && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Method</p>
              <p className="text-sm text-slate-300">{driver.method}</p>
            </div>
          )}

          {/* Rationale */}
          {driver.rationale && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-1.5">Rationale</p>
              <p className="text-sm leading-relaxed text-slate-400">{driver.rationale}</p>
            </div>
          )}

          {/* Candidates */}
          {driver.candidates && Object.keys(driver.candidates).length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Candidates Considered</p>
              <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.06] overflow-hidden">
                {Object.entries(driver.candidates).map(([k, c]) => (
                  <div key={k} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-slate-400">{c.label ?? k}</span>
                    <span className="font-mono text-sm text-slate-200">
                      {c.value > 1 ? formatNumber(c.value, 1) : formatPercent(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sensitivity range */}
          {sr && (sr.low != null || sr.base != null || sr.high != null) && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Sensitivity Range</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { lbl: "Low", v: sr.low },
                  { lbl: "Base", v: sr.base },
                  { lbl: "High", v: sr.high },
                ].map(({ lbl, v }) => (
                  <div key={lbl} className="rounded-lg border border-white/[0.06] px-3 py-2.5 text-center">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">{lbl}</p>
                    <p className="mt-1 font-mono text-sm text-slate-200">
                      {v != null ? (v > 1 ? formatNumber(v, 1) : formatPercent(v)) : "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {driver.sources && driver.sources.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-600 mb-2">Sources</p>
              <ul className="space-y-1">
                {driver.sources.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-500">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-slate-600" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Inline editable cell ──────────────────────────────────────────────────────

function EditableCell({
  value,
  isRate,
  isDays,
  onSave,
  disabled,
}: {
  value: number;
  isRate?: boolean;
  isDays?: boolean;
  onSave: (v: number) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (disabled) return;
    setDraft(isRate ? (value * 100).toFixed(2) : value.toFixed(isDays ? 1 : 2));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  function commit() {
    const parsed = parseFloat(draft);
    if (!Number.isNaN(parsed)) {
      onSave(isRate ? parsed / 100 : parsed);
    }
    setEditing(false);
  }

  const display = isRate
    ? formatPercent(value)
    : isDays
    ? `${formatNumber(value, 1)}d`
    : formatNumber(value, 2);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-24 rounded border border-indigo-500 bg-[#1c2333] px-1.5 py-0.5 text-right font-mono text-xs text-white outline-none"
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      className={`cursor-pointer rounded px-1.5 py-0.5 font-mono text-xs text-slate-200 hover:bg-indigo-500/15 hover:text-indigo-300 transition-colors ${disabled ? "cursor-default opacity-50 hover:bg-transparent hover:text-slate-200" : ""}`}
    >
      {display}
    </span>
  );
}

// ── Sub-tab nav ───────────────────────────────────────────────────────────────

type SubTab = "assumptions" | "income" | "balance" | "cashflow" | "dcf";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "assumptions", label: "Assumptions" },
  { key: "income", label: "Income Statement" },
  { key: "balance", label: "Balance Sheet" },
  { key: "cashflow", label: "Cash Flow" },
  { key: "dcf", label: "DCF & WACC" },
];

// ── Assumptions tab ───────────────────────────────────────────────────────────

interface DriverRowDef {
  key: string;
  label: string;
  group: "is" | "bs" | "cf" | "wacc";
  isRate?: boolean;
  isDays?: boolean;
  perYear?: boolean;
}

const DRIVER_ROWS: DriverRowDef[] = [
  // IS Drivers
  { key: "revenue_growth_yr1", label: "Revenue Growth", group: "is", isRate: true, perYear: true },
  { key: "cogs_pct_revenue", label: "COGS % Revenue", group: "is", isRate: true },
  { key: "rd_pct_revenue", label: "R&D % Revenue", group: "is", isRate: true },
  { key: "sga_pct_revenue", label: "SG&A % Revenue", group: "is", isRate: true },
  { key: "da_pct_revenue", label: "D&A % Revenue", group: "is", isRate: true },
  { key: "tax_rate", label: "Effective Tax Rate", group: "is", isRate: true },
  { key: "interest_rate_on_debt", label: "Interest Rate on Debt", group: "is", isRate: true },
  // BS Drivers
  { key: "ar_days", label: "Accounts Receivable Days", group: "bs", isDays: true },
  { key: "inventory_days", label: "Inventory Days", group: "bs", isDays: true },
  { key: "ap_days", label: "Accounts Payable Days", group: "bs", isDays: true },
  { key: "capex_pct_revenue", label: "CapEx % Revenue", group: "bs", isRate: true },
  { key: "other_ca_pct_revenue", label: "Other Current Assets % Rev", group: "bs", isRate: true },
  { key: "other_cl_pct_revenue", label: "Other Current Liabilities % Rev", group: "bs", isRate: true },
  // CF Drivers
  { key: "sbc_pct_sga", label: "SBC % SG&A", group: "cf", isRate: true },
  { key: "dividend_payout_ratio", label: "Dividend Payout Ratio", group: "cf", isRate: true },
  // WACC
  { key: "risk_free_rate", label: "Risk-Free Rate", group: "wacc", isRate: true },
  { key: "equity_risk_premium", label: "Equity Risk Premium", group: "wacc", isRate: true },
  { key: "beta", label: "Beta", group: "wacc" },
  { key: "size_premium", label: "Size Premium", group: "wacc", isRate: true },
  { key: "cost_of_debt", label: "Cost of Debt (Pre-Tax)", group: "wacc", isRate: true },
  { key: "tax_rate", label: "Tax Rate (WACC)", group: "wacc", isRate: true },
  { key: "equity_pct_capital", label: "Equity % Capital", group: "wacc", isRate: true },
];

const YR_KEYS = ["yr1", "yr2", "yr3", "yr4", "yr5"] as const;
const GROUP_LABELS: Record<string, string> = {
  is: "Income Statement Drivers",
  bs: "Balance Sheet Drivers",
  cf: "Cash Flow Drivers",
  wacc: "WACC Inputs",
};

function getDriver(
  pm: ProjectionModel,
  row: DriverRowDef,
  yrSuffix?: string
): DriverSuggestion | undefined {
  const key = row.perYear && yrSuffix ? `${row.key.replace("_yr1", "")}_${yrSuffix}` : row.key;
  if (row.group === "is") return (pm.is_drivers as ISDrivers | null)?.[key];
  if (row.group === "bs") return (pm.bs_drivers as BSDrivers | null)?.[key];
  if (row.group === "cf") return (pm.cf_drivers as CFDrivers | null)?.[key];
  if (row.group === "wacc") return (pm.wacc_suggestion as WACCSuggestion | null)?.[key];
  return undefined;
}

// draftKey: "is:cogs_pct_revenue" | "bs:ar_days" | "wacc:beta" etc.
type DraftOverrides = Record<string, number>;

function AssumptionsTab({
  pm,
  onOpenDrawer,
  onRecalculate,
  isRecalculating,
}: {
  pm: ProjectionModel;
  onOpenDrawer: (state: DrawerState) => void;
  onRecalculate: (overrides: { is: Record<string, DriverSuggestion>; bs: Record<string, DriverSuggestion>; cf: Record<string, DriverSuggestion>; wacc: Record<string, DriverSuggestion> }) => void;
  isRecalculating: boolean;
}) {
  const [drafts, setDrafts] = useState<DraftOverrides>({});
  const hasDirty = Object.keys(drafts).length > 0;
  const groups = ["is", "bs", "cf", "wacc"] as const;

  function setDraft(group: string, drKey: string, val: number) {
    setDrafts((prev) => ({ ...prev, [`${group}:${drKey}`]: val }));
  }

  function getValue(group: string, drKey: string, serverVal: number): number {
    const k = `${group}:${drKey}`;
    return k in drafts ? drafts[k] : serverVal;
  }

  function handleRecalculate() {
    // Build full override dicts for each group, merging drafts over server values
    const overrides: { is: Record<string, DriverSuggestion>; bs: Record<string, DriverSuggestion>; cf: Record<string, DriverSuggestion>; wacc: Record<string, DriverSuggestion> } = {
      is: {}, bs: {}, cf: {}, wacc: {},
    };

    for (const [draftKey, newVal] of Object.entries(drafts)) {
      const [grp, drKey] = draftKey.split(":") as [string, string];
      if (!(grp in overrides)) continue;
      // Find the server driver to preserve rationale/sources/confidence
      const row = DRIVER_ROWS.find((r) => {
        const k = r.perYear ? `${r.key.replace("_yr1", "")}_${drKey.split("_").slice(-1)[0]}` : r.key;
        return k === drKey && r.group === grp;
      });
      const serverDriver = row ? getDriver(pm, row, drKey.split("_").slice(-1)[0]) : undefined;
      overrides[grp as keyof typeof overrides][drKey] = {
        ...(serverDriver ?? { rationale: "", sources: [], confidence: "medium" as const }),
        value: newVal,
      };
    }

    onRecalculate(overrides);
    setDrafts({});
  }

  return (
    <div className="space-y-6">
      {/* Recalculate bar */}
      <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#161b22] px-5 py-3">
        <span className="text-xs text-slate-500">
          {hasDirty
            ? `${Object.keys(drafts).length} assumption${Object.keys(drafts).length > 1 ? "s" : ""} changed — click Recalculate to apply`
            : "Edit any assumption below, then click Recalculate"}
        </span>
        <button
          onClick={handleRecalculate}
          disabled={!hasDirty || isRecalculating}
          className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
            hasDirty && !isRecalculating
              ? "bg-indigo-600 text-white hover:bg-indigo-500"
              : "bg-white/[0.04] text-slate-600 cursor-not-allowed"
          }`}
        >
          {isRecalculating ? "Recalculating…" : "Recalculate"}
        </button>
      </div>

      {groups.map((grp) => {
        const rows = DRIVER_ROWS.filter((r) => r.group === grp);
        return (
          <div key={grp} className="rounded-xl border border-white/[0.06] bg-[#161b22] overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.06]">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                {GROUP_LABELS[grp]}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="py-2.5 pl-5 pr-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600 min-w-[200px]">
                      Assumption
                    </th>
                    {YR_KEYS.map((yr) => (
                      <th key={yr} className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-600 min-w-[90px]">
                        {yr.toUpperCase()}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-center text-[11px] font-semibold uppercase tracking-widest text-slate-600">Conf</th>
                    <th className="py-2.5 pl-3 pr-5 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {rows.map((row) => {
                    const baseDriver = getDriver(pm, row, "yr1");
                    const hasAny = !!baseDriver;

                    return (
                      <tr key={`${grp}-${row.key}`} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pl-5 pr-3 text-sm text-slate-300 font-medium">
                          {row.label}
                        </td>
                        {YR_KEYS.map((yrSuffix, yrIdx) => {
                          const isPerYear = row.perYear;
                          const driver = isPerYear
                            ? getDriver(pm, row, yrSuffix)
                            : baseDriver;

                          if (!driver) {
                            return (
                              <td key={yrSuffix} className="py-2.5 px-3 text-right text-slate-700 font-mono text-xs">
                                —
                              </td>
                            );
                          }

                          const drKey = isPerYear
                            ? `${row.key.replace("_yr1", "")}_${yrSuffix}`
                            : row.key;

                          const isEditable = isPerYear || yrIdx === 0;
                          const currentVal = getValue(grp, drKey, driver.value);
                          const isDirty = `${grp}:${drKey}` in drafts;

                          return (
                            <td key={yrSuffix} className={`py-2.5 px-3 text-right ${isDirty ? "bg-indigo-500/[0.06]" : ""}`}>
                              <EditableCell
                                value={currentVal}
                                isRate={row.isRate}
                                isDays={row.isDays}
                                disabled={isRecalculating || !isEditable}
                                onSave={(newVal) => {
                                  if (isEditable) setDraft(grp, drKey, newVal);
                                }}
                              />
                            </td>
                          );
                        })}
                        <td className="py-2.5 px-3 text-center">
                          {baseDriver?.confidence ? (
                            <ConfidenceBadge band={baseDriver.confidence} />
                          ) : (
                            <span className="text-slate-700">—</span>
                          )}
                        </td>
                        <td className="py-2.5 pl-3 pr-5">
                          {hasAny && baseDriver && (
                            <button
                              onClick={() =>
                                onOpenDrawer({ label: row.label, driver: baseDriver })
                              }
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-slate-500 hover:border-indigo-500/50 hover:text-indigo-400 transition-colors text-[11px] font-bold"
                              title="View reasoning"
                            >
                              ⓘ
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Generic statement table ───────────────────────────────────────────────────

interface RowDef {
  label: string;
  projKey?: keyof ProjectedYear;
  histKey?: keyof HistoricalYear;
  bold?: boolean;
  separator?: boolean;
  indent?: boolean;
  isBool?: boolean;
  isPercent?: boolean;
  headerLabel?: string;
}

const IS_ROWS: RowDef[] = [
  { label: "Revenue", projKey: "revenue", histKey: "revenue", bold: true },
  { label: "Cost of Sales", projKey: "cost_of_sales", histKey: "cost_of_sales", indent: true },
  { label: "Gross Profit", projKey: "gross_profit", histKey: "gross_profit", bold: true },
  { label: "Research & Development", projKey: "rd", histKey: "research_and_development", indent: true },
  { label: "SG&A", projKey: "sga", histKey: "sga", indent: true },
  { label: "EBIT (Operating Income)", projKey: "ebit", histKey: "operating_income", bold: true },
  { label: "Depreciation & Amortization", projKey: "da", histKey: "da", indent: true },
  { label: "EBITDA", projKey: "ebitda", histKey: "ebitda", bold: true },
  { label: "Interest Expense", projKey: "interest_expense", histKey: "interest_expense", indent: true },
  { label: "Pretax Income", projKey: "pretax_income", histKey: "pretax_income", bold: true },
  { label: "Tax Provision", projKey: "tax_provision", histKey: "tax_provision", indent: true },
  { label: "Net Income", projKey: "net_income", histKey: "net_income", bold: true },
  { separator: true, label: "" },
  { label: "Stock-Based Compensation", projKey: "sbc", histKey: "sbc", indent: true },
  { label: "Dividends", projKey: "dividends", histKey: "dividends_paid", indent: true },
];

const BS_ROWS: RowDef[] = [
  { headerLabel: "ASSETS", label: "" },
  { label: "Cash & Equivalents", projKey: "cash", histKey: "cash", indent: true },
  { label: "Accounts Receivable", projKey: "accounts_receivable", histKey: "accounts_receivable", indent: true },
  { label: "Inventory", projKey: "inventory", histKey: "inventory", indent: true },
  { label: "Other Current Assets", projKey: "other_current_assets", histKey: "other_current_assets", indent: true },
  { label: "Total Current Assets", projKey: "total_current_assets", histKey: "total_current_assets", bold: true },
  { label: "PP&E (Net)", projKey: "ppe_net", histKey: "ppe_net", indent: true },
  { label: "Goodwill & Intangibles", projKey: "goodwill", histKey: "goodwill", indent: true },
  { label: "Total Assets", projKey: "total_assets", histKey: "total_assets", bold: true },
  { separator: true, label: "" },
  { headerLabel: "LIABILITIES & EQUITY", label: "" },
  { label: "Accounts Payable", projKey: "accounts_payable", histKey: "accounts_payable", indent: true },
  { label: "Other Current Liabilities", projKey: "other_current_liabilities", histKey: "other_current_liabilities", indent: true },
  { label: "Total Current Liabilities", projKey: "total_current_liabilities", histKey: "total_current_liabilities", bold: true },
  { label: "Long-Term Debt", projKey: "lt_debt", histKey: "long_term_debt", indent: true },
  { label: "Total Liabilities", projKey: "total_liabilities", histKey: "total_liabilities", bold: true },
  { label: "Total Equity", projKey: "total_equity", histKey: "total_equity", bold: true },
  { label: "Balance Sheet Parity", projKey: "balance_sheet_parity_check", isBool: true },
];

const CF_ROWS: RowDef[] = [
  { headerLabel: "OPERATING ACTIVITIES", label: "" },
  { label: "Net Income", projKey: "net_income", histKey: "net_income", indent: true },
  { label: "+ Depreciation & Amortization", projKey: "da", histKey: "da", indent: true },
  { label: "+ Stock-Based Compensation", projKey: "sbc", histKey: "sbc", indent: true },
  { label: "± Change in Working Capital", projKey: "delta_working_capital", indent: true },
  { label: "Cash from Operations (CFO)", projKey: "cfo", histKey: "operating_cash_flow", bold: true },
  { separator: true, label: "" },
  { headerLabel: "INVESTING ACTIVITIES", label: "" },
  { label: "Capital Expenditures", projKey: "capex", histKey: "capex", indent: true },
  { label: "Cash from Investing (CFI)", projKey: "cfi", histKey: "investing_cash_flow", bold: true },
  { separator: true, label: "" },
  { headerLabel: "FINANCING ACTIVITIES", label: "" },
  { label: "Dividends Paid", projKey: "dividends", histKey: "dividends_paid", indent: true },
  { label: "Cash from Financing (CFF)", projKey: "cff", histKey: "financing_cash_flow", bold: true },
  { separator: true, label: "" },
  { label: "Net Change in Cash", projKey: "net_change_in_cash", bold: true },
  { separator: true, label: "" },
  { headerLabel: "FCF", label: "" },
  { label: "NOPAT", projKey: "nopat", indent: true },
  { label: "Unlevered FCF (UFCF)", projKey: "ufcf", bold: true },
];

function fmtCell(
  v: number | boolean | null | undefined,
  isBool: boolean,
  mult: number
): string {
  if (v === null || v === undefined) return "—";
  if (isBool) return (v as boolean) ? "✓" : "✗";
  return formatMoney((v as number) * mult);
}

function StatementTable({
  rows,
  projYears,
  histYears,
  mult,
}: {
  rows: RowDef[];
  projYears: ProjectedYear[];
  histYears: HistoricalYear[];
  mult: number;
}) {
  const recentHist = histYears.slice(-3);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="py-3 pl-5 pr-4 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600 min-w-[220px]">
                Line Item
              </th>
              {recentHist.map((h) => (
                <th key={h.year} className="py-3 px-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-700 min-w-[100px]">
                  FY{h.year}
                </th>
              ))}
              {projYears.map((p) => (
                <th key={p.year} className="py-3 px-3 text-right text-[11px] font-semibold uppercase tracking-widest text-slate-500 min-w-[100px]">
                  FY{p.year}E
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              if (row.headerLabel) {
                return (
                  <tr key={`hdr-${idx}`}>
                    <td
                      colSpan={1 + recentHist.length + projYears.length}
                      className="pt-4 pb-1 pl-5 text-[10px] font-bold uppercase tracking-widest text-slate-600"
                    >
                      {row.headerLabel}
                    </td>
                  </tr>
                );
              }
              if (row.separator) {
                return (
                  <tr key={`sep-${idx}`}>
                    <td
                      colSpan={1 + recentHist.length + projYears.length}
                      className="py-1"
                    >
                      <div className="border-t border-white/[0.05]" />
                    </td>
                  </tr>
                );
              }

              const rowCls = [
                "border-b border-white/[0.03] hover:bg-white/[0.015] transition-colors",
                row.bold ? "font-semibold" : "",
              ].join(" ");

              return (
                <tr key={`${row.projKey ?? idx}`} className={rowCls}>
                  <td className={`py-2.5 pr-4 text-sm ${row.indent ? "pl-9 text-slate-400" : "pl-5 text-slate-300"} ${row.bold ? "text-white" : ""}`}>
                    {row.label}
                  </td>
                  {recentHist.map((h) => {
                    const v = row.histKey ? h[row.histKey] : undefined;
                    return (
                      <td key={h.year} className="py-2.5 px-3 text-right font-mono text-xs text-slate-600">
                        {fmtCell(v as number | boolean | null | undefined, !!row.isBool, mult)}
                      </td>
                    );
                  })}
                  {projYears.map((p) => {
                    const v = row.projKey ? p[row.projKey] : undefined;
                    const isBoolCell = !!row.isBool;
                    // Projected values are already in absolute dollars; no unit multiplier needed
                    const displayVal = fmtCell(v as number | boolean | null | undefined, isBoolCell, 1);
                    const isCheck = isBoolCell && v === true;
                    const isFail = isBoolCell && v === false;
                    return (
                      <td
                        key={p.year}
                        className={`py-2.5 px-3 text-right font-mono text-xs ${
                          isBoolCell
                            ? isCheck
                              ? "text-emerald-400"
                              : isFail
                              ? "text-red-400"
                              : "text-slate-400"
                            : row.bold
                            ? "text-slate-100"
                            : "text-slate-300"
                        }`}
                      >
                        {displayVal}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sensitivity grid (reused from dcf page style) ────────────────────────────

function shadeColor(value: number, min: number, max: number): string {
  if (max === min) return "rgba(255,255,255,0.03)";
  const t = (value - min) / (max - min);
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

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-slate-600">
        Rows: {grid.row_param ?? "Discount Rate"} · Columns: {grid.col_param ?? "Terminal Growth"}
      </p>
      <table className="text-sm">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">
              ↓ WACC \ TGR →
            </th>
            {colValues.map((c) => (
              <th key={c} className="px-3 py-2 text-right text-[11px] font-semibold text-slate-600">
                {formatPercent(c, 2)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowValues.map((rv, ri) => (
            <tr key={rv}>
              <td className="px-3 py-2 font-mono text-xs text-slate-400">{formatPercent(rv, 2)}</td>
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

// ── DCF & WACC tab ────────────────────────────────────────────────────────────

function DcfWaccTab({ pm }: { pm: ProjectionModel }) {
  const id = pm.engagement_id;
  const dcfQuery = useDcfModel(id);
  const m = dcfQuery.data;

  const sensitivity = pm.computed_outputs?.sensitivity_grid;
  const waccResult = m?.wacc_result ?? {};
  const dcfResult = m?.dcf_result ?? {};
  const trace = waccResult.calculation_trace ?? {};
  const projections = (dcfResult.year_by_year_breakdown ?? []) as Array<{
    year: number; fcf: number; discount_factor: number; present_value: number;
  }>;

  if (dcfQuery.isLoading) return <Spinner />;

  return (
    <div className="space-y-4">
      {/* EV summary */}
      {m && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { label: "Enterprise Value", v: dcfResult.enterprise_value },
            { label: "PV of Cash Flows", v: dcfResult.pv_of_cash_flows },
            { label: "PV of Terminal Value", v: dcfResult.pv_of_terminal_value },
          ].map(({ label, v }) => (
            <div key={label} className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-600">{label}</p>
              <p className="text-2xl font-bold text-white">{formatMoney(v as number | null | undefined)}</p>
            </div>
          ))}
        </div>
      )}

      {/* WACC breakdown */}
      {m && Object.keys(waccResult).length > 0 && (
        <Card title="WACC Build-Up">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(waccResult)
              .filter(([k]) => k !== "calculation_trace")
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                  <span className="text-sm text-slate-400">{titleCase(k)}</span>
                  <span className="font-mono text-sm text-slate-200">
                    {typeof v === "number" ? formatPercent(v) : String(v ?? "—")}
                  </span>
                </div>
              ))}
            {Object.entries(trace as Record<string, unknown>).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-white/[0.04] pb-2">
                <span className="text-sm text-slate-400">{titleCase(k)}</span>
                <span className="font-mono text-sm text-slate-200">
                  {typeof v === "number" ? formatPercent(v) : String(v ?? "—")}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FCF projections */}
      {projections.length > 0 && (
        <Card title="Cash Flow Projections">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Year", "UFCF", "Discount Factor", "Present Value"].map((h) => (
                    <th key={h} className={`pb-2.5 ${h === "Year" ? "text-left" : "text-right"} text-[11px] font-semibold uppercase tracking-widest text-slate-600 pr-5`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {projections.map((y) => (
                  <tr key={y.year}>
                    <td className="py-2.5 pr-5 text-slate-300">{y.year}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-slate-200">{formatMoney(y.fcf)}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-slate-400">{formatNumber(y.discount_factor, 4)}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-slate-200">{formatMoney(y.present_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sensitivity grid — from ProjectionModel.computed_outputs */}
      {sensitivity && (sensitivity.row_values?.length ?? 0) > 0 && (
        <Card title="Sensitivity Analysis (Enterprise Value)">
          <SensitivityGridTable grid={sensitivity} />
        </Card>
      )}

      {!m && !dcfQuery.isError && (
        <EmptyState title="DCF model not yet available" subtitle="Approve G4 and wait for the pipeline to complete." />
      )}
      {dcfQuery.isError && (
        <p className="text-sm text-slate-500">DCF model unavailable — check the DCF tab for details.</p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectionsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const projQuery = useProjection(id);
  const dcfQuery = useDcfModel(id);
  const gatesQuery = useGates(id);

  const [subTab, setSubTab] = useState<SubTab>("assumptions");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);

  // Recalculate mutation — sends all changed drivers at once, then syncs DCF
  const recalculateMutation = useMutation({
    mutationFn: async ({
      pmId,
      overrides,
    }: {
      pmId: string;
      overrides: {
        is: Record<string, DriverSuggestion>;
        bs: Record<string, DriverSuggestion>;
        cf: Record<string, DriverSuggestion>;
        wacc: Record<string, DriverSuggestion>;
      };
    }) => {
      const { is: isD, bs: bsD, cf: cfD, wacc: waccD } = overrides;
      // PATCH drivers (IS/BS/CF) and WACC in parallel
      const patches: Promise<unknown>[] = [];
      if (Object.keys(isD).length || Object.keys(bsD).length || Object.keys(cfD).length) {
        const body: Record<string, unknown> = {};
        if (Object.keys(isD).length) body.is_drivers = isD;
        if (Object.keys(bsD).length) body.bs_drivers = bsD;
        if (Object.keys(cfD).length) body.cf_drivers = cfD;
        patches.push(apiClient.patch(`/projections/${pmId}/drivers`, body));
      }
      if (Object.keys(waccD).length) {
        patches.push(apiClient.patch(`/projections/${pmId}/wacc`, { wacc_suggestion: waccD }));
      }
      await Promise.all(patches);
    },
    onSuccess: async () => {
      // Fetch fresh projection data
      const freshProj = await queryClient.fetchQuery({
        queryKey: ["projection", id],
        queryFn: async () => {
          const res = await apiClient.get<ProjectionModel>(`/projections/${id}`);
          return res.data;
        },
        staleTime: 0,
      });

      // Sync updated UFCFs into the DCF model and recalculate EV
      const dcf = dcfQuery.data;
      const ufcfSeries: number[] = (freshProj?.projected_statements as any)?.ufcf_series ?? [];
      if (dcf && ufcfSeries.length > 0) {
        const baseFcf = ufcfSeries[0];
        // Prepend 0 so year-1 FCF = baseFcf, then YoY rates for years 2-5
        // This gives exactly projection_years (5) growth rates
        const growthRates = [
          0,
          ...ufcfSeries.slice(1).map((v: number, i: number) =>
            ufcfSeries[i] !== 0 ? (v - ufcfSeries[i]) / ufcfSeries[i] : 0
          ),
        ];
        const existingInputs = (dcf.projection_inputs as any) ?? {};
        await apiClient.patch(`/dcf-models/${dcf.id}/inputs`, {
          wacc_inputs: dcf.wacc_inputs,
          projection_inputs: { ...existingInputs, base_fcf: baseFcf, growth_rates: growthRates },
          terminal_growth_rate: (dcf.dcf_result as any)?.terminal_growth_rate ?? 0.03,
          terminal_value_method: (dcf.dcf_result as any)?.terminal_value_method ?? "gordon_growth",
        });
        await queryClient.invalidateQueries({ queryKey: ["dcf-model", id] });
      }
    },
  });

  const isNotFound =
    projQuery.isError &&
    projQuery.error instanceof ApiError &&
    projQuery.error.status === 404;

  if (projQuery.isLoading) return <Spinner />;
  if (isNotFound)
    return (
      <EmptyState
        title="No projection model yet"
        subtitle="Approve G4 to trigger the projection pipeline."
      />
    );
  if (projQuery.isError)
    return (
      <ErrorBox>
        {projQuery.error instanceof ApiError
          ? projQuery.error.message
          : "Failed to load projection model."}
      </ErrorBox>
    );

  const pm = projQuery.data;
  if (!pm) return <EmptyState title="No projection model yet" />;

  const projYears = pm.projected_statements?.projected_years ?? [];
  const histYears = pm.historical_actuals?.years ?? [];
  const mult = getUnitMultiplier(pm.historical_actuals?.currency_unit);
  const g5 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G5");
  const isRecalculating = recalculateMutation.isPending;

  function handleRecalculate(overrides: {
    is: Record<string, DriverSuggestion>;
    bs: Record<string, DriverSuggestion>;
    cf: Record<string, DriverSuggestion>;
    wacc: Record<string, DriverSuggestion>;
  }) {
    recalculateMutation.mutate({ pmId: pm!.id, overrides });
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">
          Projection Model
        </h2>
        <div className="flex items-center gap-3">
          {isRecalculating && <span className="text-xs text-indigo-400">Recalculating…</span>}
          {g5 && <StatusBadge status={g5.status === "approved" ? "approved" : "pending review"} />}
        </div>
      </div>

      {pm.error_message && <ErrorBox>{pm.error_message}</ErrorBox>}

      {/* Sub-tab nav */}
      <div className="border-b border-white/[0.06]">
        <nav className="flex gap-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                subTab === t.key
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Sub-tab content */}
      {subTab === "assumptions" && (
        <AssumptionsTab
          pm={pm}
          onOpenDrawer={setDrawer}
          onRecalculate={handleRecalculate}
          isRecalculating={isRecalculating}
        />
      )}
      {subTab === "income" && (
        projYears.length > 0 ? (
          <StatementTable rows={IS_ROWS} projYears={projYears} histYears={histYears} mult={mult} />
        ) : (
          <EmptyState title="No projections available" subtitle="Projection statements will appear here after G4 is approved." />
        )
      )}
      {subTab === "balance" && (
        projYears.length > 0 ? (
          <StatementTable rows={BS_ROWS} projYears={projYears} histYears={histYears} mult={mult} />
        ) : (
          <EmptyState title="No projections available" />
        )
      )}
      {subTab === "cashflow" && (
        projYears.length > 0 ? (
          <StatementTable rows={CF_ROWS} projYears={projYears} histYears={histYears} mult={mult} />
        ) : (
          <EmptyState title="No projections available" />
        )
      )}
      {subTab === "dcf" && <DcfWaccTab pm={pm} />}

      {/* G5 nudge — approval lives on the DCF tab */}
      {g5 && g5.status !== "approved" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-4 text-sm text-slate-500">
          When you're satisfied with the assumptions above, head to the{" "}
          <a href={`/engagements/${id}/dcf`} className="text-indigo-400 hover:text-indigo-300 transition-colors">
            DCF tab
          </a>{" "}
          to review the model output and approve G5.
        </div>
      )}

      {/* Driver reasoning drawer */}
      {drawer && (
        <DriverDrawer state={drawer} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}
