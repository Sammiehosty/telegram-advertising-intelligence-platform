"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown, ExternalLink, RefreshCw, Bookmark, BookmarkCheck, GitCompareArrows,
  Copy, Megaphone, Loader2, Download, X,
} from "lucide-react";
import { Card, QualityBadge, AdBadge, DemoBadge, ChannelAvatar, Modal, Field, inputCls, btnPrimary, btnGhost } from "@/components/ui";
import { fmtNum, timeAgo, cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

export type ResultRow = {
  resultId?: string;
  channelId: string;
  title: string;
  username: string;
  description?: string;
  category: string;
  subscribers: number;
  inviteUrl: string;
  isDemo: boolean;
  avgViews: number | null;
  medianViews?: number | null;
  viewsRate?: number | null;
  engagementRate: number | null;
  postingFrequency?: number | null;
  lastActiveAt: string | null;
  qualityScore: number | null;
  adScore: number | null;
};

const SORTS: { value: string; label: string; fn: (r: ResultRow) => number }[] = [
  { value: "ad", label: "Highest advertising score", fn: (r) => -(r.adScore ?? -1) },
  { value: "subs", label: "Highest subscribers", fn: (r) => -r.subscribers },
  { value: "views", label: "Highest average views", fn: (r) => -(r.avgViews ?? -1) },
  { value: "er", label: "Highest engagement", fn: (r) => -(r.engagementRate ?? -1) },
  { value: "quality", label: "Highest quality score", fn: (r) => -(r.qualityScore ?? -1) },
  { value: "recent", label: "Most recently active", fn: (r) => -(r.lastActiveAt ? new Date(r.lastActiveAt).getTime() : 0) },
];

/* Compare cart (localStorage) */
export function getCompareCart(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("telead-compare") ?? "[]"); } catch { return []; }
}
export function setCompareCart(ids: string[]) {
  localStorage.setItem("telead-compare", JSON.stringify(ids.slice(0, 10)));
  window.dispatchEvent(new Event("telead-compare"));
}

