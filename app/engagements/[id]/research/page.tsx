"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useGates, useResearch } from "../../../lib/hooks";
import { Badge, ConfidenceBadge } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { EmptyState, ErrorBox } from "../../../components/Section";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import { relativeTime, titleCase } from "../../../lib/format";
import type { ResearchItem } from "../../../lib/types";

function ResearchCard({
  item,
  engagementId,
}: {
  item: ResearchItem;
  engagementId: string;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const mutation = useMutation({
    mutationFn: async (patch: Partial<ResearchItem>) => {
      await apiClient.patch(`/research-items/${item.id}`, patch);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["research", engagementId] }),
  });

  const summary = item.summary ?? "";
  const isLong = summary.length > 220;
  const shown = expanded || !isLong ? summary : `${summary.slice(0, 220)}…`;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-white hover:text-indigo-400 transition-colors"
              >
                {item.title}
              </a>
            ) : (
              <span className="text-sm font-medium text-white">{item.title}</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge tone="blue">{titleCase(item.source)}</Badge>
            {item.relevance_band && (
              <ConfidenceBadge band={item.relevance_band} />
            )}
            {item.is_stale && <Badge tone="orange">Stale</Badge>}
            {item.analyst_flagged && <Badge tone="purple">Flagged</Badge>}
            {item.analyst_dismissed && <Badge tone="gray">Dismissed</Badge>}
            {item.published_at && (
              <span className="text-xs text-slate-600">
                {relativeTime(item.published_at)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            title={item.analyst_flagged ? "Unflag" : "Flag"}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ analyst_flagged: !item.analyst_flagged })}
            className={`rounded-lg p-1.5 transition-colors hover:bg-white/[0.06] disabled:opacity-40 ${
              item.analyst_flagged ? "text-violet-400" : "text-slate-500"
            }`}
          >
            <svg className="h-4 w-4" fill={item.analyst_flagged ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
            </svg>
          </button>
          <button
            title="Dismiss"
            disabled={mutation.isPending || item.analyst_dismissed}
            onClick={() => mutation.mutate({ analyst_dismissed: true })}
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-red-400 disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {summary && (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-slate-400">{shown}</p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-1 text-xs font-medium text-indigo-400 hover:text-indigo-300"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResearchPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { user } = useAuth();
  const gatesQuery = useGates(id);
  const researchQuery = useResearch(id);

  const [sourceFilter, setSourceFilter] = useState("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  const g3 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G3");
  const allItems = researchQuery.data ?? [];

  const filtered = allItems.filter((it) => {
    if (sourceFilter !== "all" && it.source !== sourceFilter) return false;
    if (staleOnly && !it.is_stale) return false;
    if (!showDismissed && it.analyst_dismissed) return false;
    return true;
  });

  const sources = new Set(allItems.map((i) => i.source));
  const flaggedCount = allItems.filter((i) => i.analyst_flagged).length;
  const staleCount = allItems.filter((i) => i.is_stale).length;
  const summaryLine = `${allItems.length} items from ${sources.size} sources. ${flaggedCount} flagged. ${staleCount} stale.`;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
            >
              <option value="all">All sources</option>
              <option value="sec_edgar">SEC EDGAR</option>
              <option value="news">News</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={staleOnly} onChange={(e) => setStaleOnly(e.target.checked)} className="accent-indigo-500" />
            Stale only
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} className="accent-indigo-500" />
            Show dismissed
          </label>
        </div>
      </div>

      {researchQuery.isLoading ? (
        <Spinner />
      ) : researchQuery.isError ? (
        <ErrorBox>
          {researchQuery.error instanceof ApiError ? researchQuery.error.message : "Failed to load research."}
        </ErrorBox>
      ) : allItems.length === 0 ? (
        <EmptyState title="No research yet" subtitle="The research agent has not produced any items for this engagement." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No items match the current filters" subtitle="Adjust the source or toggles above to see more." />
      ) : (
        <div className="space-y-3">
          {filtered.map((it) => (
            <ResearchCard key={it.id} item={it} engagementId={id} />
          ))}
        </div>
      )}

      {g3 && user && (
        <GateApprovalPanel engagementId={id} gate={g3} currentUserRole={user.role}>
          <p className="text-sm text-slate-400">{summaryLine}</p>
        </GateApprovalPanel>
      )}
    </div>
  );
}
