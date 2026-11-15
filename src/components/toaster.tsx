"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

type Toast = { id: number; kind: "success" | "error" | "info"; title: string; body?: string };

const ToastCtx = createContext<{ toast: (kind: Toast["kind"], title: string, body?: string) => void }>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((kind: Toast["kind"], title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const icon = (kind: Toast["kind"]) =>
    kind === "success" ? <CheckCircle2 size={17} className="text-mint mt-0.5 shrink-0" />
    : kind === "error" ? <XCircle size={17} className="text-rose-400 mt-0.5 shrink-0" />
    : <Info size={17} className="text-sky-400 mt-0.5 shrink-0" />;

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up rounded-xl border border-line bg-card/95 backdrop-blur px-4 py-3 shadow-2xl shadow-black/40"
            role="status"
          >
            <div className="flex items-start gap-2.5">
              {icon(t.kind)}
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-muted leading-relaxed break-words">{t.body}</p>}
              </div>
              <button
                className="ml-auto text-muted hover:text-txt text-xs"
                onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
