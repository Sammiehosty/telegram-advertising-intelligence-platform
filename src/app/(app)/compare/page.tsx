"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { GitCompareArrows, Search, X, Trophy, Sparkles, Loader2, Bot } from "lucide-react";
import { Card, SectionTitle, EmptyState, ChannelAvatar, AdBadge, QualityBadge, DemoBadge, inputCls, btnPrimary, Badge } from "@/components/ui";
import { getCompareCart, setCompareCart } from "@/components/results-table";
import { fmtNum, fmtPct, cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

type CompareRow = {
  id: string; title: string; username: string; category: string; subscribers: number; isDemo: boolean;
  score: {
    avgViews: number | null; medianViews: number | null; viewsRate: number | null;
    engagementRate: number | null; avgReactions: number | null; avgComments: number | null;
    postingFrequency: number | null; qualityScore: number | null; adScore: number | null;
  } | null;
};

type SearchHit = { id: string; title: string; username: string; subscribers: number };

const tooltipStyle = {
  background: "#0d1322", border: "1px solid rgba(148,180,255,0.15)", borderRadius: 12, fontSize: 12, color: "#e8eefb",
};

const METRICS: { key: string; label: string; get: (r: CompareRow) => number | null; fmt: (v: number | null) => string; higher: boolean }[] = [
  { key: "subs", label: "Subscribers", get: (r) => r.subscribers, fmt: (v) => fmtNum(v), higher: true },
  { key: "avgViews", label: "Average views", get: (r) => r.score?.avgViews ?? null, fmt: (v) => fmtNum(v), higher: true },
  { key: "medianViews", label: "Median views", get: (r) => r.score?.medianViews ?? null, fmt: (v) => fmtNum(v), higher: true },
  { key: "er", label: "Engagement rate", get: (r) => r.score?.engagementRate ?? null, fmt: (v) => fmtPct(v), higher: true },
  { key: "vr", label: "Views rate", get: (r) => r.score?.viewsRate ?? null, fmt: (v) => fmtPct(v), higher: true },
  { key: "reactions", label: "Avg reactions", get: (r) => r.score?.avgReactions ?? null, fmt: (v) => fmtNum(v), higher: true },
  { key: "comments", label: "Avg comments", get: (r) => r.score?.avgComments ?? null, fmt: (v) => (v == null ? "n/a" : fmtNum(v)), higher: true },
  { key: "freq", label: "Posts / day", get: (r) => r.score?.postingFrequency ?? null, fmt: (v) => (v == null ? "—" : `${v}`), higher: true },
  { key: "quality", label: "Quality score", get: (r) => r.score?.qualityScore ?? null, fmt: (v) => (v == null ? "—" : `${v}/100`), higher: true },
  { key: "ad", label: "Advertising score", get: (r) => r.score?.adScore ?? null, fmt: (v) => (v == null ? "—" : `${v}/100`), higher: true },
];

export default function ComparePage() {
  const { toast } = useToast();
  const [ids, setIds] = useState<string[]>([]);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [recommendation, setRecommendation] = useState("");
  const [engine, setEngine] = useState("");
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  useEffect(() => {
    setIds(getCompareCart());
    const h = () => setIds(getCompareCart());
    window.addEventListener("telead-compare", h);
    return () => window.removeEventListener("telead-compare", h);
  }, []);

  useEffect(() => {
    if (ids.length >= 2) runCompare(ids);
    else { setRows([]); setRecommendation(""); setWinnerId(null); }
  }, [ids]);

  useEffect(() => {
    if (!query.trim()) { setHits([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/channels?query=${encodeURIComponent(query)}&sort=subscribers`);
      const data = await res.json().catch(() => ({}));
      setHits(data.channels ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function runCompare(channelIds: string[]) {
    setLoading(true);
    const res = await fetch("/api/compare", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelIds }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setRows(data.channels);
      setWinnerId(data.winnerId);
      setRecommendation(data.recommendation);
      setEngine(data.engine);
    } else toast("error", "Comparison failed", data.error);
  }

  function remove(id: string) {
    setCompareCart(getCompareCart().filter((x) => x !== id));
  }
  function add(id: string) {
    const cart = getCompareCart();
    if (cart.includes(id)) return;
    if (cart.length >= 10) { toast("error", "Maximum 10 channels"); return; }
    setCompareCart([...cart, id]);
    setQuery("");
    setHits([]);
  }

  const bestByMetric = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const m of METRICS) {
      let best: string | null = null;
      let bestV = -Infinity;
      for (const r of rows) {
        const v = m.get(r);
        if (v != null && v > bestV) { bestV = v; best = r.id; }
      }
      map[m.key] = best;
    }
    return map;
  }, [rows]);

  const chartData = rows.map((r) => ({
    name: `@${r.username}`.slice(0, 14),
    "Ad Score": r.score?.adScore ?? 0,
    "Quality": r.score?.qualityScore ?? 0,
  }));

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <GitCompareArrows size={22} className="text-mint" /> Channel Comparison
        </h1>
        <p className="mt-1 text-sm text-muted">Compare up to 10 channels side-by-side. Best values per row are highlighted.</p>
      </div>

      {/* Selector */}
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {ids.length === 0 && <p className="text-sm text-muted">No channels selected yet.</p>}
          {rows.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-card2 py-1 pl-1 pr-2 text-xs font-semibold">
              <ChannelAvatar title={r.title} size={20} />
              @{r.username}
              <button onClick={() => remove(r.id)} className="text-muted hover:text-rose-400" aria-label={`Remove ${r.username}`}><X size={12} /></button>
            </span>
          ))}
          {ids.length > 0 && rows.length === 0 && ids.map((id) => (
            <span key={id} className="rounded-full border border-line bg-card2 px-3 py-1 text-xs text-muted">{id.slice(0, 8)}…</span>
          ))}
          <div className="relative ml-auto min-w-[240px] flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={inputCls + " !py-2.5 text-xs"} style={{ paddingLeft: 34 }} placeholder="Add channel by username…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {hits.length > 0 && (
              <div className="absolute right-0 top-11 z-30 w-full overflow-hidden rounded-xl border border-line-strong bg-card shadow-2xl">
                {hits.slice(0, 6).map((h) => (
                  <button key={h.id} onClick={() => add(h.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-card2">
                    <ChannelAvatar title={h.title} size={22} />
                    <span className="font-semibold">@{h.username}</span>
                    <span className="ml-auto text-muted">{fmtNum(h.subscribers)} subs</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {ids.length < 2 && (
        <EmptyState
          title="Select at least 2 channels"
          body="Add channels here, or use the compare icon on any results table to queue channels for comparison."
          action={<Link href="/channels" className={btnPrimary}>Browse database</Link>}
        />
      )}

      {loading && <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted"><Loader2 size={16} className="animate-spin" /> Crunching numbers…</div>}

      {!loading && rows.length >= 2 && (
        <>
          {/* Metric table */}
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Metric</th>
                  {rows.map((r) => (
                    <th key={r.id} className={cn("px-4 py-3.5", r.id === winnerId && "bg-mint/5")}>
                      <Link href={`/channels/${r.id}`} className="flex items-center gap-2 group">
                        <ChannelAvatar title={r.title} size={30} />
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-bold group-hover:text-mint">
                            {r.title}
                            {r.id === winnerId && <Trophy size={12} className="text-amber-400" />}
                          </p>
                          <p className="text-[10px] text-muted">@{r.username} {r.isDemo && "· sample"}</p>
                        </div>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => (
                  <tr key={m.key} className="border-t border-line/50">
                    <td className="px-5 py-3 text-xs font-semibold text-muted">{m.label}</td>
                    {rows.map((r) => {
                      const v = m.get(r);
                      const best = bestByMetric[m.key] === r.id && v != null;
                      return (
                        <td key={r.id} className={cn("tabular px-4 py-3 text-[13px] font-semibold", best && "text-mint", r.id === winnerId && "bg-mint/5")}>
                          {m.fmt(v)}
                          {best && <span className="ml-1 text-[9px] uppercase tracking-wider text-mint/70">best</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="grid gap-5 xl:grid-cols-5">
            <Card className="xl:col-span-2">
              <SectionTitle title="Scores head-to-head" />
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(148,180,255,0.07)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#8b98b8" }} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Ad Score" fill="#2ee89b" radius={[4, 4, 0, 0]} barSize={16} />
                    <Bar dataKey="Quality" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="xl:col-span-3">
              <SectionTitle
                title="Recommendation"
                sub={engine === "ai" ? "Generated by your configured AI provider" : "Deterministic rule-based engine (configure AI in Administration for LLM narratives)"}
                right={<Badge tone={engine === "ai" ? "green" : "sky"}><Bot size={11} /> {engine === "ai" ? "AI" : "Rule-based"}</Badge>}
              />
              <div className="rounded-xl border border-mint/15 bg-mint/5 p-4">
                {recommendation.split("\n\n").map((p, i) => (
                  <p key={i} className={cn("text-sm leading-relaxed text-emerald-50/90", i > 0 && "mt-3", i === 0 && "font-semibold text-mint")}>{p}</p>
                ))}
              </div>
              <p className="mt-3 flex items-start gap-1.5 text-[11px] text-muted">
                <Sparkles size={12} className="mt-0.5 shrink-0 text-amber-400" />
                Based on public statistics only. The platform never claims audience location, age or demographics without supporting data.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
