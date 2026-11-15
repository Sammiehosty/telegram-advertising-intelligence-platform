"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Plus, Trash2, Loader2, Coins, Calculator, X, Users } from "lucide-react";
import { Card, SectionTitle, StatusBadge, EmptyState, SkeletonRows, ChannelAvatar, Modal, Field, inputCls, btnPrimary, btnGhost, Badge } from "@/components/ui";
import { fmtNum, fmtMoney, AD_FORMATS, cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

type Campaign = {
  id: string; name: string; product: string; targetKeywords: string[]; budgetCents: number;
  currency: string; startDate: string; endDate: string; status: string; notes: string;
  spendCents: number; expectedViews: number; actualViews: number; clicks: number;
  conversions: number; createdAt: string; channelCount: number;
};

type Price = {
  id: string; channelName: string; username: string; contactName: string; contactUsername: string;
  priceCents: number; currency: string; duration: string; format: string;
  expectedViews: number | null; actualViews: number | null; campaignDate: string; results: string;
};

type CampaignChannel = { id: string; channelId: string; priceCents: number; title: string; username: string; subscribers: number; avgViews: number | null; adScore: number | null };

export default function CampaignsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"campaigns" | "prices">("campaigns");
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [prices, setPrices] = useState<Price[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [priceOpen, setPriceOpen] = useState(false);
  const [detail, setDetail] = useState<Campaign | null>(null);
  const [detailChannels, setDetailChannels] = useState<CampaignChannel[]>([]);
  const [busy, setBusy] = useState(false);

  // create form
  const [form, setForm] = useState({ name: "", product: "", keywords: "", budget: "", currency: "USD", startDate: "", endDate: "", notes: "" });
  const [pf, setPf] = useState({ channelName: "", username: "", contactName: "", contactUsername: "", price: "", currency: "USD", duration: "24h", format: "sponsored_post", expectedViews: "", actualViews: "", campaignDate: "", results: "" });
  // metrics edit
  const [metrics, setMetrics] = useState({ spend: "", expectedViews: "", actualViews: "", clicks: "", conversions: "", status: "draft" });

  const load = useCallback(async () => {
    const [c, p] = await Promise.all([fetch("/api/campaigns"), fetch("/api/prices")]);
    const cd = await c.json(); const pd = await p.json();
    if (cd.ok) setCampaigns(cd.campaigns);
    if (pd.ok) setPrices(pd.prices);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function createCampaign() {
    if (!form.name.trim()) { toast("error", "Campaign name required"); return; }
    setBusy(true);
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, product: form.product, targetKeywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean), budget: form.budget || 0, currency: form.currency, startDate: form.startDate, endDate: form.endDate, notes: form.notes }),
    });
    setBusy(false);
    if (res.ok) { toast("success", "Campaign created"); setCreateOpen(false); setForm({ name: "", product: "", keywords: "", budget: "", currency: "USD", startDate: "", endDate: "", notes: "" }); load(); }
    else toast("error", "Could not create campaign");
  }

  async function addPrice() {
    if (!pf.channelName.trim()) { toast("error", "Channel name required"); return; }
    setBusy(true);
    const res = await fetch("/api/prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pf) });
    setBusy(false);
    if (res.ok) { toast("success", "Price entry recorded"); setPriceOpen(false); setPf({ channelName: "", username: "", contactName: "", contactUsername: "", price: "", currency: "USD", duration: "24h", format: "sponsored_post", expectedViews: "", actualViews: "", campaignDate: "", results: "" }); load(); }
    else toast("error", "Could not save entry");
  }

  async function openDetail(c: Campaign) {
    setDetail(c);
    setMetrics({
      spend: (c.spendCents / 100).toString(), expectedViews: String(c.expectedViews),
      actualViews: String(c.actualViews), clicks: String(c.clicks), conversions: String(c.conversions), status: c.status,
    });
    const res = await fetch(`/api/campaigns/${c.id}`);
    const data = await res.json();
    if (data.ok) setDetailChannels(data.channels);
  }

  async function saveMetrics() {
    if (!detail) return;
    setBusy(true);
    const res = await fetch(`/api/campaigns/${detail.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spend: metrics.spend, expectedViews: metrics.expectedViews, actualViews: metrics.actualViews, clicks: metrics.clicks, conversions: metrics.conversions, status: metrics.status }),
    });
    setBusy(false);
    if (res.ok) { toast("success", "Campaign updated"); load(); openDetail({ ...detail }); }
  }

  async function removeChannel(channelId: string) {
    if (!detail) return;
    await fetch(`/api/campaigns/${detail.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "removeChannel", channelId }) });
    openDetail(detail);
  }

  async function deleteCampaign() {
    if (!detail) return;
    await fetch(`/api/campaigns/${detail.id}`, { method: "DELETE" });
    toast("info", "Campaign deleted");
    setDetail(null);
    load();
  }

  async function deletePrice(id: string) {
    await fetch(`/api/prices?id=${id}`, { method: "DELETE" });
    toast("info", "Entry removed");
    load();
  }

  const spend = parseFloat(metrics.spend) || 0;
  const views = parseInt(metrics.actualViews) || 0;
  const clicksN = parseInt(metrics.clicks) || 0;
  const conv = parseInt(metrics.conversions) || 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
            <Megaphone size={22} className="text-mint" /> Advertising Campaigns
          </h1>
          <p className="mt-1 text-sm text-muted">Plan placements, track spend vs. performance, and research market ad prices.</p>
        </div>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={() => setPriceOpen(true)}><Coins size={15} /> Record ad price</button>
          <button className={btnPrimary} onClick={() => setCreateOpen(true)}><Plus size={15} /> New campaign</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-line bg-card p-1 w-fit">
        {([["campaigns", "Campaigns"], ["prices", "Ad Price Tracker"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("rounded-lg px-4 py-2 text-xs font-bold transition", tab === k ? "bg-mint/15 text-mint" : "text-muted hover:text-txt")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "campaigns" && (
        <>
          {!campaigns && <SkeletonRows n={3} height={110} />}
          {campaigns && campaigns.length === 0 && (
            <EmptyState title="No campaigns yet" body="Create a campaign, attach channels from discovery results, and track planned vs. actual performance." action={<button className={btnPrimary} onClick={() => setCreateOpen(true)}>Create campaign</button>} />
          )}
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {campaigns?.map((c) => {
              const budgetUsed = c.budgetCents > 0 ? Math.min(100, (c.spendCents / c.budgetCents) * 100) : 0;
              const cpm = c.actualViews > 0 ? c.spendCents / 100 / (c.actualViews / 1000) : null;
              return (
                <button key={c.id} onClick={() => openDetail(c)} className="text-left">
                  <Card className="h-full transition hover:border-mint/30">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold">{c.name}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted">{c.product || "—"}</p>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted">
                        <span>Budget</span>
                        <span className="tabular font-semibold text-txt">{fmtMoney(c.spendCents, c.currency)} / {fmtMoney(c.budgetCents, c.currency)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-card2">
                        <div className={cn("h-full rounded-full", budgetUsed > 90 ? "bg-rose-400" : "bg-mint")} style={{ width: `${budgetUsed}%` }} />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-card2 py-2"><p className="tabular text-sm font-extrabold">{c.channelCount}</p><p className="text-[9px] uppercase text-muted">Channels</p></div>
                        <div className="rounded-lg bg-card2 py-2"><p className="tabular text-sm font-extrabold">{fmtNum(c.actualViews)}</p><p className="text-[9px] uppercase text-muted">Views</p></div>
                        <div className="rounded-lg bg-card2 py-2"><p className="tabular text-sm font-extrabold">{cpm != null ? `$${cpm.toFixed(2)}` : "—"}</p><p className="text-[9px] uppercase text-muted">CPM</p></div>
                      </div>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </>
      )}

      {tab === "prices" && (
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionTitle title="Advertising price research" sub="Manually recorded marketplace data. CPM = cost / expected views × 1000." />
          </div>
          {!prices && <div className="p-5"><SkeletonRows n={3} /></div>}
          {prices && prices.length === 0 && (
            <div className="p-6"><EmptyState title="No price entries" body="Record quotes from channel admins to compare CPM across your market." /></div>
          )}
          {prices && prices.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[10.5px] uppercase tracking-wider text-muted">
                    <th className="px-5 py-3 font-semibold">Channel</th>
                    <th className="px-3 py-3 font-semibold">Format</th>
                    <th className="px-3 py-3 font-semibold">Duration</th>
                    <th className="px-3 py-3 font-semibold text-right">Price</th>
                    <th className="px-3 py-3 font-semibold text-right">Expected views</th>
                    <th className="px-3 py-3 font-semibold text-right">Actual views</th>
                    <th className="px-3 py-3 font-semibold text-right">CPM (expected)</th>
                    <th className="px-3 py-3 font-semibold text-right">CPM (actual)</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => {
                    const cpmE = p.expectedViews && p.expectedViews > 0 ? (p.priceCents / 100) / (p.expectedViews / 1000) : null;
                    const cpmA = p.actualViews && p.actualViews > 0 ? (p.priceCents / 100) / (p.actualViews / 1000) : null;
                    return (
                      <tr key={p.id} className="border-b border-line/50 hover:bg-card2/40">
                        <td className="px-5 py-3">
                          <p className="font-semibold">{p.channelName}</p>
                          <p className="text-[11px] text-muted">{p.username ? `@${p.username}` : "—"} {p.contactUsername && `· contact @${p.contactUsername}`}</p>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted">{AD_FORMATS.find((f) => f.value === p.format)?.label ?? p.format}</td>
                        <td className="px-3 py-3 text-xs text-muted">{p.duration}</td>
                        <td className="tabular px-3 py-3 text-right font-semibold text-mint">{fmtMoney(p.priceCents, p.currency)}</td>
                        <td className="tabular px-3 py-3 text-right text-muted">{fmtNum(p.expectedViews)}</td>
                        <td className="tabular px-3 py-3 text-right text-muted">{fmtNum(p.actualViews)}</td>
                        <td className="tabular px-3 py-3 text-right font-semibold">{cpmE != null ? `$${cpmE.toFixed(2)}` : "—"}</td>
                        <td className="tabular px-3 py-3 text-right font-semibold">{cpmA != null ? `$${cpmA.toFixed(2)}` : "—"}</td>
                        <td className="px-5 py-3 text-right">
                          <button onClick={() => deletePrice(p.id)} className="rounded-lg p-2 text-muted hover:text-rose-400 hover:bg-card2"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Create campaign modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create campaign" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Campaign name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q3 Forex Course Launch" /></Field>
          <Field label="Product or service"><input className={inputCls} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="Online Forex Trading Course" /></Field>
          <Field label="Target keywords (comma separated)"><input className={inputCls} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="forex, trading, pips" /></Field>
          <Field label="Budget">
            <div className="flex gap-2">
              <input className={inputCls} type="number" min={0} step="0.01" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="100.00" />
              <select className={inputCls + " !w-28"} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {["USD", "EUR", "GBP", "USDT", "TON"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Start date"><input className={inputCls} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="End date"><input className={inputCls} type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>
        <div className="mt-4">
          <Field label="Notes"><textarea className={inputCls + " min-h-[70px] resize-y"} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setCreateOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={createCampaign} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Create</button>
        </div>
      </Modal>

      {/* Price modal */}
      <Modal open={priceOpen} onClose={() => setPriceOpen(false)} title="Record advertising price" wide>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Channel name *"><input className={inputCls} value={pf.channelName} onChange={(e) => setPf({ ...pf, channelName: e.target.value })} /></Field>
          <Field label="Channel username"><input className={inputCls} value={pf.username} onChange={(e) => setPf({ ...pf, username: e.target.value })} placeholder="cryptohub" /></Field>
          <Field label="Contact name"><input className={inputCls} value={pf.contactName} onChange={(e) => setPf({ ...pf, contactName: e.target.value })} /></Field>
          <Field label="Contact username"><input className={inputCls} value={pf.contactUsername} onChange={(e) => setPf({ ...pf, contactUsername: e.target.value })} placeholder="adsmanager" /></Field>
          <Field label="Price">
            <div className="flex gap-2">
              <input className={inputCls} type="number" min={0} step="0.01" value={pf.price} onChange={(e) => setPf({ ...pf, price: e.target.value })} />
              <select className={inputCls + " !w-28"} value={pf.currency} onChange={(e) => setPf({ ...pf, currency: e.target.value })}>
                {["USD", "EUR", "GBP", "USDT", "TON"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </Field>
          <Field label="Ad format">
            <select className={inputCls} value={pf.format} onChange={(e) => setPf({ ...pf, format: e.target.value })}>
              {AD_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Duration"><input className={inputCls} value={pf.duration} onChange={(e) => setPf({ ...pf, duration: e.target.value })} placeholder="24h / 48h / permanent" /></Field>
          <Field label="Campaign date"><input className={inputCls} type="date" value={pf.campaignDate} onChange={(e) => setPf({ ...pf, campaignDate: e.target.value })} /></Field>
          <Field label="Expected views"><input className={inputCls} type="number" min={0} value={pf.expectedViews} onChange={(e) => setPf({ ...pf, expectedViews: e.target.value })} /></Field>
          <Field label="Actual views"><input className={inputCls} type="number" min={0} value={pf.actualViews} onChange={(e) => setPf({ ...pf, actualViews: e.target.value })} /></Field>
        </div>
        <div className="mt-4">
          <Field label="Campaign results / notes"><textarea className={inputCls + " min-h-[70px] resize-y"} value={pf.results} onChange={(e) => setPf({ ...pf, results: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setPriceOpen(false)}>Cancel</button>
          <button className={btnPrimary} onClick={addPrice} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />} Save entry</button>
        </div>
      </Modal>

      {/* Campaign detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? "Campaign"} wide>
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={detail.status} />
              {detail.targetKeywords.map((k) => <Badge key={k} tone="sky">#{k}</Badge>)}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "CPM (actual)", value: views > 0 ? `$${(spend / (views / 1000)).toFixed(2)}` : "—" },
                { label: "Cost per click", value: clicksN > 0 ? `$${(spend / clicksN).toFixed(2)}` : "—" },
                { label: "Cost / acquisition", value: conv > 0 ? `$${(spend / conv).toFixed(2)}` : "—" },
                { label: "Budget used", value: detail.budgetCents > 0 ? `${Math.round((parseFloat(metrics.spend || "0") * 100 / detail.budgetCents) * 100)}%` : "—" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-line bg-card2 p-3 text-center">
                  <p className="tabular text-lg font-extrabold text-mint">{m.value}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted">{m.label}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted"><Calculator size={13} className="text-mint" /> Performance tracking</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label={`Spend (${detail.currency})`}><input className={inputCls} type="number" min={0} step="0.01" value={metrics.spend} onChange={(e) => setMetrics({ ...metrics, spend: e.target.value })} /></Field>
                <Field label="Expected views"><input className={inputCls} type="number" min={0} value={metrics.expectedViews} onChange={(e) => setMetrics({ ...metrics, expectedViews: e.target.value })} /></Field>
                <Field label="Actual views"><input className={inputCls} type="number" min={0} value={metrics.actualViews} onChange={(e) => setMetrics({ ...metrics, actualViews: e.target.value })} /></Field>
                <Field label="Clicks"><input className={inputCls} type="number" min={0} value={metrics.clicks} onChange={(e) => setMetrics({ ...metrics, clicks: e.target.value })} /></Field>
                <Field label="Conversions"><input className={inputCls} type="number" min={0} value={metrics.conversions} onChange={(e) => setMetrics({ ...metrics, conversions: e.target.value })} /></Field>
                <Field label="Status">
                  <select className={inputCls} value={metrics.status} onChange={(e) => setMetrics({ ...metrics, status: e.target.value })}>
                    {["draft", "active", "paused", "completed"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <button onClick={saveMetrics} disabled={busy} className={btnPrimary + " mt-3"}>{busy && <Loader2 size={14} className="animate-spin" />} Save metrics</button>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted"><Users size={13} className="text-mint" /> Attached channels ({detailChannels.length})</p>
              {detailChannels.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line-strong p-4 text-center text-xs text-muted">
                  No channels attached. Use the megaphone action on any result row to add one.
                </p>
              ) : (
                <div className="space-y-2">
                  {detailChannels.map((ch) => (
                    <div key={ch.id} className="flex items-center gap-3 rounded-xl border border-line bg-card2/60 px-3.5 py-2.5">
                      <ChannelAvatar title={ch.title} size={30} />
                      <div className="min-w-0 flex-1">
                        <Link href={`/channels/${ch.channelId}`} className="text-xs font-bold hover:text-mint">{ch.title}</Link>
                        <p className="text-[11px] text-muted">@{ch.username} · {fmtNum(ch.subscribers)} subs · {fmtNum(ch.avgViews)} avg views</p>
                      </div>
                      {ch.priceCents > 0 && <Badge tone="green">{fmtMoney(ch.priceCents, detail.currency)}</Badge>}
                      <button onClick={() => removeChannel(ch.channelId)} className="rounded-lg p-1.5 text-muted hover:text-rose-400" title="Remove"><X size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-between border-t border-line pt-4">
              <button onClick={deleteCampaign} className="text-xs font-semibold text-rose-400 hover:underline">Delete campaign</button>
              <button className={btnGhost} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
