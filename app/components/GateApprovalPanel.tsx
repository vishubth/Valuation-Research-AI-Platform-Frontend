"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../lib/api-client";
import type { Gate } from "../lib/types";

interface GateApprovalPanelProps {
  engagementId: string;
  gate: Gate;
  currentUserRole: string;
  initialApproach?: string;
  children?: ReactNode;
}

const GATE_LABELS: Record<string, string> = {
  G1: "Engagement Initiation", G2: "Business Understanding", G3: "Research Complete",
  G4: "Methodology Approval", G5: "Model Sign-off", G6: "Report Review", G7: "Final Delivery",
};

function roleAllowsApprove(gateKey: string, role: string): boolean {
  const r = role.toLowerCase();
  if (gateKey === "G7") return r === "admin";
  if (gateKey === "G6") return r === "reviewer" || r === "admin";
  return true;
}

export function GateApprovalPanel({ engagementId, gate, currentUserRole, initialApproach, children }: GateApprovalPanelProps) {
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [notes, setNotes] = useState("");
  const [approach, setApproach] = useState(initialApproach ?? "income");
  const [error, setError] = useState<string | null>(null);

  const [retriggered, setRetriggered] = useState(false);
  const isG4 = gate.gate_key === "G4";
  const canApprove = roleAllowsApprove(gate.gate_key, currentUserRole);
  const decided = gate.status === "approved" || gate.status === "rejected";

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["gates", engagementId] });
    queryClient.invalidateQueries({ queryKey: ["engagement", engagementId] });
  }

  const approveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (isG4) body.selected_approach = approach;
      if (notes.trim()) body.notes = notes.trim();
      await apiClient.post(`/engagements/${engagementId}/gates/${gate.gate_key}/approve`, body);
    },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : "Approve failed."),
  });

  const retriggerMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/engagements/${engagementId}/gates/${gate.gate_key}/retrigger`, {});
    },
    onSuccess: () => { setRetriggered(true); setTimeout(() => setRetriggered(false), 3000); invalidate(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Retrigger failed."),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/engagements/${engagementId}/gates/${gate.gate_key}/reject`, { notes });
    },
    onSuccess: () => { setShowReject(false); setNotes(""); setError(null); invalidate(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Reject failed."),
  });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-bold text-slate-600">{gate.gate_key}</span>
          <span className="text-sm font-semibold text-white">
            {gate.label || GATE_LABELS[gate.gate_key] || gate.gate_key}
          </span>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold
          ${decided && gate.status === "approved" ? "bg-emerald-500/15 text-emerald-400"
            : decided && gate.status === "rejected" ? "bg-red-500/15 text-red-400"
            : "bg-amber-500/15 text-amber-400"}`}>
          {gate.status ?? "pending"}
        </span>
      </div>

      {children && (
        <div className="border-b border-white/[0.04] px-6 py-5">{children}</div>
      )}

      {/* Actions */}
      <div className="px-6 py-4">
        {decided ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${gate.status === "approved" ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="font-medium text-slate-300">
                  {gate.status === "approved" ? "Approved" : "Rejected"} by{" "}
                  {gate.approved_by_name || gate.approved_by_email || "—"}
                </span>
              </div>
              {gate.approved_at && (
                <span className="text-slate-600 text-xs">{new Date(gate.approved_at).toLocaleString()}</span>
              )}
              {gate.notes && <span className="text-xs italic text-slate-600">"{gate.notes}"</span>}
              {gate.selected_approach && (
                <span className="rounded bg-white/[0.06] px-2 py-0.5 text-xs text-slate-400">
                  Approach: {gate.selected_approach}
                </span>
              )}
            </div>
            {gate.status === "approved" && canApprove && (
              <div className="flex items-center gap-3">
                <button
                  disabled={retriggerMutation.isPending}
                  onClick={() => { setError(null); retriggerMutation.mutate(); }}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/10 disabled:opacity-40 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {retriggerMutation.isPending ? "Retriggering…" : retriggered ? "Pipeline queued!" : "Retrigger Pipeline"}
                </button>
                {error && <p className="text-xs text-red-400">{error}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isG4 && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-slate-300">Methodology</label>
                <select
                  value={approach}
                  onChange={(e) => setApproach(e.target.value)}
                  className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
                >
                  <option value="income">Income</option>
                  <option value="market">Market</option>
                  <option value="both">Both</option>
                </select>
              </div>
            )}
            {!canApprove && (
              <p className="text-xs text-amber-500">
                {gate.gate_key === "G7" ? "Admin role required." : "Reviewer or admin role required."}
              </p>
            )}
            {!showReject ? (
              <div className="space-y-2">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Approval notes (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                />
                <div className="flex gap-2">
                  <button
                    disabled={!canApprove || approveMutation.isPending}
                    onClick={() => { setError(null); approveMutation.mutate(); }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-40 transition-colors"
                  >
                    {approveMutation.isPending ? "Approving…" : "Approve"}
                  </button>
                  <button
                    onClick={() => { setError(null); setShowReject(true); setNotes(""); }}
                    className="rounded-lg border border-red-500/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <textarea
                  autoFocus
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Rejection notes (required)"
                  rows={3}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
                />
                <div className="flex gap-2">
                  <button
                    disabled={!notes.trim() || rejectMutation.isPending}
                    onClick={() => { setError(null); rejectMutation.mutate(); }}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
                  >
                    {rejectMutation.isPending ? "Submitting…" : "Submit rejection"}
                  </button>
                  <button
                    onClick={() => { setShowReject(false); setNotes(""); }}
                    className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!decided && error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
