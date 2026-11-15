"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  Users, Eye, Heart, MessageCircle, Forward, Gauge, CalendarClock, Activity,
  RefreshCw, Bookmark, BookmarkCheck, Copy, ExternalLink, ShieldAlert, ShieldCheck,
  Info, AlertTriangle, Loader2, FileBarChart,
} from "lucide-react";
import { Card, SectionTitle, SkeletonRows, ChannelAvatar, QualityBadge, AdBadge, DemoBadge, Badge, Field, inputCls, btnGhost, Modal } from "@/components/ui";
import { fmtNum, fmtPct, timeAgo, fmtDate, qualityLabel, adLabel, cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

type Post = {
  id: string; messageId: number; text: string; publishedAt: string;
  views: number | null; reactions: number | null; comments: number | null;
  forwards: number | null; isPromo: boolean; url: string;
};

type Payload = {
  channel: {
    id: string; title: string; username: string; description: string; category: string;
    language: string; subscribers: number; inviteUrl: string; isDemo: boolean;
    discoveredAt: string; lastAnalysedAt: string | null; source: string;
  };
  score: {
    avgViews: number | null; medianViews: number | null; viewsRate: number | null;
    engagementRate: number | null; avgReactions: number | null; avgComments: number | null;
    avgForwards: number | null; postingFrequency: number | null; lastActiveAt: string | null;
    qualityScore: number | null; adScore: number | null; adClass: string | null;
    qualityFlags: { code: string; severity: string; evidence: string }[] | null;
    adBreakdown: Record<string, { points: number; max: number; reason: string }> | null;
  } | null;
  posts: Post[];
  snapshots: { capturedAt: string; subscribers: number; avgViews: number | null }[];
  isSaved: boolean;
  savedId: string | null;
};

const tooltipStyle = {
  background: "#0d1322", border: "1px solid rgba(148,180,255,0.15)",
  borderRadius: 12, fontSize: 12, color: "#e8eefb",
};

const FLAG_ICON: Record<string, typeof ShieldCheck> = {
  high: ShieldAlert, medium: AlertTriangle, low: Info, positive: ShieldCheck,
};
const FLAG_TONE: Record<string, string> = {
  high: "border-rose-400/25 bg-rose-400/5 text-rose-200",
  medium: "border-amber-400/25 bg-amber-400/5 text-amber-200",
  low: "border-sky-400/25 bg-sky-400/5 text-sky-200",
  positive: "border-mint/25 bg-mint/5 text-emerald-200",
};

export default function ChannelDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [period, setPeriod] = useState(30);
  const [periodModal, setPeriodModal] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/channels/${params.id}`);
    const d = await res.json();
    if (d.ok) {
      setData(d);
      setSaved(d.isSaved);
      setSavedId(d.savedId);
    } else setError(d.error ?? "Not found");
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleSave() {
    if (!data) return;
    if (saved && savedId) {
      await fetch(`/api/saved/${savedId}`, { method: "DELETE" });
      setSaved(false);
      toast("info", "Removed from saved channels");
    } else {
      const res = await fetch("/api/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: data.channel.id }) });
      if (res.ok) {
        setSaved(true);
        toast("success", "Channel saved", `@${data.channel.username} is in your database.`);
        load();
      }
    }
  }

  async function reanalyse(p: number) {
    if (!data) return;
    setAnalysing(true);
    setPeriodModal(false);
    const res = await fetch(`/api/channels/${data.channel.id}/analyse?period=${p}`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setAnalysing(false);
    if (res.ok) {
      toast("success", "Analysis refreshed", `${p}-day window recalculated.`);
      load();
    } else toast("error", "Analysis failed", d.error);
  }

  if (error) return <EmptyStateBox message={error} />;
  if (!data) return <SkeletonRows n={8} height={70} />;

  const { channel: c, score: s, posts: postList, snapshots } = data;
  const quality = qualityLabel(s?.qualityScore);
  const ad = adLabel(s?.adScore);
  const viewsSeries = postList.slice(0, 40).reverse().map((p, i) => ({
    i: i + 1, views: p.views ?? 0, reactions: p.reactions ?? 0,
    date: fmtDate(p.publishedAt),
  }));

  const metricCards = [
    { label: "Avg post views", value: fmtNum(s?.avgViews), icon: Eye },
    { label: "Median views", value: fmtNum(s?.medianViews), icon: FileBarChart },
    { label: "Avg reactions", value: s?.avgReactions != null ? fmtNum(Math.round(s.avgReactions)) : "—", icon: Heart },
    { label: "Avg comments", value: s?.avgComments != null ? fmtNum(Math.round(s.avgComments)) : "n/a", icon: MessageCircle, note: s?.avgComments == null ? "unavailable" : undefined },
    { label: "Avg forwards", value: s?.avgForwards != null ? fmtNum(Math.round(s.avgForwards)) : "—", icon: Forward },
    { label: "Posts / day", value: s?.postingFrequency != null ? `${s.postingFrequency}` : "—", icon: CalendarClock },
    { label: "Engagement rate", value: s?.engagementRate != null ? fmtPct(s.engagementRate) : "—", icon: Activity },
    { label: "Views rate", value: s?.viewsRate != null ? fmtPct(s.viewsRate) : "—", icon: Gauge },
  ];

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <Card className="relative overflow-hidden">
        <div className="absolute -right-16 -top-20 h-52 w-52 rounded-full bg-mint/8 blur-[80px]" />
        <div className="relative flex flex-wrap items-start gap-5">
          <ChannelAvatar title={c.title} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">{c.title}</h1>
              {c.isDemo && <DemoBadge />}
            </div>
            <p className="mt-0.5 text-sm text-muted">
              @{c.username} · {c.category} · {c.language.toUpperCase()}
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{c.description || "No public description."}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
              <Badge tone="muted"><Users size={11} /> {c.subscribers.toLocaleString()} subscribers</Badge>
              <Badge tone="muted">Discovered {fmtDate(c.discoveredAt)}</Badge>
              {c.lastAnalysedAt && <Badge tone="sky">Analysed {timeAgo(c.lastAnalysedAt)}</Badge>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2">
              <button onClick={toggleSave} className={btnGhost + " !py-2 text-xs"}>
                {saved ? <BookmarkCheck size={14} className="text-violet-400" /> : <Bookmark size={14} />}
                {saved ? "Saved" : "Save"}
              </button>
              <button onClick={() => setPeriodModal(true)} disabled={analysing} className={btnGhost + " !py-2 text-xs"}>
                {analysing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Re-analyse
              </button>
              <a href={c.inviteUrl || `https://t.me/${c.username}`} target="_blank" rel="noreferrer" className={btnGhost + " !py-2 text-xs"}>
                <ExternalLink size={14} /> Open
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(c.inviteUrl || `https://t.me/${c.username}`); toast("success", "Link copied"); }}
                className={btnGhost + " !py-2 !px-3 text-xs"}
              >
                <Copy size={14} />
              </button>
            </div>
            {s && (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-card2 px-4 py-2">
                <div className="text-center">
                  <p className="tabular text-lg font-extrabold text-mint">{s.adScore}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted">Ad score</p>
                </div>
                <div className="h-8 w-px bg-line" />
                <div className="text-center">
                  <p className={cn("tabular text-lg font-extrabold", (s.qualityScore ?? 0) >= 60 ? "text-sky-400" : "text-amber-400")}>{s.qualityScore}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted">Quality</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {!s ? (
        <EmptyStateBox message="This channel has not been analysed yet. Run analysis from Discover or the Re-analyse button." />
      ) : (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {metricCards.map((m) => (
              <Card key={m.label} className="!p-3.5 text-center">
                <m.icon size={15} className="mx-auto text-mint" />
                <p className="tabular mt-2 text-lg font-extrabold leading-none">{m.value}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-muted leading-tight">{m.label}</p>
                {m.note && <p className="text-[9px] text-amber-400">{m.note}</p>}
              </Card>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {/* Views chart */}
            <Card className="xl:col-span-2">
              <SectionTitle title="Post performance" sub="Views per post (oldest → newest), with reactions" />
              {viewsSeries.length === 0 ? (
                <EmptyStateBox message="No posts collected in this analysis window." />
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={viewsSeries} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148,180,255,0.07)" vertical={false} />
                      <XAxis dataKey="i" tick={{ fontSize: 10, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#8b98b8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtNum(v)} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [fmtNum(Number(value ?? 0)), String(name)]} labelFormatter={(i) => `Post #${i}`} />
                      <Bar dataKey="views" fill="#2ee89b" radius={[3, 3, 0, 0]} name="Views" />
                      <Bar dataKey="reactions" fill="#38bdf8" radius={[3, 3, 0, 0]} name="Reactions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Score breakdown */}
            <Card>
              <SectionTitle title="Advertising potential" sub={ad.label} right={<AdBadge score={s.adScore} />} />
              {s.adBreakdown ? (
                <div className="space-y-4">
                  {Object.entries(s.adBreakdown).map(([key, part]) => (
                    <div key={key} className="rounded-lg">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-semibold capitalize">{key}</span>
                        <span className="tabular text-xs font-bold">{part.points}<span className="text-muted font-normal">/{part.max}</span></span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card2">
                        <div className={cn("h-full rounded-full", part.max > 0 && part.points / part.max >= 0.7 ? "bg-mint" : part.max > 0 && part.points / part.max >= 0.4 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${part.max > 0 ? (part.points / part.max) * 100 : 0}%` }} />
                      </div>
                      <p className="mt-1 text-[10.5px] leading-snug text-muted">{part.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyStateBox message="No breakdown yet." />
              )}
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {/* Quality assessment */}
            <Card className="xl:col-span-2">
              <SectionTitle title="Quality assessment" sub={`${quality.label} — evidence-based, never an accusation`} right={<QualityBadge score={s.qualityScore} />} />
              {s.qualityFlags && s.qualityFlags.length > 0 ? (
                <div className="space-y-2">
                  {s.qualityFlags.map((f) => {
                    const Icon = FLAG_ICON[f.severity] ?? Info;
                    return (
                      <div key={f.code} className={cn("flex items-start gap-3 rounded-xl border px-3.5 py-3 text-xs", FLAG_TONE[f.severity])}>
                        <Icon size={15} className="mt-0.5 shrink-0" />
                        <div>
                          <p className="font-semibold capitalize">{f.code.replace(/_/g, " ")}</p>
                          <p className="mt-0.5 leading-relaxed opacity-85">{f.evidence}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No warning signals detected in the available data.</p>
              )}
            </Card>

            {/* Subscriber history */}
            <Card>
              <SectionTitle title="Subscriber history" sub="Snapshots at each analysis" />
              {snapshots.length < 2 ? (
                <p className="text-xs text-muted leading-relaxed">
                  Historical series builds as the channel is re-analysed or monitored. {snapshots.length} snapshot so far.
                </p>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={snapshots.map((x) => ({ date: fmtDate(x.capturedAt), subs: x.subscribers }))} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradSubs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(148,180,255,0.07)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#8b98b8" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtNum(v)} domain={["auto", "auto"]} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(value) => [Number(value ?? 0).toLocaleString(), "Subscribers"]} />
                      <Area type="monotone" dataKey="subs" stroke="#38bdf8" strokeWidth={2} fill="url(#gradSubs)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Posts */}
          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-line px-5 py-4">
              <h2 className="text-[15px] font-bold">Analysed posts <span className="ml-1 text-xs font-normal text-muted">({postList.length} in window · promotional marked)</span></h2>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {postList.length === 0 && <p className="px-5 py-8 text-center text-xs text-muted">No posts in this window.</p>}
              {postList.map((p) => (
                <div key={p.id} className="border-b border-line/40 px-5 py-3.5 last:border-0">
                  <p className="text-[13px] leading-relaxed line-clamp-2">
                    {p.isPromo && <Badge tone="amber" className="mr-2">PROMO</Badge>}
                    {p.text}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted">
                    <span className="tabular"><Eye size={11} className="mr-1 inline" />{fmtNum(p.views)}</span>
                    <span className="tabular"><Heart size={11} className="mr-1 inline" />{fmtNum(p.reactions)}</span>
                    <span className="tabular"><MessageCircle size={11} className="mr-1 inline" />{p.comments == null ? "n/a" : fmtNum(p.comments)}</span>
                    <span className="tabular"><Forward size={11} className="mr-1 inline" />{fmtNum(p.forwards)}</span>
                    <span className="ml-auto">{timeAgo(p.publishedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Modal open={periodModal} onClose={() => setPeriodModal(false)} title="Re-analyse channel">
        <p className="mb-4 text-sm text-muted">Choose the analysis window. Metrics are recalculated from the channel's recent public posts.</p>
        <div className="grid grid-cols-5 gap-2">
          {[7, 14, 30, 60, 90].map((p) => (
            <button key={p} onClick={() => reanalyse(p)} className={cn("rounded-xl border py-3 text-sm font-bold transition", period === p ? "border-mint/50 bg-mint/15 text-mint" : "border-line bg-card2 text-muted hover:text-txt")}>
              {p}d
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted">Demo channels regenerate a deterministic sample window; live channels require the Telegram API worker.</p>
      </Modal>
    </div>
  );
}

function EmptyStateBox({ message }: { message: string }) {
  return (
    <Card className="py-10 text-center">
      <p className="text-sm text-muted">{message}</p>
    </Card>
  );
}
