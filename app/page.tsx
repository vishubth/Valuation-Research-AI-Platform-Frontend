"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "./lib/api-client";
import type { Engagement } from "./lib/types";
import { StatusBadge } from "./components/Badge";
import { Spinner } from "./components/Spinner";

const STATUS_OPTIONS = ["intake", "pending", "processing", "draft", "approved", "failed", "archived"];

function formatDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function StatCard({ label, value, sub, color }: { label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-[#161b22] p-5`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-600">{sub}</p>}
    </div>
  );
}

export default function EngagementListPage() {
  const router = useRouter();
  const [adminOnly, setAdminOnly] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAdminOnly(new URLSearchParams(window.location.search).get("error") === "admin_only");
    }
  }, []);
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["engagements", statusFilter],
    staleTime: 30000,
    queryFn: async () => {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await apiClient.get<Engagement[]>(`/engagements${qs}`);
      return res.data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<Engagement>("/engagements", { client_name: clientName, purpose });
      return res.data;
    },
    onSuccess: (eng) => {
      queryClient.invalidateQueries({ queryKey: ["engagements"] });
      setShowForm(false);
      setClientName("");
      setPurpose("");
      if (eng?.id) router.push(`/engagements/${eng.id}`);
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : "Create failed."),
  });

  function onCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    createMutation.mutate();
  }

  const engagements = listQuery.data ?? [];
  const active = engagements.filter((e) => ["processing", "intake", "pending", "draft"].includes(e.status ?? "")).length;
  const completed = engagements.filter((e) => e.status === "approved" || e.status === "completed").length;
  const failed = engagements.filter((e) => e.status === "failed").length;

  return (
    <div>
      {adminOnly && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          Admin access is required for that page.
        </div>
      )}

      {/* Page header */}
      <div className="mb-7 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Engagements</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage valuation engagements</p>
        </div>
        <button
          onClick={() => { setShowForm((s) => !s); setFormError(null); }}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Engagement
        </button>
      </div>

      {/* Stat cards */}
      <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total" value={engagements.length} sub="all engagements" color="text-white" />
        <StatCard label="Active" value={active} sub="in progress" color="text-indigo-400" />
        <StatCard label="Completed" value={completed} sub="fully approved" color="text-emerald-400" />
        <StatCard label="Failed" value={failed} sub="need attention" color="text-red-400" />
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={onCreate}
          className="mb-6 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-6 py-5"
        >
          <h2 className="mb-4 text-sm font-semibold text-white">New engagement</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Client name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Apple Inc."
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Purpose</label>
              <input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="e.g. 409A Valuation"
                className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          {formError && <p className="mt-3 text-sm text-red-400">{formError}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={!clientName.trim() || createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              {createMutation.isPending ? "Creating…" : "Create engagement"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter + table */}
      <div className="rounded-xl border border-white/[0.06] bg-[#161b22]">
        <div className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-3.5">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {listQuery.isFetching && <span className="text-xs text-slate-600">Refreshing…</span>}
        </div>

        {listQuery.isLoading ? (
          <div className="px-5"><Spinner /></div>
        ) : listQuery.isError ? (
          <div className="px-5 py-4 text-sm text-red-400">
            {listQuery.error instanceof ApiError ? listQuery.error.message : "Failed to load."}
          </div>
        ) : engagements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.04]">
              <svg className="h-6 w-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-400">No engagements yet</p>
            <p className="mt-1 text-xs text-slate-600">Create one to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Client</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Purpose</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Status</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Stage</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Created</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {engagements.map((eng) => (
                <tr
                  key={eng.id}
                  onClick={() => router.push(`/engagements/${eng.id}`)}
                  className="group cursor-pointer border-b border-white/[0.04] transition-colors last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3.5">
                    <Link
                      href={`/engagements/${eng.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-white hover:text-indigo-400 transition-colors"
                    >
                      {eng.client_name || "(unnamed)"}
                    </Link>
                  </td>
                  <td className="px-5 py-3.5 text-slate-400">{eng.purpose || "—"}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={eng.status} /></td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{eng.current_stage || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-500">{formatDate(eng.created_at)}</td>
                  <td className="px-5 py-3.5 text-slate-700 group-hover:text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
