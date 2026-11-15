"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Settings as SettingsIcon, KeyRound, User2, Palette, Loader2, Sun, Moon } from "lucide-react";
import { Card, SectionTitle, Field, inputCls, btnPrimary } from "@/components/ui";
import { useToast } from "@/components/toaster";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { toast } = useToast();
  const [me, setMe] = useState<{ name: string; email: string; role: string } | null>(null);
  const [name, setName] = useState("");
  const [period, setPeriod] = useState(30);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d.ok) { setMe(d.user); setName(d.user.name); }
    });
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.ok) setPeriod(d.prefs.defaultPeriodDays ?? 30);
    });
    setTheme(document.documentElement.classList.contains("light") ? "light" : "dark");
  }, []);

  async function saveProfile() {
    setBusy(true);
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "name", name }) });
    setBusy(false);
    if (res.ok) toast("success", "Profile updated");
    else toast("error", (await res.json()).error ?? "Update failed");
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.confirm) { toast("error", "Passwords do not match"); return; }
    setBusy(true);
    const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "password", current: pw.current, next: pw.next }) });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      toast("success", "Password changed");
      setPw({ current: "", next: "", confirm: "" });
    } else toast("error", data.error ?? "Failed");
  }

  async function applyTheme(t: "dark" | "light") {
    setTheme(t);
    localStorage.setItem("telead-theme", t);
    document.documentElement.classList.toggle("dark", t === "dark");
    document.documentElement.classList.toggle("light", t === "light");
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prefs", theme: t }) });
  }

  async function savePeriod(p: number) {
    setPeriod(p);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "prefs", defaultPeriodDays: p }) });
    toast("success", "Default analysis period saved", `${p} days`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-up">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight">
          <SettingsIcon size={22} className="text-mint" /> Settings
        </h1>
        <p className="mt-1 text-sm text-muted">Account, security and analysis preferences.</p>
      </div>

      <Card>
        <SectionTitle title="Profile" sub="How teammates see you" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name">
            <div className="relative">
              <User2 size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input className={inputCls} style={{ paddingLeft: 36 }} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </Field>
          <Field label="Email" hint="Email is your login identifier and cannot be changed here.">
            <input className={inputCls + " opacity-60"} value={me?.email ?? ""} disabled />
          </Field>
        </div>
        <button onClick={saveProfile} disabled={busy} className={btnPrimary + " mt-4"}>
          {busy && <Loader2 size={14} className="animate-spin" />} Save profile
        </button>
      </Card>

      <Card>
        <SectionTitle title="Appearance" sub="Dark mode is the default experience" />
        <div className="flex gap-2">
          {(["dark", "light"] as const).map((t) => (
            <button key={t} onClick={() => applyTheme(t)} className={cn(
              "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition",
              theme === t ? "border-mint/50 bg-mint/10 text-mint" : "border-line bg-card2 text-muted hover:text-txt"
            )}>
              {t === "dark" ? <Moon size={15} /> : <Sun size={15} />} {t === "dark" ? "Dark" : "Light"}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Analysis defaults" sub="Used when running quick re-analysis" />
        <Field label="Default analysis period">
          <div className="flex gap-2">
            {[7, 14, 30, 60, 90].map((p) => (
              <button key={p} onClick={() => savePeriod(p)} className={cn(
                "rounded-xl border px-4 py-2.5 text-sm font-bold transition",
                period === p ? "border-mint/50 bg-mint/10 text-mint" : "border-line bg-card2 text-muted hover:text-txt"
              )}>
                {p}d
              </button>
            ))}
          </div>
        </Field>
      </Card>

      <Card>
        <SectionTitle title="Change password" sub="Min. 8 characters. Sessions stay active on other devices." />
        <form onSubmit={changePassword} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Current password">
              <input className={inputCls} type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" />
            </Field>
            <Field label="New password">
              <input className={inputCls} type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required minLength={8} autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password">
              <input className={inputCls} type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required minLength={8} autoComplete="new-password" />
            </Field>
          </div>
          <button className={btnPrimary} disabled={busy}>
            <KeyRound size={14} /> Update password
          </button>
        </form>
      </Card>
    </div>
  );
}
