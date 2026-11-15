"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bookmark, FolderPlus, Search, Trash2, PencilLine, CheckCircle2, Send,
  PhoneCall, BadgeCheck, Timer, Loader2,
} from "lucide-react";
import { Card, EmptyState, SkeletonRows, ChannelAvatar, QualityBadge, AdBadge, DemoBadge, Badge, Modal, Field, inputCls, btnPrimary, btnGhost } from "@/components/ui";
import { fmtNum, timeAgo, cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

type SavedRow = {
  id: string; channelId: string; folderId: string | null; tags: string[]; notes: string;
  adPriceCents: number | null; currency: string; contactUsername: string | null;
  contacted: boolean; verified: boolean; monitorInterval: string; createdAt: string;
  title: string; username: string; category: string; subscribers: number; inviteUrl: string;
  isDemo: boolean; avgViews: number | null; engagementRate: number | null;
  qualityScore: number | null; adScore: number | null;
};

type Folder = { id: string; name: string };

const MONITOR_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "24h", label: "Every 24h" },
  { value: "3d", label: "Every 3 days" },
  { value: "7d", label: "Weekly" },
  { value: "manual", label: "Manual" },
];

export default function SavedPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<SavedRow[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [filterFolder, setFilterFolder] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<SavedRow | null>(null);
  const [busy, setBusy] = useState(false);

  // edit form state
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [adPrice, setAdPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [contact, setContact] = useState("");
  const [folderId, setFolderId] = useState("");
  const [monitor, setMonitor] = useState("off");

  const load = useCallback(async () => {
    const res = await fetch("/api/saved");
    const data = await res.json();
    if (data.ok) {
      setRows(data.saved);
      setFolders(data.folders);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = (rows ?? []).filter((r) => {
    if (filterFolder && r.folderId !== filterFolder) return false;
    if (query && !r.title.toLowerCase().includes(query.toLowerCase()) && !r.username.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  async function addFolder() {
    const name = window.prompt("Folder name:");
    if (!name?.trim()) return;
    const res = await fetch("/api/folders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    if (res.ok) { toast("success", "Folder created"); load(); }
  }

  function openEdit(r: SavedRow) {
    setEditing(r);
    setNotes(r.notes);
    setTags(r.tags.join(", "));
    setAdPrice(r.adPriceCents != null ? (r.adPriceCents / 100).toString() : "");
    setCurrency(r.currency);
    setContact(r.contactUsername ?? "");
    setFolderId(r.folderId ?? "");
    setMonitor(r.monitorInterval);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const res = await fetch(`/api/saved/${editing.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notes,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        adPrice: adPrice || null,
        currency,
        contactUsername: contact,
        folderId: folderId || null,
        monitorInterval: monitor,
      }),
    });
    setBusy(false);
    if (res.ok) {
      toast("success", "Saved channel updated");
      setEditing(null);
      load();
    } else toast("error", "Update failed");
  }

  async function toggleFlag(r: SavedRow, key: "contacted" | "verified") {
    await fetch(`/api/saved/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: !r[key] }),
    });
    load();
  }

  async function remove(r: SavedRow) {
    await fetch(`/api/saved/${r.id}`, { method: "DELETE" });
    toast("info", "Removed", `@${r.username} removed from saved channels.`);
    load();
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <Bookmark size={22} className="text-mint" /> Saved Channels
          </h1>
          <p className="mt-1 text-sm text-muted">Your personal channel database — notes, prices, contacts and monitoring.</p>
        </div>
        <button onClick={addFolder} className={btnGhost}>
          <FolderPlus size={15} /> New folder
        </button>
      </div>

      <Card className="!p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setFilterFolder("")} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", !filterFolder ? "border-mint/50 bg-mint/10 text-mint" : "border-line text-muted hover:text-txt")}>
            All ({(rows ?? []).length})
          </button>
          {folders.map((f) => (
            <button key={f.id} onClick={() => setFilterFolder(f.id === filterFolder ? "" : f.id)} className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold transition", filterFolder === f.id ? "border-mint/50 bg-mint/10 text-mint" : "border-line text-muted hover:text-txt")}>
              {f.name}
            </button>
          ))}
          <div className="relative ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={inputCls + " !w-56 !py-2 text-xs"} style={{ paddingLeft: 32 }} placeholder="Search saved…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
      </Card>

      {!rows && <SkeletonRows n={4} height={96} />}
      {rows && filtered.length === 0 && (
        <EmptyState
          title="No saved channels"
          body="Save promising channels from discovery results to build your media-buying shortlist."
          action={<Link href="/discover" className={btnPrimary}>Discover channels</Link>}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((r) => (
          <Card key={r.id} className="transition hover:border-linestrong">
            <div className="flex items-start gap-3">
              <Link href={`/channels/${r.channelId}`}>
                <ChannelAvatar title={r.title} size={44} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/channels/${r.channelId}`} className="font-bold hover:text-mint transition">{r.title}</Link>
                  {r.isDemo && <DemoBadge />}
                  {r.verified && <Badge tone="sky"><BadgeCheck size={11} /> Verified</Badge>}
                  {r.contacted && <Badge tone="violet" className="bg-violet-400/10 text-violet-300 border-violet-400/25"><PhoneCall size={11} /> Contacted</Badge>}
                </div>
                <p className="text-xs text-muted">@{r.username} · {r.category} · {fmtNum(r.subscribers)} subs</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(r)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-mint transition" title="Edit details"><PencilLine size={15} /></button>
                <button onClick={() => remove(r)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-rose-400 transition" title="Remove"><Trash2 size={15} /></button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <QualityBadge score={r.qualityScore} />
              <AdBadge score={r.adScore} />
              {r.tags.map((t) => <Badge key={t} tone="sky">#{t}</Badge>)}
            </div>

            {r.notes && <p className="mt-3 rounded-lg bg-card2 p-3 text-xs leading-relaxed text-muted line-clamp-3">{r.notes}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line/60 pt-3 text-[11px] text-muted">
              <span className="tabular">Avg views: <b className="text-txt">{fmtNum(r.avgViews)}</b></span>
              <span className="tabular">ER: <b className="text-txt">{r.engagementRate != null ? `${r.engagementRate}%` : "—"}</b></span>
              {r.adPriceCents != null && <span>Quoted: <b className="text-mint">{(r.adPriceCents / 100).toFixed(2)} {r.currency}</b></span>}
              {r.contactUsername && (
                <a href={`https://t.me/${r.contactUsername}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:underline">
                  <Send size={10} /> @{r.contactUsername}
                </a>
              )}
              <span className="inline-flex items-center gap-1 ml-auto"><Timer size={11} /> Monitor: {MONITOR_OPTIONS.find((m) => m.value === r.monitorInterval)?.label}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <button onClick={() => toggleFlag(r, "contacted")} className={btnGhost + " !py-1.5 !px-3 text-[11px] flex-1"}>
                <PhoneCall size={12} /> {r.contacted ? "Contacted" : "Mark contacted"}
              </button>
              <button onClick={() => toggleFlag(r, "verified")} className={btnGhost + " !py-1.5 !px-3 text-[11px] flex-1"}>
                <CheckCircle2 size={12} /> {r.verified ? "Verified" : "Mark verified"}
              </button>
            </div>
          </Card>
        ))}
      </div>

      {/* Edit modal */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit @${editing?.username}`} wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Folder">
            <select className={inputCls} value={folderId} onChange={(e) => setFolderId(e.target.value)}>
              <option value="">No folder</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="Tags (comma separated)">
            <input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="crypto, tier-1, cheap" />
          </Field>
          <Field label="Quoted ad price">
            <input className={inputCls} type="number" min={0} step="0.01" value={adPrice} onChange={(e) => setAdPrice(e.target.value)} placeholder="150.00" />
          </Field>
          <Field label="Currency">
            <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["USD", "EUR", "GBP", "USDT", "TON"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Advertising contact (Telegram username)">
            <input className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="channel_admin" />
          </Field>
          <Field label="Monitoring interval" hint="Periodic re-analysis with drift alerts.">
            <select className={inputCls} value={monitor} onChange={(e) => setMonitor(e.target.value)}>
              {MONITOR_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Personal notes">
            <textarea className={inputCls + " min-h-[90px] resize-y"} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Negotiation status, audience observations, test results…" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setEditing(null)}>Cancel</button>
          <button className={btnPrimary} onClick={saveEdit} disabled={busy}>
            {busy && <Loader2 size={14} className="animate-spin" />} Save changes
          </button>
        </div>
      </Modal>
    </div>
  );
}
