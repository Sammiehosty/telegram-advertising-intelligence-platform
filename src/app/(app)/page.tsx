"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Radio, LineChart as LineChartIcon, Bookmark, Sparkles, Percent, Search, Megaphone,
  ArrowRight, TrendingUp,
} from "lucide-react";
import { Card, SectionTitle, SkeletonRows, EmptyState, StatusBadge, ChannelAvatar, AdBadge, DemoBadge } from "@/components/ui";
import { fmtNum, timeAgo, cn } from "@/lib/utils";

type DashboardData = {
  stats: {
    totalChannels: number; analysed: number; saved: number; excellent: number;
    avgEngagement: number; totalSearches: number; activeCampaigns: number;
  };
  charts: {
    perDay: { day: string; count: number }[];
    byCategory: { category: string; n: number; avg_subs: number }[];
    adDist: { bucket: string; n: number }[];
    engagementDist: { bucket: string; n: number }[];
  };
  recentJobs: { id: string; keyword: string; status: string; channelsDiscovered: number; channelsAnalysed: number; createdAt: string }[];
  topChannels: { id: string; title: string; username: string; subscribers: number; isDemo: boolean; category: string; adScore: number | null; qualityScore: number | null; avgViews: number | null; engagementRate: number | null }[];
  recentChannels: { id: string; title: string; username: string; subscribers: number; isDemo: boolean; category: string; discoveredAt: string; adScore: number | null }[];
};

const PIE_COLORS = ["#2ee89b", "#38bdf8", "#fbbf24", "#fb923c", "#fb7185"];

