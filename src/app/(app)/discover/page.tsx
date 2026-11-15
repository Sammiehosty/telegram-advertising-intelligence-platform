"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search, Plus, X, SlidersHorizontal, Radar, Loader2, CheckCircle2, XCircle,
  SkipForward, CircleDashed, StopCircle, FlaskConical, AlertTriangle,
} from "lucide-react";
import { Card, Field, inputCls, btnPrimary, btnGhost, EmptyState, StatusBadge, Badge } from "@/components/ui";
import { ResultsTable, type ResultRow } from "@/components/results-table";
import { useToast } from "@/components/toaster";
import { CATEGORIES, cn } from "@/lib/utils";

type Job = {
  id: string; keyword: string; status: string; phase: string; progress: number;
  sources: { key: string; label: string; status: string; detail?: string; found: number }[];
  channelsDiscovered: number; channelsAnalysed: number; error: string | null;
  options: { limit?: number; periodDays?: number };
};

const RELATED_HINTS: Record<string, string[]> = {
  cryptocurrency: ["Bitcoin", "BTC", "Crypto Trading", "Altcoins", "USDT", "DeFi"],
  crypto: ["Bitcoin", "BTC", "Crypto Trading", "Altcoins", "USDT"],
  forex: ["Forex Signals", "Trading", "FX", "Pips", "Gold Trading"],
  betting: ["Football Predictions", "Odds", "Tips", "Accumulator"],
  bitcoin: ["BTC", "Crypto", "Hodl", "Sats"],
  gaming: ["Esports", "PC Gaming", "Game Deals"],
};

function sourceIcon(status: string) {
  if (status === "completed") return <CheckCircle2 size={15} className="text-mint shrink-0" />;
  if (status === "running") return <Loader2 size={15} className="animate-spin text-sky-400 shrink-0" />;
  if (status === "skipped") return <SkipForward size={15} className="text-amber-400 shrink-0" />;
  if (status === "failed" || status === "unavailable") return <XCircle size={15} className="text-rose-400 shrink-0" />;
  return <CircleDashed size={15} className="text-muted shrink-0" />;
}

