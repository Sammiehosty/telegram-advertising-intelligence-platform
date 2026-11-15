"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send, Loader2 } from "lucide-react";
import { inputCls, btnPrimary } from "@/components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
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
    <div className="relative flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="grid-texture absolute inset-0" />
      <div className="absolute left-1/4 top-0 h-72 w-72 rounded-full bg-mint/10 blur-[110px]" />
      <form onSubmit={submit} className="relative w-full max-w-sm animate-fade-up rounded-2xl border border-line bg-card p-8 shadow-2xl shadow-black/40">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-mintstrong to-emerald-600 shadow-lg shadow-mint/25">
            <Send size={20} className="text-[#04140c]" strokeWidth={2.5} />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Create your workspace</h2>
          <p className="mt-1 text-xs text-muted">The first account becomes the administrator</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3.5 py-2.5 text-xs font-medium text-rose-300">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Full name</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Marketer" required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Email</label>
            <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required autoComplete="email" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">Password</label>
            <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password" />
          </div>
          <button className={btnPrimary + " w-full"} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? "Creating account…" : "Create account"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-mint hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