const tooltipStyle = {
  background: "#0d1322",
  border: "1px solid rgba(148,180,255,0.15)",
  borderRadius: 12,
  fontSize: 12,
  color: "#e8eefb",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : setError(d.error ?? "Failed to load")))
      .catch(() => setError("Network error loading dashboard."));
  }, []);

  if (error) return <EmptyState title="Dashboard unavailable" body={error} />;
  if (!data) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-72" />
      </div>
    );
  }

  const statCards = [
    { label: "Channels Discovered", value: fmtNum(data.stats.totalChannels), icon: Radio, tint: "text-mint" },
    { label: "Channels Analysed", value: fmtNum(data.stats.analysed), icon: LineChartIcon, tint: "text-sky-400" },
    { label: "Saved Channels", value: fmtNum(data.stats.saved), icon: Bookmark, tint: "text-violet-400" },
    { label: "Excellent Opportunities", value: fmtNum(data.stats.excellent), icon: Sparkles, tint: "text-amber-400" },
    { label: "Avg Engagement", value: `${data.stats.avgEngagement}%`, icon: Percent, tint: "text-teal-300" },
    { label: "Total Searches", value: fmtNum(data.stats.totalSearches), icon: Search, tint: "text-rose-300" },
    { label: "Active Campaigns", value: fmtNum(data.stats.activeCampaigns), icon: Megaphone, tint: "text-emerald-300" },
  ];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
        <div className="grid-texture absolute inset-0" />
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-mint/10 blur-[90px]" />
        <div className="relative flex flex-wrap items-center gap-6 p-7">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mint">Command Center</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
              Telegram Ads Intelligence
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted">
              Discover public Telegram channels, analyse authentic engagement, and place
              your ads where they will actually perform.
            </p>
          </div>
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-mintstrong to-mint px-5 py-3 text-sm font-bold text-[#04140c] shadow-lg shadow-mint/25 transition hover:brightness-110"
          >
            <Search size={16} strokeWidth={2.5} /> New Keyword Search
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        {statCards.map((c) => (
          <Card key={c.label} className="!p-4">
            <div className="flex items-center justify-between">
              <c.icon size={16} className={c.tint} />
            </div>
            <p className="tabular mt-3 text-[22px] font-extrabold tracking-tight">{c.value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-muted leading-tight">{c.label}</p>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Channels discovered" sub="Last 14 days across all providers" />
          {data.charts.perDay.length === 0 ? (
            <EmptyState title="No discovery activity yet" body="Run your first keyword search to populate this chart." />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.perDay} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradDisc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#2ee89b" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#2ee89b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,180,255,0.07)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8b98b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="count" stroke="#2ee89b" strokeWidth={2.5} fill="url(#gradDisc)" name="Channels" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Advertising opportunity mix" sub="Score distribution" />
          {data.charts.adDist.length === 0 ? (
            <EmptyState title="No scoring data yet" />
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.charts.adDist} dataKey="n" nameKey="bucket" innerRadius={52} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                    {data.charts.adDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <SectionTitle title="Channels by category" sub="Most populated categories in your database" />
          {data.charts.byCategory.length === 0 ? (
            <EmptyState title="No channels yet" />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.byCategory} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,180,255,0.07)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="category" width={110} tick={{ fontSize: 11, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="n" fill="#38bdf8" radius={[0, 6, 6, 0]} name="Channels" barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Engagement rate distribution" sub="(Reactions + comments) / subscribers" />
          {data.charts.engagementDist.length === 0 ? (
            <EmptyState title="No engagement data yet" />
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.engagementDist} margin={{ top: 0, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(148,180,255,0.07)" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "#8b98b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#8b98b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="n" fill="#2ee89b" radius={[6, 6, 0, 0]} name="Channels" barSize={26} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Tables row */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Top opportunities */}
        <Card className="xl:col-span-2">
          <SectionTitle
            title="Top advertising opportunities"
            sub="Highest Advertising Potential Scores right now"
            right={<Link href="/channels" className="inline-flex items-center gap-1 text-xs font-semibold text-mint hover:underline">View all <ArrowRight size={12} /></Link>}
          />
          {data.topChannels.length === 0 ? (
            <EmptyState title="Nothing scored yet" body="Run a discovery search — analysed channels appear here ranked by advertising potential." action={<Link href="/discover" className={cn("inline-flex items-center gap-2 rounded-xl bg-mint px-4 py-2 text-xs font-bold text-[#04140c]")}>Start discovering</Link>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted">
                    <th className="py-2 pr-3 font-semibold">Channel</th>
                    <th className="py-2 pr-3 font-semibold text-right">Subscribers</th>
                    <th className="py-2 pr-3 font-semibold text-right">Avg Views</th>
                    <th className="py-2 pr-3 font-semibold text-right">ER</th>
                    <th className="py-2 font-semibold text-right">Ad Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topChannels.map((c) => (
                    <tr key={c.id} className="border-t border-line/60 hover:bg-card2/50">
                      <td className="py-2.5 pr-3">
                        <Link href={`/channels/${c.id}`} className="flex items-center gap-2.5 group">
                          <ChannelAvatar title={c.title} size={30} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold group-hover:text-mint transition">{c.title}</p>
                            <p className="text-[11px] text-muted">@{c.username} {c.isDemo && <span className="text-amber-400/80">· sample</span>}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{fmtNum(c.subscribers)}</td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{fmtNum(c.avgViews)}</td>
                      <td className="tabular py-2.5 pr-3 text-right text-muted">{c.engagementRate != null ? `${c.engagementRate}%` : "—"}</td>
                      <td className="py-2.5 text-right"><AdBadge score={c.adScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Recent searches */}
        <Card>
          <SectionTitle
            title="Recent searches"
            right={<Link href="/history" className="inline-flex items-center gap-1 text-xs font-semibold text-mint hover:underline">History <ArrowRight size={12} /></Link>}
          />
          {data.recentJobs.length === 0 ? (
            <EmptyState title="No searches yet" />
          ) : (
            <div className="space-y-2">
              {data.recentJobs.map((j) => (
                <Link key={j.id} href={`/discover?job=${j.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-card2/60 px-3.5 py-3 hover:border-mint/40 transition">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/10">
                    <TrendingUp size={14} className="text-mint" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{j.keyword}</p>
                    <p className="text-[11px] text-muted">{j.channelsAnalysed} analysed · {timeAgo(j.createdAt)}</p>
                  </div>
                  <StatusBadge status={j.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
