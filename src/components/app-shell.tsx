"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Radar, Database, BarChart3, GitCompareArrows, Bookmark,
  Megaphone, Swords, History, FileText, Settings, ShieldCheck, Send,
  PanelLeftClose, PanelLeftOpen, Menu, X, Bell, Sun, Moon, LogOut,
  ChevronsUpDown, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/discover", label: "Discover Channels", icon: Radar },
  { href: "/channels", label: "Channel Database", icon: Database },
  { href: "/compare", label: "Channel Comparison", icon: GitCompareArrows },
  { href: "/saved", label: "Saved Channels", icon: Bookmark },
  { href: "/campaigns", label: "Ad Campaigns", icon: Megaphone },
  { href: "/competitors", label: "Competitor Research", icon: Swords },
  { href: "/history", label: "Search History", icon: History },
  { href: "/reports", label: "Reports", icon: FileText },
];

type User = { name: string; email: string; role: string };
type Notif = { id: string; title: string; body: string; isRead: boolean; createdAt: string };

export default function AppShell({ user, children }: { user: User; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setCollapsed(localStorage.getItem("telead-collapsed") === "1");
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch("/api/notifications");
        if (!res.ok) return;
        const data = await res.json();
        if (!stop) {
          setNotifs(data.notifications ?? []);
          setUnread(data.unread ?? 0);
        }
      } catch { /* offline */ }
    }
    load();
    const t = setInterval(load, 20_000);
    return () => { stop = true; clearInterval(t); };
  }, [pathname]);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("telead-collapsed", next ? "1" : "0");
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("telead-theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function openBell() {
    setBellOpen(!bellOpen);
    if (!bellOpen && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
      setNotifs((n) => n.map((x) => ({ ...x, isRead: true })));
    }
  }

  const navItems = user.role === "admin"
    ? [...NAV, { href: "/settings", label: "Settings", icon: Settings }, { href: "/admin", label: "Administration", icon: ShieldCheck }]
    : [...NAV, { href: "/settings", label: "Settings", icon: Settings }];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-3 px-4 h-16 border-b border-line", collapsed && "justify-center px-2")}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-mintstrong to-emerald-600 shadow-lg shadow-mint/25">
          <Send size={17} className="text-[#04140c]" strokeWidth={2.5} />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-[13px] font-extrabold tracking-[0.14em]">TELEAD</p>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-mint">INTELLIGENCE</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition",
                collapsed && "justify-center px-2",
                active
                  ? "bg-mint/10 text-mint border border-mint/25"
                  : "text-muted hover:text-txt hover:bg-card2 border border-transparent"
              )}
            >
              <item.icon size={17} strokeWidth={2.2} className="shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      {!collapsed && (
        <div className="mx-3 mb-3 rounded-xl border border-line bg-card2 p-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-muted">
            <FlaskConical size={13} className="text-amber-400" />
            VPS worker discovery
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-muted/80">
            Searches are queued for your connected VPS Telegram worker.
          </p>
        </div>
      )}

      <button
        onClick={toggleCollapse}
        className="hidden md:flex m-3 items-center justify-center gap-2 rounded-xl border border-line bg-card2 py-2 text-xs font-semibold text-muted hover:text-txt transition"
      >
        {collapsed ? <PanelLeftOpen size={15} /> : <><PanelLeftClose size={15} /> Collapse</>}
      </button>
    </div>
  );

  return (
    <div className="bg-scene min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden md:block border-r border-line bg-bgsoft/90 backdrop-blur transition-[width] duration-300",
          collapsed ? "w-[72px]" : "w-[248px]"
        )}
      >
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] border-r border-line bg-bgsoft">
            <button className="absolute right-3 top-4 text-muted" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-300", collapsed ? "md:pl-[72px]" : "md:pl-[248px]")}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-bg/80 backdrop-blur-xl px-4 md:px-7">
          <button className="md:hidden text-muted" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">TeleAd Intelligence</p>
            <p className="text-[10px] text-muted/70">Discover. Analyse. Advertise Smarter.</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-line bg-card2 p-2.5 text-muted hover:text-txt transition"
              title="Toggle theme"
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="relative">
              <button
                onClick={openBell}
                className="relative rounded-xl border border-line bg-card2 p-2.5 text-muted hover:text-txt transition"
                title="Notifications"
              >
                <Bell size={16} />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-mint px-1 text-[9px] font-bold text-[#04140c]">
                    {unread}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-12 z-50 w-[min(90vw,340px)] rounded-2xl border border-line-strong bg-card shadow-2xl shadow-black/50">
                  <p className="border-b border-line px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted">Notifications</p>
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length === 0 && <p className="px-4 py-6 text-center text-xs text-muted">No notifications yet.</p>}
                    {notifs.map((n) => (
                      <div key={n.id} className="border-b border-line/50 px-4 py-3 last:border-0">
                        <p className="text-[13px] font-semibold">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-xs text-muted leading-snug">{n.body}</p>}
                        <p className="mt-1 text-[10px] text-muted/60">{timeAgo(n.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 rounded-xl border border-line bg-card2 py-1.5 pl-1.5 pr-2.5 hover:border-linestrong transition"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-mintstrong to-emerald-700 text-[11px] font-extrabold text-[#04140c]">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden sm:block text-left leading-tight">
                  <span className="block text-xs font-bold">{user.name}</span>
                  <span className="block text-[10px] text-muted capitalize">{user.role}</span>
                </span>
                <ChevronsUpDown size={13} className="text-muted" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-2xl border border-line-strong bg-card shadow-2xl shadow-black/50">
                  <div className="border-b border-line px-4 py-3">
                    <p className="text-xs font-bold truncate">{user.name}</p>
                    <p className="text-[11px] text-muted truncate">{user.email}</p>
                  </div>
                  <Link href="/settings" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-muted hover:bg-card2 hover:text-txt">
                    <Settings size={14} /> Settings
                  </Link>
                  <button onClick={logout} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-rose-300 hover:bg-card2">
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-7 md:px-7">{children}</main>
      </div>
    </div>
  );
}
