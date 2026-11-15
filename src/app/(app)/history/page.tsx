"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Eye, RotateCcw, Download, Trash2, Loader2 } from "lucide-react";
import { Card, EmptyState, SkeletonRows, StatusBadge } from "@/components/ui";
import { timeAgo, fmtDate } from "@/lib/utils";
import { useToast } from "@/components/toaster";

type JobRow = {
  id: string; keyword: string; relatedKeywords: string[]; status: string; progress: number;
  channelsDiscovered: number; channelsAnalysed: number; createdAt: string;
  bestChannelId: string | null; bestTitle: string | null; bestUsername: string | null;
};

export default function HistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [jobs, setJobs] = useState<JobRow[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/discovery");
    const data = await res.json();
    if (data.ok) setJobs(data.jobs);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function repeat(j: JobRow) {
    setBusyId(j.id);
    const res = await fetch("/api/discovery", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyword: j.keyword, relatedKeywords: j.relatedKeywords, limit: 50, periodDays: 30 }),
    });
    const data = await res.json().catch(() => ({}));
    setBusyId(null);
    if (res.ok) {
      toast("info", "Search restarted", `Re-running "${j.keyword}".`);
      router.push(`/discover?job=${data.jobId}`);
    } else toast("error", "Could not restart search", data.error);
  }

  async function remove(j: JobRow) {
    await fetch(`/api/discovery/${j.id}`, { method: "DELETE" });
    toast("info", "Search deleted", `"${j.keyword}" removed from history.`);
    load();
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <History size={22} className="text-mint" /> Search History
        </h1>
        <p className="mt-1 text-sm text-muted">Every keyword session is stored — repeat, review or export any of them.</p>
      </div>

      {!jobs && <SkeletonRows n={5} height={64} />}
      {jobs && jobs.length === 0 && (
        <EmptyState title="No searches yet" body="Your discovery sessions will appear here." action={<Link href="/discover" className="rounded-xl bg-mint px-4 py-2 text-xs font-bold text-[#04140c]">Run a search</Link>} />
      )}

      {jobs && jobs.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[10.5px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-semibold">Keyword</th>
                  <th className="px-3 py-3 font-semibold">Date</th>
                  <th className="px-3 py-3 font-semibold text-right">Discovered</th>
                  <th className="px-3 py-3 font-semibold text-right">Analysed</th>
                  <th className="px-3 py-3 font-semibold">Best channel</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b border-line/50 hover:bg-card2/40">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold">{j.keyword}</p>
                      {j.relatedKeywords.length > 0 && (
                        <p className="text-[11px] text-muted truncate max-w-[220px]">+ {j.relatedKeywords.join(", ")}</p>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-xs text-muted" title={fmtDate(j.createdAt)}>{timeAgo(j.createdAt)}</td>
                    <td className="tabular px-3 py-3.5 text-right font-semibold">{j.channelsDiscovered}</td>
                    <td className="tabular px-3 py-3.5 text-right font-semibold">{j.channelsAnalysed}</td>
                    <td className="px-3 py-3.5 text-xs">
                      {j.bestChannelId ? (
                        <Link href={`/channels/${j.bestChannelId}`} className="font-semibold text-mint hover:underline">
                          {j.bestTitle ?? `@${j.bestUsername}`}
                        </Link>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3.5"><StatusBadge status={j.status} /></td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/discover?job=${j.id}`} title="View results" className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-mint transition"><Eye size={14} /></Link>
                        <button onClick={() => repeat(j)} title="Repeat search" className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-sky-400 transition">
                          {busyId === j.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        </button>
                        <a href={`/api/discovery/${j.id}/export`} title="Export CSV" className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-txt transition"><Download size={14} /></a>
                        <button onClick={() => remove(j)} title="Delete" className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-rose-400 transition"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
