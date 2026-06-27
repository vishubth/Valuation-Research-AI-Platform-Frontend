import type { ReactNode } from "react";

type Tone = "green" | "yellow" | "red" | "blue" | "gray" | "orange" | "purple";

const TONE_CLASSES: Record<Tone, string> = {
  green:  "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25",
  yellow: "bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25",
  red:    "bg-red-500/15 text-red-400 ring-1 ring-red-500/25",
  orange: "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/25",
  blue:   "bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25",
  gray:   "bg-white/[0.06] text-slate-400 ring-1 ring-white/10",
  purple: "bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

export function confidenceTone(band?: string | number | null): Tone {
  if (typeof band === "number") {
    if (band >= 0.85) return "green";
    if (band >= 0.60) return "yellow";
    return "orange";
  }
  switch ((band ?? "").toLowerCase()) {
    case "high":   return "green";
    case "medium": return "yellow";
    case "low":    return "orange";
    default:       return "gray";
  }
}

export function statusTone(status?: string): Tone {
  switch ((status ?? "").toLowerCase()) {
    case "approved": case "completed": case "parsed": return "green";
    case "rejected": case "failed":    return "red";
    case "processing": case "queued":  return "yellow";
    case "draft": case "intake":       return "blue";
    case "pending":                    return "gray";
    case "archived":                   return "gray";
    default:                           return "gray";
  }
}

export function severityTone(severity?: string): Tone {
  switch ((severity ?? "").toLowerCase()) {
    case "high": case "critical": return "red";
    case "medium":                return "orange";
    case "low":                   return "yellow";
    default:                      return "gray";
  }
}

export function StatusBadge({ status }: { status?: string }) {
  return <Badge tone={statusTone(status)}>{status ?? "unknown"}</Badge>;
}

export function ConfidenceBadge({ band }: { band?: string | number | null }) {
  const label =
    band === null || band === undefined ? "n/a"
    : typeof band === "number" ? `${Math.round(band * 100)}%`
    : band;
  return <Badge tone={confidenceTone(band)}>{label}</Badge>;
}
