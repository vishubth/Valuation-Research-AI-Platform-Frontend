"use client";

import { Fragment, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../lib/api-client";
import { useConfig } from "../../lib/hooks";
import { AdminGuard } from "../../components/AdminGuard";
import { Spinner } from "../../components/Spinner";
import { ErrorBox } from "../../components/Section";
import { relativeTime } from "../../lib/format";
import type { ConfigSetting } from "../../lib/types";

function ConfigEditor({ setting }: { setting: ConfigSetting }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState(JSON.stringify(setting.config_value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new ApiError("invalid_json", "config_value is not valid JSON.");
      }
      await apiClient.put(`/config/${setting.config_key}`, { config_value: parsed });
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.invalidateQueries({ queryKey: ["config"] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : "Save failed."),
  });

  // Pre-validate to disable submit on invalid JSON.
  let jsonValid = true;
  try { JSON.parse(text); } catch { jsonValid = false; }

  return (
    <div className="border-t border-white/[0.06] bg-[#0d1117] px-5 py-4">
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-slate-600">config_value (JSON)</label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        className={`w-full rounded-lg border bg-white/[0.06] px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:ring-1 ${
          jsonValid ? "border-white/10 focus:border-indigo-500 focus:ring-indigo-500" : "border-red-500/50 focus:border-red-500 focus:ring-red-500/40"
        }`}
      />
      {!jsonValid && <p className="mt-1.5 text-xs text-red-400">Invalid JSON — fix before saving.</p>}
      {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button
          disabled={!jsonValid || mutation.isPending}
          onClick={() => { setError(null); mutation.mutate(); }}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-40 transition-colors"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved</span>}
      </div>
    </div>
  );
}

function ConfigList() {
  const configQuery = useConfig();
  const [expanded, setExpanded] = useState<string | null>(null);
  const settings = configQuery.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Configuration</h1>
        <p className="mt-0.5 text-sm text-slate-500">System configuration settings</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#161b22]">
        {configQuery.isLoading ? (
          <div className="px-5"><Spinner /></div>
        ) : configQuery.isError ? (
          <div className="px-5 py-4">
            <ErrorBox>{configQuery.error instanceof ApiError ? configQuery.error.message : "Failed to load config."}</ErrorBox>
          </div>
        ) : settings.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-slate-600">No config settings.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Key</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Type</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Version</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Updated</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => {
                const open = expanded === s.config_key;
                return (
                  <Fragment key={s.config_key}>
                    <tr
                      onClick={() => setExpanded(open ? null : s.config_key)}
                      className="cursor-pointer border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-200">{s.config_key}</td>
                      <td className="px-5 py-3.5 text-slate-400">{s.config_type || "—"}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{s.version ?? "—"}</td>
                      <td className="px-5 py-3.5 text-slate-500">{relativeTime(s.updated_at)}</td>
                      <td className="px-5 py-3.5 text-right text-slate-600">
                        <svg className={`inline h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={5} className="p-0">
                          <ConfigEditor setting={s} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AdminConfigPage() {
  return (
    <AdminGuard>
      <ConfigList />
    </AdminGuard>
  );
}
