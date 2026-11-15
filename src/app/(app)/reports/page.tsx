"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Download, Printer, Trophy, CalendarDays } from "lucide-react";
import { Card, SectionTitle, EmptyState, StatusBadge, ChannelAvatar, Badge, QualityBadge, AdBadge, inputCls, btnPrimary, btnGhost } from "@/components/ui";
import { fmtNum, fmtPct, fmtDate, timeAgo } from "@/lib/utils";
import { useToast } from "@/components/toaster";
import type { ResultRow } from "@/components/results-table";

type JobRow = { id: string; keyword: string; status: string; createdAt: string; channelsDiscovered: number; channelsAnalysed: number };

export default function ReportsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [selected, setSelected] = useState("");
  const [rows, setRows] = useState<ResultRow[] | null>(null);
  const [jobInfo, setJobInfo] = useState<JobRow | null>(null);
  const [loading, setLoading] = useState(false);

  const loadJobs = useCallback(async () => {
    const res = await fetch("/api/discovery");
    const data = await res.json();
    if (data.ok) {
      const completed = (data.jobs as JobRow[]).filter((j) => j.status === "completed");
      setJobs(completed);
      if (completed[0]) selectJob(completed[0].id, completed);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function selectJob(id: string, list?: JobRow[]) {
    setSelected(id);
    setLoading(true);
    const res = await fetch(`/api/discovery/${id}/results`);
    const data = await res.json();
    setLoading(false);
    if (data.ok) {
      setRows((data.results as (ResultRow & { skipped: boolean })[]).filter((r) => !r.skipped));
      setJobInfo((list ?? jobs).find((j) => j.id === id) ?? null);
    } else toast("error", "Could not load report data", data.error);
  }

  const top = rows ? [...rows].sort((a, b) => (b.adScore ?? 0) - (a.adScore ?? 0)).slice(0, 15) : [];
  const avgER = rows && rows.length ? rows.reduce((a, r) => a + (r.engagementRate ?? 0), 0) / rows.length : 0;
  const avgQuality = rows && rows.length ? rows.reduce((a, r) => a + (r.qualityScore ?? 0), 0) / rows.length : 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="no-print">
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <FileText size={22} className="text-mint" /> Reports
        </h1>
        <p className="mt-1 text-sm text-muted">Generate professional channel reports from any completed search.</p>
      </div>

      <Card className="no-print">
        <div className="flex flex-wrap items-center gap-3">
          <select className={inputCls + " !w-auto min-w-[260px]"} value={selected} onChange={(e) => selectJob(e.target.value)}>
            {jobs.length === 0 && <option value="">No completed searches yet</option>}
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.keyword} — {fmtDate(j.createdAt)} ({j.channelsAnalysed} analysed)
              </option>
            ))}
          </select>
          {selected && (
            <div className="flex gap-2">
              <a href={`/api/discovery/${selected}/export`} className={btnPrimary}><Download size={15} /> Download CSV</a>
              <button onClick={() => window.print()} className={btnGhost}><Printer size={15} /> Print / Save as PDF</button>
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          PDF export uses your browser's print-to-PDF for pixel-perfect, share-ready reports.
        </p>
      </Card>

      {jobs.length === 0 && (
        <EmptyState title="No reportable searches" body="Complete at least one discovery search, then generate a report here." />
      )}

      {loading && <Card><p className="py-8 text-center text-sm text-muted">Loading report…</p></Card>}

      {rows && jobInfo && !loading && (
        <Card className="print-card !p-7">
          {/* Report header */}
          <div className="border-b border-line pb-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-mint">TeleAd Intelligence Report</p>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight">Keyword: {jobInfo.keyword}</h2>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <CalendarDays size={12} /> Generated {fmtDate(new Date())} · Search date {fmtDate(jobInfo.createdAt)}
                </p>
              </div>
              <StatusBadge status="completed" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Channels discovered", value: String(jobInfo.channelsDiscovered) },
                { label: "Channels analysed", value: String(jobInfo.channelsAnalysed) },
                { label: "Average engagement", value: fmtPct(avgER) },
                { label: "Average quality", value: `${Math.round(avgQuality)}/100` },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-line bg-card2 p-3">
                  <p className="tabular text-xl font-extrabold">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Top table */}
          <div className="mt-6">
            <SectionTitle title={`Top ${top.length} channels by advertising potential`} sub="Full data available in the CSV export" />
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Channel</th>
                  <th className="py-2 pr-3 font-semibold text-right">Subs</th>
                  <th className="py-2 pr-3 font-semibold text-right">Avg views</th>
                  <th className="py-2 pr-3 font-semibold text-right">ER</th>
                  <th className="py-2 pr-3 font-semibold text-right">Quality</th>
                  <th className="py-2 font-semibold text-right">Ad score</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={r.channelId} className="border-b border-line/40">
                    <td className="tabular py-2.5 pr-2 text-muted">{i + 1}</td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Trophy size={13} className="text-amber-400 shrink-0" />}
                        <div>
                          <span className="font-semibold">{r.title}</span>
                          {r.isDemo && <Badge tone="muted" className="ml-2">sample</Badge>}
                          <span className="block text-[11px] text-muted">@{r.username}</span>
                        </div>
                      </div>
                    </td>
                    <td className="tabular py-2.5 pr-3 text-right">{fmtNum(r.subscribers)}</td>
                    <td className="tabular py-2.5 pr-3 text-right">{fmtNum(r.avgViews)}</td>
                    <td className="tabular py-2.5 pr-3 text-right">{r.engagementRate != null ? `${r.engagementRate}%` : "—"}</td>
                    <td className="py-2.5 pr-3 text-right"><QualityBadge score={r.qualityScore} /></td>
                    <td className="py-2.5 text-right"><AdBadge score={r.adScore} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border border-line bg-card2 p-4 text-[11px] leading-relaxed text-muted">
            <b className="text-txt">Methodology.</b> Engagement rate = (avg reactions + avg comments) ÷ subscribers × 100, computed across the
            analysis window. Unavailable metrics are reported as n/a, never as zero. Quality scores are evidence-based
            heuristics over public statistics; they are risk indicators, not accusations. Channels marked “sample” are
            demonstration data from the sample corpus provider.
          </div>
        </Card>
      )}
    </div>
  );
}
