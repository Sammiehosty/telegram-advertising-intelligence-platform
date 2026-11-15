"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Database } from "lucide-react";
import { Card, EmptyState, SkeletonRows, ChannelAvatar, QualityBadge, AdBadge, DemoBadge, inputCls } from "@/components/ui";
import { fmtNum, timeAgo, CATEGORIES } from "@/lib/utils";

type Row = {
  id: string; title: string; username: string; description: string; category: string;
  subscribers: number; isDemo: boolean; lastAnalysedAt: string | null;
  avgViews: number | null; engagementRate: number | null; viewsRate: number | null;
  postingFrequency: number | null; qualityScore: number | null; adScore: number | null;
  lastActiveAt: string | null;
};

const SORT_OPTIONS = [
  { value: "adScore", label: "Highest advertising score" },
  { value: "subscribers", label: "Highest subscribers" },
  { value: "avgViews", label: "Highest average views" },
  { value: "engagement", label: "Highest engagement" },
  { value: "quality", label: "Highest quality" },
  { value: "recent", label: "Most recently active" },
  { value: "title", label: "Name A–Z" },
];

export default function ChannelsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("adScore");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p = page, q = query, c = category, s = sort) => {
    setLoading(true);
    const res = await fetch(`/api/channels?page=${p}&query=${encodeURIComponent(q)}&category=${encodeURIComponent(c)}&sort=${s}`);
    const data = await res.json();
    if (data.ok) {
      setRows(data.channels);
      setTotal(data.total);
      setPageSize(data.pageSize);
    }
    setLoading(false);
  }, [page, query, category, sort]);

  useEffect(() => { load(page); }, [page, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(1); }, 350);
    return () => clearTimeout(t);
  }, [query, category]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2.5">
            <Database size={22} className="text-mint" /> Channel Database
          </h1>
          <p className="mt-1 text-sm text-muted">Every channel the discovery engine has found — {total.toLocaleString()} records.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input className={inputCls + " !pl-9.5"} style={{ paddingLeft: 38 }} placeholder="Search by username…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className={inputCls + " !w-auto"} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={inputCls + " !w-auto"} value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
          {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading && !rows && <SkeletonRows n={6} height={90} />}

      {rows && rows.length === 0 && (
        <EmptyState
          title="No channels in the database yet"
          body="Run a keyword discovery to populate the database. Results are deduplicated and persist here."
          action={<Link href="/discover" className="rounded-xl bg-mint px-4 py-2 text-xs font-bold text-[#04140c]">Discover channels</Link>}
        />
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link key={c.id} href={`/channels/${c.id}`}>
              <Card className="group h-full transition hover:border-mint/30 hover:shadow-lg hover:shadow-mint/5">
                <div className="flex items-start gap-3">
                  <ChannelAvatar title={c.title} size={44} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold group-hover:text-mint transition">{c.title}</p>
                      {c.isDemo && <DemoBadge />}
                    </div>
                    <p className="text-xs text-muted">@{c.username} · {c.category}</p>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-muted">{c.description || "No public description."}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-card2 px-1 py-2">
                    <p className="tabular text-sm font-extrabold">{fmtNum(c.subscribers)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Subs</p>
                  </div>
                  <div className="rounded-lg bg-card2 px-1 py-2">
                    <p className="tabular text-sm font-extrabold">{fmtNum(c.avgViews)}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Avg views</p>
                  </div>
                  <div className="rounded-lg bg-card2 px-1 py-2">
                    <p className="tabular text-sm font-extrabold">{c.engagementRate != null ? `${c.engagementRate}%` : "—"}</p>
                    <p className="text-[10px] uppercase tracking-wider text-muted">ER</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <QualityBadge score={c.qualityScore} />
                  <AdBadge score={c.adScore} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-center gap-3">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl border border-line bg-card2 p-2 text-muted hover:text-txt disabled:opacity-40">
            <ChevronLeft size={16} />
          </button>
          <span className="tabular text-xs font-semibold text-muted">Page {page} of {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-xl border border-line bg-card2 p-2 text-muted hover:text-txt disabled:opacity-40">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
