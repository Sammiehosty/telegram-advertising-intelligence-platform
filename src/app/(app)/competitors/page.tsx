"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Search, Loader2, Save, Trash2, Repeat, Link2, CheckCheck } from "lucide-react";
import { Card, EmptyState, SkeletonRows, ChannelAvatar, Badge, inputCls, btnPrimary } from "@/components/ui";
import { fmtNum, timeAgo } from "@/lib/utils";
import { useToast } from "@/components/toaster";

type ScanHit = {
  postId: string; text: string; publishedAt: string; views: number | null; forwards: number | null;
  url: string; channelId: string; channelTitle: string; channelUsername: string; isDemo: boolean;
};

type SavedAd = {
  id: string; advertiserText: string; link: string; product: string; occurrences: number;
  notes: string; isDemo: boolean; firstSeen: string; channelTitle: string | null; channelUsername: string | null;
};

export default function CompetitorsPage() {
  const { toast } = useToast();
  const [keyword, setKeyword] = useState("");
  const [scanning, setScanning] = useState(false);
  const [hits, setHits] = useState<ScanHit[] | null>(null);
  const [repeated, setRepeated] = useState<{ username: string; count: number }[]>([]);
  const [savedAds, setSavedAds] = useState<SavedAd[] | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const loadSaved = useCallback(async () => {
    const res = await fetch("/api/competitors");
    const data = await res.json();
    if (data.ok) setSavedAds(data.ads);
  }, []);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  async function scan() {
    setScanning(true);
    const res = await fetch("/api/competitors/scan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword }),
    });
    const data = await res.json().catch(() => ({}));
    setScanning(false);
    if (res.ok) {
      setHits(data.ads);
      setRepeated(data.repeatedAdvertisers ?? []);
      if (data.ads.length === 0) toast("info", "No promotional posts found", "Analyse more channels first, or adjust the keyword.");
    } else toast("error", "Scan failed", data.error);
  }

  async function saveAd(h: ScanHit) {
    const res = await fetch("/api/competitors", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: h.channelId, advertiserText: h.text, link: h.url, product: "", isDemo: h.isDemo }),
    });
    if (res.ok) {
      setSavedIds((s) => new Set(s).add(h.postId));
      toast("success", "Advertisement saved", "Added to your competitor ad collection.");
      loadSaved();
    }
  }

  async function removeAd(id: string) {
    await fetch(`/api/competitors?id=${id}`, { method: "DELETE" });
    loadSaved();
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <Swords size={22} className="text-mint" /> Competitor Ad Research
        </h1>
        <p className="mt-1 text-sm text-muted">
          Scan publicly collected channel posts for sponsored content, track repeated advertisers, and save examples.
          Only public channel posts are scanned — never private messages or groups.
        </p>
      </div>

      {/* Scan */}
      <Card>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input className={inputCls} style={{ paddingLeft: 38 }} placeholder="Filter by product keyword (optional) — e.g. course, casino, app" value={keyword} onChange={(e) => setKeyword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scan()} />
          </div>
          <button onClick={scan} disabled={scanning} className={btnPrimary}>
            {scanning ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} strokeWidth={2.5} />}
            Scan analysed channels
          </button>
        </div>
        {repeated.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-semibold text-muted"><Repeat size={12} /> Repeated advertisers:</span>
            {repeated.map((r) => (
              <Badge key={r.username} tone="amber">@{r.username} ×{r.count}</Badge>
            ))}
          </div>
        )}
      </Card>

      {/* Scan results */}
      {scanning && <SkeletonRows n={4} height={70} />}
      {hits && hits.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">{hits.length} promotional posts detected</p>
          {hits.map((h) => (
            <Card key={h.postId} className="!p-4">
              <div className="flex items-start gap-3">
                <ChannelAvatar title={h.channelTitle} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/channels/${h.channelId}`} className="text-sm font-bold hover:text-mint">{h.channelTitle}</Link>
                    <Badge tone="amber">PROMO</Badge>
                    {h.isDemo && <Badge tone="muted">sample</Badge>}
                    <span className="text-[11px] text-muted">{timeAgo(h.publishedAt)}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted line-clamp-3">{h.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-muted">
                    <span className="tabular">Views {fmtNum(h.views)}</span>
                    <span className="tabular">Forwards {fmtNum(h.forwards)}</span>
                    {h.url && (
                      <a href={h.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:underline">
                        <Link2 size={11} /> View post
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => saveAd(h)}
                  disabled={savedIds.has(h.postId)}
                  className="rounded-xl border border-line bg-card2 p-2.5 text-muted transition hover:border-mint/40 hover:text-mint disabled:text-mint disabled:border-mint/40"
                  title="Save example"
                >
                  {savedIds.has(h.postId) ? <CheckCheck size={15} /> : <Save size={15} />}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {hits && hits.length === 0 && (
        <EmptyState title="No promotional posts detected" body="The scan only sees posts collected during discovery/analysis. Run more keyword searches to grow the corpus." />
      )}

      {/* Saved collection */}
      <div>
        <h2 className="mb-3 text-[15px] font-bold">Saved advertisement examples</h2>
        {!savedAds && <SkeletonRows n={2} height={60} />}
        {savedAds && savedAds.length === 0 && <EmptyState title="Nothing saved yet" body="Save promotional posts from scans to build a swipe-file of competitor creatives." />}
        <div className="grid gap-3 lg:grid-cols-2">
          {savedAds?.map((a) => (
            <Card key={a.id} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {a.channelUsername && <p className="text-xs font-bold text-sky-300">@{a.channelUsername}</p>}
                  <p className="mt-1 text-[13px] leading-relaxed text-muted line-clamp-3">{a.advertiserText}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    {a.product && <Badge tone="sky">{a.product}</Badge>}
                    {a.isDemo && <Badge tone="muted">sample</Badge>}
                    <span>Saved {timeAgo(a.firstSeen)}</span>
                  </div>
                </div>
                <button onClick={() => removeAd(a.id)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-rose-400" title="Delete"><Trash2 size={14} /></button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
