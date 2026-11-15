"use client";

import type { ReactNode } from "react";
import { cn, qualityLabel, adLabel } from "@/lib/utils";
import { Inbox } from "lucide-react";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-line bg-card p-5", className)}>{children}</div>
  );
}

export function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  teal: "bg-teal-400/10 text-teal-300 border-teal-400/25",
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/25",
  orange: "bg-orange-400/10 text-orange-300 border-orange-400/25",
  red: "bg-rose-400/10 text-rose-300 border-rose-400/25",
  muted: "bg-slate-400/10 text-muted border-line-strong",
  sky: "bg-sky-400/10 text-sky-300 border-sky-400/25",
};

export function Badge({ tone = "muted", children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function QualityBadge({ score }: { score?: number | null }) {
  const q = qualityLabel(score);
  return <Badge tone={q.tone}>{score != null ? `${score} · ${q.label}` : "Not analysed"}</Badge>;
}

export function AdBadge({ score }: { score?: number | null }) {
  const q = adLabel(score);
  return <Badge tone={q.tone}>{score != null ? `${score}/100` : "—"}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, keyof typeof badgeTones> = {
    completed: "green", running: "sky", queued: "muted", failed: "red", cancelled: "amber",
    active: "green", draft: "muted", paused: "amber",
    configured: "green", not_configured: "muted", error: "red", skipped: "amber", unavailable: "orange",
  };
  return <Badge tone={map[status] ?? "muted"}>{status.replace(/_/g, " ")}</Badge>;
}

export function DemoBadge() {
  return <Badge tone="amber" className="uppercase tracking-wider">Sample data</Badge>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-card/40 px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-card2 border border-line">
        <Inbox size={20} className="text-muted" />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {body && <p className="mt-1 max-w-md text-xs text-muted leading-relaxed">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ n = 6, height = 14 }: { n?: number; height?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg className={cn("animate-spin", className)} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3.5" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-card2">
      <div
        className="h-full rounded-full bg-gradient-to-r from-mintstrong to-mint transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function ChannelAvatar({ title, size = 40 }: { title: string; size?: number }) {
  const hues = [152, 190, 210, 265, 330, 20, 45, 120];
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 997;
  const hue = hues[h % hues.length];
  const initials = title.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl font-bold text-white"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: `linear-gradient(135deg, hsl(${hue} 70% 42%), hsl(${(hue + 40) % 360} 75% 30%))`,
      }}
    >
      {initials || "?"}
    </div>
  );
}

export function ScoreBar({ label, points, max, reason }: { label: string; points: number; max: number; reason?: string }) {
  const pct = max > 0 ? (points / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-muted">{label}</span>
        <span className="tabular font-semibold">{points}<span className="text-muted font-normal">/{max}</span></span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-card2">
        <div className={cn("h-full rounded-full", pct >= 70 ? "bg-mint" : pct >= 40 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${pct}%` }} />
      </div>
      {reason && <p className="mt-1 text-[11px] text-muted leading-snug">{reason}</p>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative w-full animate-fade-up rounded-2xl border border-line-strong bg-card p-6 shadow-2xl shadow-black/60 max-h-[88vh] overflow-y-auto", wide ? "max-w-3xl" : "max-w-lg")}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold tracking-tight">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-card2 hover:text-txt" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-muted uppercase tracking-wider">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted leading-snug">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-line bg-card2 px-3.5 py-2.5 text-sm text-txt placeholder:text-muted/60 outline-none transition focus:border-mint/50 focus:ring-2 focus:ring-mint/15";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-mintstrong to-mint px-4 py-2.5 text-sm font-bold text-[#04140c] shadow-lg shadow-mint/20 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-card2 px-4 py-2.5 text-sm font-semibold text-txt transition hover:border-linestrong hover:bg-card2/70 disabled:opacity-50 disabled:pointer-events-none";
