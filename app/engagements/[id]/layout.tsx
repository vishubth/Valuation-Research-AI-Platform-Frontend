"use client";

import { type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEngagement, useGates } from "../../lib/hooks";
import { useAuth } from "../../lib/auth-context";
import { StatusBadge } from "../../components/Badge";
import { Spinner } from "../../components/Spinner";
import { apiClient } from "../../lib/api-client";
import { GATE_KEYS } from "../../lib/types";
import type { Gate } from "../../lib/types";

const GATE_LABELS: Record<string, string> = {
  G1: "Initiation", G2: "Business Understanding", G3: "Research",
  G4: "Methodology", G5: "Model Sign-off", G6: "Report Review", G7: "Final Delivery",
};

function GateTimeline({ gates }: { gates: Gate[] }) {
  const byKey = new Map(gates.map((g) => [g.gate_key, g]));

  return (
    <div className="flex items-center w-full">
      {GATE_KEYS.map((key, idx) => {
        const g = byKey.get(key);
        const approved = g?.status === "approved";
        const rejected = g?.status === "rejected";
        const isLast = idx === GATE_KEYS.length - 1;

        return (
          <div key={key} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
            {/* Gate node */}
            <div className="group relative flex flex-col items-center flex-shrink-0">
              {/* Outer ring pulse for approved */}
              <div className="relative">
                {approved && (
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: "3s" }} />
                )}
                <div
                  className={`relative flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold transition-all duration-300
                    ${approved
                      ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-500/20"
                      : rejected
                      ? "bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg shadow-red-500/30 ring-2 ring-red-500/20"
                      : "border border-white/10 bg-white/[0.04] text-slate-500 ring-1 ring-white/5"}`}
                >
                  {approved ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : rejected ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-500">{key}</span>
                  )}
                </div>
              </div>

              {/* Label below */}
              <div className="mt-2 text-center">
                <div className={`text-[10px] font-semibold tracking-wide ${approved ? "text-emerald-400" : rejected ? "text-red-400" : "text-slate-600"}`}>
                  {key}
                </div>
                {(approved || rejected) && g?.approved_by_name && (
                  <div className="max-w-[64px] truncate text-[9px] text-slate-600 mt-0.5">{g.approved_by_name.split(" ")[0]}</div>
                )}
              </div>

              {/* Tooltip */}
              <div className="pointer-events-none absolute bottom-full mb-3 left-1/2 z-20 w-52 -translate-x-1/2 rounded-xl border border-white/10 bg-[#1a2035] p-3.5 text-[11px] text-slate-300 opacity-0 shadow-2xl transition-all duration-200 group-hover:opacity-100 group-hover:-translate-y-0.5">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${approved ? "bg-emerald-400" : rejected ? "bg-red-400" : "bg-slate-600"}`} />
                  <span className="font-semibold text-white">{key} — {GATE_LABELS[key]}</span>
                </div>
                <div className={`capitalize text-xs mb-1 ${approved ? "text-emerald-400" : rejected ? "text-red-400" : "text-slate-500"}`}>
                  {g?.status ?? "pending"}
                </div>
                {g?.approved_by_name && <div className="text-slate-400 text-[10px]">by {g.approved_by_name}</div>}
                {g?.approved_at && <div className="text-slate-600 text-[10px] mt-0.5">{new Date(g.approved_at).toLocaleString()}</div>}
                {g?.notes && <div className="mt-1.5 italic text-slate-500 text-[10px] border-t border-white/[0.06] pt-1.5">"{g.notes}"</div>}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1a2035]" />
              </div>
            </div>

            {/* Connector line — flex-1 so it fills all available space */}
            {!isLast && (
              <div className="flex-1 mx-1 h-px relative overflow-hidden">
                <div className={`absolute inset-0 ${approved ? "bg-emerald-500/50" : "bg-white/[0.06]"}`} />
                {approved && (
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/80 to-emerald-400/20" />
                )}
              </div>
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
  const { user } = useAuth();
  const qc = useQueryClient();

  const engQuery = useEngagement(id);
  const gatesQuery = useGates(id);

  const archiveMutation = useMutation({
    mutationFn: () => apiClient.post(`/engagements/${id}/archive`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["engagement", id] }); },
  });

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
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-baseline gap-3">
            <h1 className="text-2xl font-semibold text-white">{eng.client_name || "(unnamed)"}</h1>
            <StatusBadge status={eng.status} />
          </div>
          {user?.role === "admin" && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {eng.status !== "archived" && (
                <button
                  disabled={archiveMutation.isPending}
                  onClick={() => archiveMutation.mutate()}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-amber-500/30 hover:text-amber-400 disabled:opacity-40 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  {archiveMutation.isPending ? "Archiving…" : "Archive"}
                </button>
              )}
            </div>
          )}
        </div>
        {eng.purpose && <p className="text-sm text-slate-500">{eng.purpose}</p>}
      </div>

      {/* Gate timeline card */}
      <div className="mb-7 rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Gate Progress</p>
          {gatesQuery.data && (() => {
            const approved = gatesQuery.data.filter((g) => g.status === "approved").length;
            const allDone = approved === GATE_KEYS.length;
            return (
              <span className={`text-xs font-medium ${allDone ? "text-emerald-400" : "text-slate-600"}`}>
                {allDone ? "✓ All gates approved" : `${approved} / ${GATE_KEYS.length} approved`}
              </span>
            );
          })()}
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
