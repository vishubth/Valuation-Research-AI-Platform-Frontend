"use client";

import { type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useEngagement, useGates } from "../../lib/hooks";
import { StatusBadge } from "../../components/Badge";
import { Spinner } from "../../components/Spinner";
import { GATE_KEYS } from "../../lib/types";
import type { Gate } from "../../lib/types";

const GATE_LABELS: Record<string, string> = {
  G1: "Initiation", G2: "Business Understanding", G3: "Research",
  G4: "Methodology", G5: "Model Sign-off", G6: "Report Review", G7: "Final Delivery",
};

function GateTimeline({ gates }: { gates: Gate[] }) {
  const byKey = new Map(gates.map((g) => [g.gate_key, g]));

  return (
    <div className="flex items-center overflow-x-auto pb-1">
      {GATE_KEYS.map((key, idx) => {
        const g = byKey.get(key);
        const approved = g?.status === "approved";
        const rejected = g?.status === "rejected";
        const isLast = idx === GATE_KEYS.length - 1;

        return (
          <div key={key} className="flex items-center">
            <div className="group relative flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all
                  ${approved ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                    : rejected ? "bg-red-500 text-white"
                    : "border border-white/10 bg-white/[0.04] text-slate-600"}`}
              >
                {approved ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : rejected ? (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <span className="text-[10px] font-bold">{key}</span>
                )}
              </div>

              <div className="mt-1.5 text-center">
                <div className={`text-[10px] font-semibold ${approved ? "text-emerald-500" : rejected ? "text-red-500" : "text-slate-600"}`}>
                  {key}
                </div>
                {approved && g?.approved_by_name && (
                  <div className="max-w-[72px] truncate text-[9px] text-slate-600">{g.approved_by_name}</div>
                )}
              </div>

              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 z-20 w-48 -translate-x-1/2 rounded-lg border border-white/10 bg-[#1e2433] p-3 text-[11px] text-slate-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                <div className="mb-1 font-semibold text-white">{key} — {GATE_LABELS[key]}</div>
                <div className="capitalize text-slate-400">{g?.status ?? "pending"}</div>
                {approved && g?.approved_by_name && <div className="text-slate-300">{g.approved_by_name}</div>}
                {g?.approved_at && <div className="text-slate-500">{new Date(g.approved_at).toLocaleString()}</div>}
                {g?.notes && <div className="mt-1 italic text-slate-400">"{g.notes}"</div>}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1e2433]" />
              </div>
            </div>

            {!isLast && (
              <div className={`h-px w-10 flex-shrink-0 ${approved ? "bg-emerald-500/40" : "bg-white/[0.06]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function EngagementLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const pathname = usePathname();

  const engQuery = useEngagement(id);
  const gatesQuery = useGates(id);

  const tabs = [
    { href: `/engagements/${id}`, label: "Overview" },
    { href: `/engagements/${id}/documents`, label: "Documents" },
    { href: `/engagements/${id}/business-profile`, label: "Business Profile" },
    { href: `/engagements/${id}/research`, label: "Research" },
    { href: `/engagements/${id}/methodology`, label: "Methodology" },
    { href: `/engagements/${id}/comparables`, label: "Comparables" },
    { href: `/engagements/${id}/dcf`, label: "DCF" },
    { href: `/engagements/${id}/report`, label: "Report" },
    { href: `/engagements/${id}/review`, label: "Review" },
    { href: `/engagements/${id}/audit-log`, label: "Audit Log" },
  ];

  if (engQuery.isLoading) return <Spinner />;
  if (engQuery.isError || !engQuery.data)
    return <p className="text-sm text-red-400">Failed to load engagement.</p>;

  const eng = engQuery.data;

  return (
    <div>
      <Link href="/" className="mb-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        All engagements
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h1 className="text-2xl font-semibold text-white">{eng.client_name || "(unnamed)"}</h1>
          <StatusBadge status={eng.status} />
        </div>
        {eng.purpose && <p className="text-sm text-slate-500">{eng.purpose}</p>}
      </div>

      {/* Gate timeline card */}
      <div className="mb-7 rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Gate Progress</p>
          {gatesQuery.data && (
            <p className="text-xs text-slate-600">
              {gatesQuery.data.filter((g) => g.status === "approved").length} / {GATE_KEYS.length} approved
            </p>
          )}
        </div>
        {gatesQuery.isLoading ? <Spinner /> : <GateTimeline gates={gatesQuery.data ?? []} />}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-white/[0.06]">
        <nav className="flex gap-1">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {children}
    </div>
  );
}
