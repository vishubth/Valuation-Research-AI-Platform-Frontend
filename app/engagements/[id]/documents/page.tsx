"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../../../lib/api-client";
import { useAuth } from "../../../lib/auth-context";
import { useGates } from "../../../lib/hooks";
import { Badge, ConfidenceBadge } from "../../../components/Badge";
import { Spinner } from "../../../components/Spinner";
import { GateApprovalPanel } from "../../../components/GateApprovalPanel";
import { DOCUMENT_TYPES, type DocumentRecord, type ExtractionResult } from "../../../lib/types";

function effectiveStatus(doc: DocumentRecord) {
  return doc.extraction_status ?? doc.upload_status;
}

function ExtractionDisplay({ result }: { result: ExtractionResult }) {
  return (
    <div className="mt-4 space-y-5">
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {result.company_name && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Company</dt>
            <dd className="mt-1 text-sm text-slate-200">{result.company_name}</dd>
          </div>
        )}
        {result.fiscal_period && (
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Fiscal period</dt>
            <dd className="mt-1 text-sm text-slate-200">{result.fiscal_period}</dd>
          </div>
        )}
      </div>

      {result.line_items && result.line_items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Label</th>
                <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Value</th>
                <th className="pb-2.5 pr-5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Period</th>
                <th className="pb-2.5 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-600">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {result.line_items.map((li, i) => (
                <tr key={i}>
                  <td className="py-2.5 pr-5 text-slate-300">{li.label}</td>
                  <td className="py-2.5 pr-5 font-mono text-xs text-slate-200">{String(li.value ?? "—")}</td>
                  <td className="py-2.5 pr-5 text-slate-500">{li.period || "—"}</td>
                  <td className="py-2.5"><ConfidenceBadge band={li.confidence} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.flags && result.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.flags.map((f, i) => <Badge key={i} tone="orange">{f}</Badge>)}
        </div>
      )}
    </div>
  );
}

function DocumentRow({ doc }: { doc: DocumentRecord }) {
  const status = effectiveStatus(doc);
  const isPolling = status === "queued" || status === "processing";

  const statusQuery = useQuery({
    queryKey: ["extraction-status", doc.id],
    enabled: isPolling,
    refetchInterval: (query) => {
      const s = query.state.data as DocumentRecord | undefined;
      const st = s ? effectiveStatus(s) : status;
      return st === "queued" || st === "processing" ? 4000 : false;
    },
    queryFn: async () => {
      const res = await apiClient.get<DocumentRecord>(`/documents/${doc.id}/extraction-status`);
      return res.data;
    },
  });

  const current = statusQuery.data ?? doc;
  const curStatus = effectiveStatus(current);

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.06]">
            <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">{current.file_name || "(document)"}</p>
            {current.document_type && <p className="text-xs text-slate-600">{current.document_type}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPolling && (
            <svg className="h-3.5 w-3.5 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          <Badge tone={curStatus === "parsed" ? "green" : curStatus === "failed" ? "red" : "yellow"}>
            {curStatus}{isPolling ? "…" : ""}
          </Badge>
        </div>
      </div>

      {curStatus === "parsed" && current.extraction_result && (
        <ExtractionDisplay result={current.extraction_result} />
      )}
      {curStatus === "failed" && (
        <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-400">
          {current.extraction_error || "Extraction failed."}
        </div>
      )}
    </div>
  );
}

export default function DocumentsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const gatesQuery = useGates(id);
  const [docType, setDocType] = useState<string>(DOCUMENT_TYPES[0]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docsQuery = useQuery({
    queryKey: ["documents", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiClient.get<DocumentRecord[]>(`/engagements/${id}/documents`);
      return res.data ?? [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", docType);
      await apiClient.postFormData(`/engagements/${id}/documents`, fd);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["documents", id] }),
    onError: (err) => setError(err instanceof ApiError ? err.message : "Upload failed."),
  });

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    Array.from(files).forEach((f) => uploadMutation.mutate(f));
  }

  const docs = docsQuery.data ?? [];
  const anyParsed = docs.some((d) => effectiveStatus(d) === "parsed");
  const g1 = (gatesQuery.data ?? []).find((g) => g.gate_key === "G1");

  return (
    <div className="space-y-5">
      {/* Upload */}
      <div className="rounded-xl border border-white/[0.06] bg-[#161b22] px-6 py-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-600">Upload Document</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600">Type</label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#1c2333] px-3 py-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 [color-scheme:dark]"
            >
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e: DragEvent) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-12 text-center transition-colors ${
            dragOver ? "border-indigo-500/50 bg-indigo-500/5" : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
          }`}
        >
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06]">
            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-300">Drop a file or click to browse</p>
          <p className="mt-0.5 text-xs text-slate-600">PDF, 10-K, 10-Q, financial statements</p>
          <input ref={fileInputRef} type="file" className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => { handleFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {uploadMutation.isPending && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <svg className="h-3.5 w-3.5 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Uploading…
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>

      {/* Document list */}
      <div>
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-600">Documents</h2>
        {docsQuery.isLoading ? <Spinner /> : docs.length === 0 ? (
          <p className="text-sm text-slate-600">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {docs.map((d) => <DocumentRow key={d.id} doc={d} />)}
          </div>
        )}
      </div>

      {anyParsed && g1 && user && (
        <GateApprovalPanel engagementId={id} gate={g1} currentUserRole={user.role} />
      )}
    </div>
  );
}