export function ResultsTable({ rows, jobId, onAnalysed }: { rows: ResultRow[]; jobId?: string; onAnalysed?: () => void }) {
  const { toast } = useToast();
  const [sort, setSort] = useState("ad");
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [cart, setCart] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [campaignModal, setCampaignModal] = useState<ResultRow | null>(null);
  const [campaigns, setCampaigns] = useState<{ id: string; name: string }[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [price, setPrice] = useState("");
  const [visible, setVisible] = useState(30);

  useEffect(() => {
    setCart(getCompareCart());
    const h = () => setCart(getCompareCart());
    window.addEventListener("telead-compare", h);
    return () => window.removeEventListener("telead-compare", h);
  }, []);

  const sorted = useMemo(() => {
    const s = SORTS.find((x) => x.value === sort) ?? SORTS[0];
    return [...rows].sort((a, b) => s.fn(a) - s.fn(b));
  }, [rows, sort]);

  async function save(row: ResultRow) {
    setBusy("save" + row.channelId);
    const res = await fetch("/api/saved", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: row.channelId }) });
    if (res.ok) {
      setSavedSet((s) => new Set(s).add(row.channelId));
      toast("success", "Channel saved", `@${row.username} added to your saved database.`);
    } else toast("error", "Could not save channel");
    setBusy(null);
  }

  async function analyse(row: ResultRow) {
    setBusy("analyse" + row.channelId);
    const res = await fetch(`/api/channels/${row.channelId}/analyse`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      toast("success", "Analysis complete", `@${row.username} re-analysed.`);
      onAnalysed?.();
    } else toast("error", "Analysis failed", data.error);
    setBusy(null);
  }

  function toggleCompare(row: ResultRow) {
    let next = getCompareCart();
    if (next.includes(row.channelId)) next = next.filter((x) => x !== row.channelId);
    else if (next.length >= 10) { toast("error", "Compare limit reached", "You can compare up to 10 channels."); return; }
    else next.push(row.channelId);
    setCompareCart(next);
    toast("info", next.includes(row.channelId) ? "Added to comparison" : "Removed from comparison", `${next.length}/10 selected.`);
  }

  async function copyLink(row: ResultRow) {
    try {
      await navigator.clipboard.writeText(row.inviteUrl || `https://t.me/${row.username}`);
      toast("success", "Link copied", `https://t.me/${row.username}`);
    } catch {
      toast("error", "Clipboard unavailable");
    }
  }

  async function openCampaignModal(row: ResultRow) {
    setCampaignModal(row);
    setPrice("");
    const res = await fetch("/api/campaigns");
    const data = await res.json().catch(() => ({}));
    setCampaigns(data.campaigns ?? []);
    setCampaignId(data.campaigns?.[0]?.id ?? "");
  }

  async function submitCampaign() {
    if (!campaignModal || !campaignId) return;
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addChannel", channelId: campaignModal.channelId, price: price || 0 }),
    });
    if (res.ok) {
      toast("success", "Added to campaign", `@${campaignModal.username} attached.`);
      setCampaignModal(null);
    } else toast("error", "Could not add to campaign");
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <ArrowUpDown size={14} className="text-mint" /> {rows.length} channels
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={sort} onChange={(e) => setSort(e.target.value)} className={inputCls + " !w-auto !py-2 text-xs"}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {jobId && (
            <a href={`/api/discovery/${jobId}/export`} className={btnGhost + " !py-2 !px-3 text-xs"}>
              <Download size={13} /> CSV
            </a>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[10.5px] uppercase tracking-wider text-muted">
              <th className="px-5 py-3 font-semibold">Channel</th>
              <th className="px-3 py-3 font-semibold">Category</th>
              <th className="px-3 py-3 font-semibold text-right">Subscribers</th>
              <th className="px-3 py-3 font-semibold text-right">Avg Views</th>
              <th className="px-3 py-3 font-semibold text-right">ER</th>
              <th className="px-3 py-3 font-semibold text-right">Views %</th>
              <th className="px-3 py-3 font-semibold text-right">Posts/Day</th>
              <th className="px-3 py-3 font-semibold">Quality</th>
              <th className="px-3 py-3 font-semibold text-right">Ad Score</th>
              <th className="px-3 py-3 font-semibold">Last Active</th>
              <th className="px-5 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(0, visible).map((r) => (
              <tr key={r.channelId} className="border-b border-line/50 transition hover:bg-card2/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <ChannelAvatar title={r.title} size={32} />
                    <div className="min-w-0 max-w-[190px]">
                      <div className="flex items-center gap-1.5">
                        <Link href={`/channels/${r.channelId}`} className="truncate font-semibold hover:text-mint transition">{r.title}</Link>
                        {r.isDemo && <DemoBadge />}
                      </div>
                      <p className="truncate text-[11px] text-muted">@{r.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-muted">{r.category}</td>
                <td className="tabular px-3 py-3 text-right font-semibold">{fmtNum(r.subscribers)}</td>
                <td className="tabular px-3 py-3 text-right">{fmtNum(r.avgViews)}</td>
                <td className={cn("tabular px-3 py-3 text-right font-semibold", (r.engagementRate ?? 0) >= 1 ? "text-mint" : "text-muted")}>
                  {r.engagementRate != null ? `${r.engagementRate}%` : "—"}
                </td>
                <td className="tabular px-3 py-3 text-right text-muted">{r.viewsRate != null ? `${r.viewsRate}%` : "—"}</td>
                <td className="tabular px-3 py-3 text-right text-muted">{r.postingFrequency ?? "—"}</td>
                <td className="px-3 py-3"><QualityBadge score={r.qualityScore} /></td>
                <td className="px-3 py-3 text-right"><AdBadge score={r.adScore} /></td>
                <td className="px-3 py-3 text-xs text-muted">{timeAgo(r.lastActiveAt)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-0.5">
                    <Link href={`/channels/${r.channelId}`} title="View analytics" className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-mint transition"><ExternalLink size={14} /></Link>
                    <button title="Re-analyse" onClick={() => analyse(r)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-sky-400 transition">
                      {busy === "analyse" + r.channelId ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    </button>
                    <button title="Save channel" onClick={() => save(r)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-violet-400 transition">
                      {savedSet.has(r.channelId) ? <BookmarkCheck size={14} className="text-violet-400" /> : <Bookmark size={14} />}
                    </button>
                    <button title="Add to comparison" onClick={() => toggleCompare(r)} className={cn("rounded-lg p-2 transition", cart.includes(r.channelId) ? "text-mint bg-mint/10" : "text-muted hover:bg-card2 hover:text-mint")}>
                      <GitCompareArrows size={14} />
                    </button>
                    <button title="Copy invite link" onClick={() => copyLink(r)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-txt transition"><Copy size={14} /></button>
                    <button title="Add to campaign" onClick={() => openCampaignModal(r)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-amber-400 transition"><Megaphone size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sorted.length > visible && (
        <div className="border-t border-line px-5 py-3 text-center">
          <button onClick={() => setVisible((v) => v + 40)} className="text-xs font-semibold text-mint hover:underline">
            Show more ({sorted.length - visible} remaining)
          </button>
        </div>
      )}

      <Modal open={!!campaignModal} onClose={() => setCampaignModal(null)} title={`Add @${campaignModal?.username} to a campaign`}>
        {campaigns.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">You have no campaigns yet. Create one first.</p>
            <Link href="/campaigns" className={btnPrimary}>Go to Campaigns</Link>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Campaign">
              <select className={inputCls} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Negotiated placement price (optional)">
              <input className={inputCls} type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
            </Field>
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setCampaignModal(null)}><X size={14} /> Cancel</button>
              <button className={btnPrimary} onClick={submitCampaign}>Add channel</button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
