"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Loader2, ShieldCheck, Radar, TrendingUp } from "lucide-react";
import { inputCls, btnPrimary } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] overflow-hidden border-r border-line lg:block">
        <div className="absolute inset-0 bg-scene" />
        <div className="grid-texture absolute inset-0" />
        <div className="absolute -left-20 top-1/3 h-72 w-72 rounded-full bg-mint/15 blur-[110px]" />
        <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-mintstrong to-emerald-600 shadow-lg shadow-mint/30">
              <Send size={18} className="text-[#04140c]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-[0.2em]">TELEAD</p>
              <p className="text-[10px] font-semibold tracking-[0.28em] text-mint">INTELLIGENCE</p>
            </div>
          </div>
          <div>
            <h1 className="max-w-md text-4xl font-extrabold leading-[1.08] tracking-tight">
              Discover. Analyse.{" "}
              <span className="bg-gradient-to-r from-mint to-teal-300 bg-clip-text text-transparent">
                Advertise Smarter.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              The intelligence platform for Telegram advertising. Discover public channels,
              analyse real engagement, and buy placements with confidence.
            </p>
            <div className="mt-8 space-y-3 text-[13px] text-muted">
              {[
                { icon: Radar, text: "Multi-source channel discovery engine" },
                { icon: TrendingUp, text: "Engagement, quality & ad potential scoring" },
                { icon: ShieldCheck, text: "Evidence-based risk flags before you spend" },
              ].map((f) => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card2">
                    <f.icon size={15} className="text-mint" />
                  </div>
                  {f.text}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted/60">© 2026 TeleAd Intelligence. Public data only — never private groups.</p>
        </div>
      </div>

      {/* Form */}
      <div className="relative flex flex-1 items-center justify-center p-6">
        <div className="grid-texture absolute inset-0 lg:hidden" />
        <form onSubmit={submit} className="relative w-full max-w-sm animate-fade-up rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mintstrong to-emerald-600 shadow-lg shadow-mint/25 lg:hidden">
              <Send size={20} className="text-[#04140c]" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Welcome back</h2>
            <p className="mt-1 text-xs text-muted">Sign in to your intelligence workspace</p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs font-medium text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Email</label>
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Password</label>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
            </div>
            <button className={btnPrimary + " w-full"} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted">
            No account yet?{" "}
            <Link href="/register" className="font-semibold text-mint hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