export default function DiscoverPage() {
  const params = useSearchParams();
  const { toast } = useToast();

  const [keyword, setKeyword] = useState("");
  const [related, setRelated] = useState<string[]>([]);
  const [relatedInput, setRelatedInput] = useState("");
  const [limit, setLimit] = useState(50);
  const [periodDays, setPeriodDays] = useState(30);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    minSubs: "", maxSubs: "", minAvgViews: "", minER: "", maxER: "",
    activeWithinDays: "", minFreq: "", maxFreq: "", category: "",
  });

  const [job, setJob] = useState<Job | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const hints = RELATED_HINTS[Object.keys(RELATED_HINTS).find((k) => keyword.toLowerCase().includes(k)) ?? ""] ?? [];

  const stopPoll = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const loadResults = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/discovery/${jobId}/results`);
    const data = await res.json();
    if (data.ok) {
      const rows: ResultRow[] = (data.results as (ResultRow & { skipped: boolean })[]).filter((r) => !r.skipped);
      setResults(rows);
      setSkippedCount((data.results as { skipped: boolean }[]).filter((r) => r.skipped).length);
    }
  }, []);

  const loadJob = useCallback(async (jobId: string) => {
    const res = await fetch(`/api/discovery/${jobId}`);
    const data = await res.json();
    if (data.ok) {
      setJob(data.job);
      if (["completed", "failed", "cancelled"].includes(data.job.status)) {
        stopPoll();
        await loadResults(jobId);
      }
    }
  }, [loadResults]);

  useEffect(() => {
    const jobId = params.get("job");
    if (jobId) loadJob(jobId);
    return stopPoll;
  }, [params, loadJob]);

  async function startSearch() {
    if (!keyword.trim()) {
      toast("error", "Enter a keyword", "For example: Cryptocurrency, Forex, Scholarships…");
      return;
    }
    setResults(null);
    setJob(null);
    const activeFilters: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(filters)) {
      if (v !== "") activeFilters[k] = k === "category" ? v : Number(v);
    }
    const res = await fetch("/api/discovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: keyword.trim(), relatedKeywords: related, limit, periodDays, filters: activeFilters }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast("error", "Search could not start", data.error);
      return;
    }
    toast("info", "Search started", `Discovering channels for "${keyword.trim()}".`);
    await loadJob(data.jobId);
    stopPoll();
    pollRef.current = setInterval(() => loadJob(data.jobId), 1200);
  }

  async function cancelJob() {
    if (!job) return;
    await fetch(`/api/discovery/${job.id}/cancel`, { method: "POST" });
    toast("info", "Cancelling search…");
  }

  const running = job && ["queued", "running"].includes(job.status);

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Search hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid-texture absolute inset-0" />
        <div className="absolute -right-20 -top-28 h-72 w-72 rounded-full bg-mint/10 blur-[100px]" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-mint">
            <Radar size={14} /> Keyword Discovery Engine
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight md:text-3xl">
            Find Telegram channels worth advertising in
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Enter a keyword — the engine runs every enabled discovery source, deduplicates by
            Telegram ID and username, analyses public statistics, and scores advertising potential.
          </p>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_260px]">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    className={inputCls + " !pl-10 !py-3 text-base"}
                    placeholder="e.g. Cryptocurrency, Forex, Football Predictions…"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && startSearch()}
                  />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={cn(btnGhost, showFilters && "border-mint/40 text-mint")} title="Advanced filters">
                  <SlidersHorizontal size={15} />
                  <span className="hidden sm:inline">Filters</span>
                </button>
                <button onClick={startSearch} disabled={!!running} className={btnPrimary + " px-6"}>
                  {running ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} strokeWidth={2.5} />}
                  Search
                </button>
              </div>

              {/* Related keywords */}
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {related.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-xs font-semibold text-mint">
                      {k}
                      <button onClick={() => setRelated((r) => r.filter((x) => x !== k))} aria-label={`Remove ${k}`}><X size={11} /></button>
                    </span>
                  ))}
                  <input
                    className="min-w-[160px] flex-1 bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted/60"
                    placeholder="+ Add related keywords (Enter)"
                    value={relatedInput}
                    onChange={(e) => setRelatedInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && relatedInput.trim() && related.length < 12) {
                        setRelated((r) => [...new Set([...r, relatedInput.trim()])]);
                        setRelatedInput("");
                      }
                    }}
                  />
                </div>
                {hints.length > 0 && related.length === 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted">Suggestions:</span>
                    {hints.map((h) => (
                      <button key={h} onClick={() => setRelated((r) => [...r, h])} className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted hover:border-mint/40 hover:text-mint transition">
                        <Plus size={9} className="mr-0.5 inline" />{h}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showFilters && (
                <div className="animate-fade-up rounded-xl border border-line bg-card2/50 p-4">
                  <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted">Result filters</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {([
                      ["minSubs", "Min subscribers"], ["maxSubs", "Max subscribers"],
                      ["minAvgViews", "Min avg views"], ["minER", "Min ER %"], ["maxER", "Max ER %"],
                      ["minFreq", "Min posts/day"], ["maxFreq", "Max posts/day"],
                    ] as [keyof typeof filters, string][]).map(([key, label]) => (
                      <input
                        key={key} type="number" min={0} step="any" placeholder={label}
                        className={inputCls + " !py-2 text-xs"}
                        value={filters[key]}
                        onChange={(e) => setFilters((f) => ({ ...f, [key]: e.target.value }))}
                      />
                    ))}
                    <select className={inputCls + " !py-2 text-xs"} value={filters.activeWithinDays} onChange={(e) => setFilters((f) => ({ ...f, activeWithinDays: e.target.value }))}>
                      <option value="">Activity: any time</option>
                      <option value="1">Active within 24 hours</option>
                      <option value="7">Active within 7 days</option>
                      <option value="30">Active within 30 days</option>
                    </select>
                    <select className={inputCls + " !py-2 text-xs"} value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
                      <option value="">All categories</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Config column */}
            <div className="space-y-4 rounded-xl border border-line bg-card2/40 p-4">
              <Field label="Channels to discover">
                <div className="grid grid-cols-5 gap-1">
                  {[20, 50, 100, 250, 500].map((n) => (
                    <button
                      key={n}
                      onClick={() => setLimit(n)}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-bold transition border",
                        limit === n ? "border-mint/50 bg-mint/15 text-mint" : "border-line bg-card text-muted hover:text-txt"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Analysis period">
                <div className="grid grid-cols-5 gap-1">
                  {[7, 14, 30, 60, 90].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPeriodDays(n)}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-bold transition border",
                        periodDays === n ? "border-mint/50 bg-mint/15 text-mint" : "border-line bg-card text-muted hover:text-txt"
                      )}
                    >
                      {n}d
                    </button>
                  ))}
                </div>
              </Field>
              <div className="rounded-lg border border-mint/20 bg-mint/5 p-2.5 text-[11px] leading-snug text-mint/90">
                <Radar size={12} className="mr-1 inline" />
                Live discovery mode. Searches are queued in the TeleAd API and processed by your VPS Telegram worker.
                Results are not generated from the sample corpus.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress */}
      {job && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[15px] font-bold">
              Searching for: <span className="text-mint">{job.keyword}</span>
            </h2>
            <StatusBadge status={job.status} />
            {skippedCount > 0 && <Badge tone="muted">{skippedCount} filtered out</Badge>}
            <div className="ml-auto flex items-center gap-4 text-xs text-muted">
              <span>Discovered: <b className="tabular text-txt">{job.channelsDiscovered}</b></span>
              <span>Analysed: <b className="tabular text-txt">{job.channelsAnalysed}</b></span>
              {running && (
                <button onClick={cancelJob} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-400/20">
                  <StopCircle size={13} /> Cancel
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-card2">
            <div
              className={cn("h-full rounded-full transition-all duration-700", job.status === "failed" ? "bg-rose-400" : "bg-gradient-to-r from-mintstrong to-mint")}
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="mt-2 flex items-center gap-2 text-xs text-muted">
            {running && <span className="inline-block h-2 w-2 rounded-full bg-mint pulse-dot" />}
            {job.phase}
          </p>

          <div className="mt-4 space-y-2">
            {(job.sources ?? []).map((s) => (
              <div key={s.key} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-line bg-card2/50 px-3.5 py-2.5 text-xs">
                {sourceIcon(s.status)}
                <span className="font-semibold">{s.label}</span>
                {s.found > 0 && <Badge tone="sky">{s.found} found</Badge>}
                {s.detail && <span className="text-muted">{s.detail}</span>}
              </div>
            ))}
          </div>

          {job.status === "failed" && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/25 bg-rose-400/10 p-3.5 text-xs text-rose-200">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-rose-400" />
              <div>
                <p className="font-semibold">The search failed</p>
                <p className="mt-0.5 text-rose-200/80">{job.error ?? "An unknown error occurred in the discovery worker."}</p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-3">
          {results.every((r) => r.isDemo) && (
            <div className="flex items-center gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-xs text-amber-200">
              <FlaskConical size={15} className="text-amber-400 shrink-0" />
              <span>
                <b>Demonstration dataset.</b> These channels come from the sample corpus provider and are flagged
                “Sample data”. Connect Telegram credentials in Administration to run live discovery — no fabricated
                stats are ever mixed into live results.
              </span>
            </div>
          )}
          <ResultsTable rows={results} jobId={job?.id} onAnalysed={() => job && loadResults(job.id)} />
        </div>
      )}
      {results && results.length === 0 && job?.status === "completed" && (
        <EmptyState
          title="No channels matched"
          body="Every discovered channel was filtered out, or no provider returned candidates. Loosen the filters or try a broader keyword."
        />
      )}
      {!job && !results && (
        <EmptyState
          title="Ready to discover"
          body="Enter a keyword above to run a multi-source discovery. Results are scored, ranked, and exportable."
        />
      )}
    </div>
  );
}
