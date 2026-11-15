"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck, Database, Workflow, Send, Users, Radar, FileWarning, KeyRound,
  Loader2, Trash2, Save, Bot, ScrollText, Activity,
} from "lucide-react";
import { Card, SectionTitle, StatusBadge, Badge, Field, inputCls, btnPrimary, btnGhost, SkeletonRows } from "@/components/ui";
import { timeAgo, cn } from "@/lib/utils";
import { useToast } from "@/components/toaster";

const TABS = [
  { key: "system", label: "System", icon: Activity },
  { key: "users", label: "Users", icon: Users },
  { key: "telegram", label: "Telegram API", icon: Send },
  { key: "scoring", label: "Scoring & Providers", icon: Radar },
  { key: "logs", label: "System Logs", icon: ScrollText },
] as const;

type AdminData = {
  status: { database: string; queue: string; telegram: string; telegramUpdatedAt: string | null };
  stats: { users: number; channels: number; posts: number; discoveryJobs: number; analyses: number; errorLogs: number };
  users: { id: string; name: string; email: string; role: string; createdAt: string }[];
};

type AdminSettings = {
  weights: { relevance: number; views: number; engagement: number; consistency: number; recency: number; audience: number };
  providers: { mtproto: boolean; directory: boolean; demo: boolean };
  defaults: { periodDays: number };
  ai: { endpoint: string; model: string; apiKeySet: boolean };
};

type LogRow = { id: string; level: string; source: string; message: string; createdAt: string };

export default function AdminPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("system");
  const [data, setData] = useState<AdminData | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);

  // telegram form
  const [tg, setTg] = useState({ apiId: "", apiHash: "", sessionString: "", notes: "" });
  const [tgState, setTgState] = useState<{ configured: boolean; status: string; apiId: string; apiHashSet: boolean; sessionSet: boolean; instructions: string } | null>(null);
  // ai form
  const [ai, setAi] = useState({ endpoint: "", model: "gpt-4o-mini", apiKey: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin");
    if (res.status === 403) { setDenied(true); return; }
    const d = await res.json();
    if (d.ok) setData(d);
    const s = await fetch("/api/admin/settings");
    const sd = await s.json();
    if (sd.ok) {
      setSettings(sd);
      setAi({ endpoint: sd.ai.endpoint ?? "", model: sd.ai.model ?? "gpt-4o-mini", apiKey: "" });
    }
    const t = await fetch("/api/admin/telegram");
    const td = await t.json();
    if (td.ok) {
      setTgState(td.config);
      setTg((prev) => ({ ...prev, apiId: td.config.apiId ?? "" }));
    }
    const l = await fetch("/api/admin/logs");
    const ld = await l.json();
    if (ld.ok) setLogs(ld.logs);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveTelegram() {
    setBusy(true);
    const res = await fetch("/api/admin/telegram", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiId: tg.apiId, apiHash: tg.apiHash, sessionString: tg.sessionString, notes: tg.notes }),
    });
    const d = await res.json();
    setBusy(false);
    if (res.ok) {
      toast("success", "Telegram configuration saved", "Credentials are AES-256 encrypted at rest.");
      setTg((p) => ({ ...p, apiHash: "", sessionString: "" }));
      load();
    } else toast("error", "Save failed", d.error);
  }

  async function clearTelegram() {
    if (!window.confirm("Remove stored Telegram credentials?")) return;
    await fetch("/api/admin/telegram", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clear: true }) });
    toast("info", "Telegram credentials cleared");
    load();
  }

  async function saveWeights() {
    if (!settings) return;
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weights: settings.weights, defaults: settings.defaults }),
    });
    setBusy(false);
    if (res.ok) toast("success", "Scoring configuration saved");
  }

  async function toggleProvider(key: keyof AdminSettings["providers"]) {
    if (!settings) return;
    const next = { ...settings.providers, [key]: !settings.providers[key] };
    setSettings({ ...settings, providers: next });
    await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providers: next }) });
    toast("success", "Provider updated", `${key}: ${next[key] ? "enabled" : "disabled"}`);
  }

  async function saveAi() {
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ai: { endpoint: ai.endpoint, model: ai.model, apiKey: ai.apiKey || undefined } }),
    });
    setBusy(false);
    if (res.ok) { toast("success", "AI integration saved"); setAi((p) => ({ ...p, apiKey: "" })); load(); }
  }

  async function setRole(id: string, role: string) {
    const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast("success", "Role updated"); load(); }
    else toast("error", "Role change failed", d.error);
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Delete this user account? Their saved data will be removed.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { toast("info", "User deleted"); load(); }
    else toast("error", "Delete failed", d.error);
  }

  if (denied) {
    return (
      <Card className="py-16 text-center">
        <ShieldCheck size={28} className="mx-auto text-rose-400" />
        <p className="mt-3 font-bold">Administrator access required</p>
        <p className="mt-1 text-sm text-muted">Your account does not have the admin role.</p>
      </Card>
    );
  }
  if (!data) return <SkeletonRows n={6} height={80} />;

  const weightTotal = settings ? Object.values(settings.weights).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <ShieldCheck size={22} className="text-mint" /> Administration
        </h1>
        <p className="mt-1 text-sm text-muted">System health, users, providers, scoring engine and credentials.</p>
      </div>

      <div className="flex flex-wrap gap-1.5 rounded-xl border border-line bg-card p-1 w-fit">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition", tab === t.key ? "bg-mint/15 text-mint" : "text-muted hover:text-txt")}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {tab === "system" && (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Database</p>
                <Database size={15} className="text-sky-400" />
              </div>
              <div className="mt-2"><StatusBadge status={data.status.database === "connected" ? "completed" : "failed"} /></div>
              <p className="mt-2 text-[11px] text-muted">PostgreSQL via Drizzle ORM · transactions + constraints</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Job queue</p>
                <Workflow size={15} className="text-mint" />
              </div>
              <Badge tone="green" className="mt-2">Active</Badge>
              <p className="mt-2 text-[11px] text-muted leading-snug">{data.status.queue}</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Telegram API</p>
                <Send size={15} className="text-sky-400" />
              </div>
              <div className="mt-2"><StatusBadge status={data.status.telegram} /></div>
              <p className="mt-2 text-[11px] text-muted">{data.status.telegramUpdatedAt ? `Updated ${timeAgo(data.status.telegramUpdatedAt)}` : "Configure credentials in the Telegram tab."}</p>
            </Card>
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">Error logs</p>
                <FileWarning size={15} className={data.stats.errorLogs > 0 ? "text-rose-400" : "text-muted"} />
              </div>
              <p className="tabular mt-2 text-2xl font-extrabold">{data.stats.errorLogs}</p>
              <p className="mt-1 text-[11px] text-muted">Recorded error-level events</p>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {[
              { label: "Users", value: data.stats.users, icon: Users },
              { label: "Channels", value: data.stats.channels, icon: Radar },
              { label: "Posts analysed", value: data.stats.posts, icon: ScrollText },
              { label: "Discovery jobs", value: data.stats.discoveryJobs, icon: Workflow },
              { label: "Scored channels", value: data.stats.analyses, icon: Activity },
            ].map((s) => (
              <Card key={s.label} className="!p-4 text-center">
                <s.icon size={16} className="mx-auto text-mint" />
                <p className="tabular mt-2 text-xl font-extrabold">{s.value.toLocaleString()}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted">{s.label}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <SectionTitle title="User management" sub="Roles: admin has full platform control, user has workspace access" />
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10.5px] uppercase tracking-wider text-muted">
                <th className="px-5 py-3 font-semibold">User</th>
                <th className="px-3 py-3 font-semibold">Joined</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-line/50">
                  <td className="px-5 py-3">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-[11px] text-muted">{u.email}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted">{timeAgo(u.createdAt)}</td>
                  <td className="px-3 py-3">
                    <select value={u.role} onChange={(e) => setRole(u.id, e.target.value)} className={inputCls + " !w-28 !py-1.5 text-xs"}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => deleteUser(u.id)} className="rounded-lg p-2 text-muted hover:bg-card2 hover:text-rose-400" title="Delete user"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "telegram" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Telegram API credentials" sub="Stored with AES-256-GCM encryption. Never exposed to the frontend." right={tgState && <StatusBadge status={tgState.status} />} />
            <div className="space-y-4">
              <Field label="API ID" hint="Numeric app id from my.telegram.org">
                <input className={inputCls} value={tg.apiId} onChange={(e) => setTg({ ...tg, apiId: e.target.value })} placeholder="12345678" />
              </Field>
              <Field label="API Hash" hint={tgState?.apiHashSet ? "A hash is stored — enter a new one only to rotate it." : "32-character hash from my.telegram.org"}>
                <input className={inputCls} type="password" value={tg.apiHash} onChange={(e) => setTg({ ...tg, apiHash: e.target.value })} placeholder={tgState?.apiHashSet ? "••••••••••••••••" : "abcdef1234567890…"} />
              </Field>
              <Field label="Session string (Telethon StringSession)" hint={tgState?.sessionSet ? "A session is stored — enter a new one only to rotate it." : "Generate with workers/telethon_worker.py"}>
                <textarea className={inputCls + " min-h-[70px] resize-y font-mono text-xs"} value={tg.sessionString} onChange={(e) => setTg({ ...tg, sessionString: e.target.value })} placeholder={tgState?.sessionSet ? "•••••• stored ••••••" : "1BQAAAA…"} />
              </Field>
              <Field label="Internal notes"><input className={inputCls} value={tg.notes} onChange={(e) => setTg({ ...tg, notes: e.target.value })} placeholder="Production account — +1 555…" /></Field>
              <div className="flex gap-2">
                <button onClick={saveTelegram} disabled={busy} className={btnPrimary}>
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save credentials
                </button>
                {tgState?.configured && <button onClick={clearTelegram} className={btnGhost + " !text-rose-300"}>Remove</button>}
              </div>
            </div>
          </Card>
          <Card>
            <SectionTitle title="How to obtain credentials" sub="Official path — no scraping tricks required" />
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-muted">
              <li>Sign in at <span className="font-mono text-xs text-sky-300">my.telegram.org</span> → <b className="text-txt">API development tools</b>.</li>
              <li>Create an application to receive your <b className="text-txt">api_id</b> and <b className="text-txt">api_hash</b>.</li>
              <li>Run the bundled Telethon worker once (<span className="font-mono text-xs text-sky-300">workers/telethon_worker.py</span>) to sign in and print a <b className="text-txt">StringSession</b>.</li>
              <li>Paste the values here. All scraping then respects Telegram rate limits with FloodWait handling, retries and throttling.</li>
            </ol>
            <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3.5 text-xs leading-relaxed text-amber-200/90">
              <b>Honest limitation.</b> Telegram does not offer unrestricted global keyword search on the public web.
              Live keyword discovery uses MTProto search plus directory sources; private channels and private groups
              are never accessed.
            </div>
          </Card>
        </div>
      )}

      {tab === "scoring" && settings && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <SectionTitle title="Advertising score weights" sub={`Total: ${weightTotal} points (recommended 100)`} />
            <div className="space-y-4">
              {(Object.keys(settings.weights) as (keyof AdminSettings["weights"])[]).map((k) => (
                <div key={k}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold capitalize">{k}</span>
                    <span className="tabular font-bold text-mint">{settings.weights[k]} pts</span>
                  </div>
                  <input
                    type="range" min={0} max={60} value={settings.weights[k]}
                    onChange={(e) => setSettings({ ...settings, weights: { ...settings.weights, [k]: Number(e.target.value) } })}
                    className="w-full accent-emerald-400"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Default analysis window">
                  <select className={inputCls} value={settings.defaults.periodDays} onChange={(e) => setSettings({ ...settings, defaults: { periodDays: Number(e.target.value) } })}>
                    {[7, 14, 30, 60, 90].map((p) => <option key={p} value={p}>{p} days</option>)}
                  </select>
                </Field>
              </div>
              <button onClick={saveWeights} disabled={busy} className={btnPrimary}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save scoring config
              </button>
            </div>
          </Card>

          <div className="space-y-5">
            <Card>
              <SectionTitle title="Discovery providers" sub="Modular pipeline — enable or disable each source" />
              <div className="space-y-2.5">
                {([
                  ["mtproto", "Telegram Global Search (MTProto)", "Official API search via Telethon session."],
                  ["directory", "Public Directory & Search-Engine Scan", "Discovers t.me links indexed by search engines."],
                  ["demo", "Sample Corpus Provider", "Deterministic demonstration dataset, clearly flagged in the UI."],
                ] as [keyof AdminSettings["providers"], string, string][]).map(([key, label, desc]) => (
                  <button key={key} onClick={() => toggleProvider(key)} className="flex w-full items-center gap-3 rounded-xl border border-line bg-card2/60 px-4 py-3 text-left transition hover:border-linestrong">
                    <div className={cn("h-5 w-9 rounded-full p-0.5 transition", settings.providers[key] ? "bg-mint" : "bg-muted/30")}>
                      <div className={cn("h-4 w-4 rounded-full bg-white transition-transform", settings.providers[key] && "translate-x-4")} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-[11px] text-muted">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle title="AI recommendation integration" sub="Optional OpenAI-compatible endpoint used by the Compare engine's narrative" />
              <div className="space-y-3.5">
                <Field label="API base URL" hint="e.g. https://api.openai.com/v1">
                  <input className={inputCls} value={ai.endpoint} onChange={(e) => setAi({ ...ai, endpoint: e.target.value })} placeholder="https://api.openai.com/v1" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Model"><input className={inputCls} value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} /></Field>
                  <Field label="API key" hint={settings.ai.apiKeySet ? "A key is stored — enter to rotate." : "Stored encrypted, used server-side only."}>
                    <input className={inputCls} type="password" value={ai.apiKey} onChange={(e) => setAi({ ...ai, apiKey: e.target.value })} placeholder={settings.ai.apiKeySet ? "••••••••" : "sk-…"} />
                  </Field>
                </div>
                <button onClick={saveAi} disabled={busy} className={btnPrimary}>
                  <Bot size={14} /> Save AI settings
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <SectionTitle title="System logs" sub="Discovery, analysis and admin events" />
            <button onClick={load} className={btnGhost + " !py-1.5 !px-3 text-xs"}>Refresh</button>
          </div>
          <div className="max-h-[520px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 && <p className="px-5 py-8 text-center text-muted">No log entries yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="flex items-start gap-3 border-b border-line/40 px-5 py-2.5 last:border-0">
                <span className={cn(
                  "mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full",
                  l.level === "error" ? "bg-rose-400" : l.level === "warn" ? "bg-amber-400" : "bg-mint"
                )} />
                <span className="w-36 shrink-0 text-muted">{new Date(l.createdAt).toLocaleString()}</span>
                <Badge tone="muted" className="shrink-0">{l.source}</Badge>
                <span className="text-muted leading-relaxed">{l.message}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "system" && (
        <Card>
          <SectionTitle title="Platform notes" />
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted">
            <li>Background jobs run on the built-in in-process runner. On a VPS you can point the same job table at Celery/Redis workers — the schema is already worker-compatible.</li>
            <li>API usage, failed jobs and Telegram FloodWait events surface in <b className="text-txt">System Logs</b>.</li>
            <li>New providers plug into <span className="font-mono text-xs text-sky-300">src/lib/discovery.ts</span> without touching the rest of the pipeline.</li>
          </ul>
        </Card>
      )}
    </div>
  );
}
