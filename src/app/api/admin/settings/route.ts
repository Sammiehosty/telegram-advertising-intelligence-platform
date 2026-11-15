import { NextResponse } from "next/server";
import { requireAdmin, isErrorResponse, jsonError, str } from "@/lib/api";
import { getSetting, setSetting, DEFAULT_WEIGHTS, DEFAULT_PROVIDERS, type ScoringWeights, type ProviderFlags } from "@/lib/settings";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/db";
import { systemLogs } from "@/db/schema";

/** GET — global scoring weights, provider toggles, defaults, AI integration. */
export async function GET() {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const weights = await getSetting<ScoringWeights>("weights", DEFAULT_WEIGHTS);
  const providers = await getSetting<ProviderFlags>("providers", DEFAULT_PROVIDERS);
  const defaults = await getSetting<{ periodDays: number }>("defaults", { periodDays: 30 });
  const ai = await getSetting<{ endpoint: string; model: string; apiKeyCipher?: string } | null>("ai", null);
  return NextResponse.json({
    ok: true,
    weights,
    providers,
    defaults,
    ai: ai ? { endpoint: ai.endpoint ?? "", model: ai.model ?? "", apiKeySet: !!ai.apiKeyCipher } : { endpoint: "", model: "", apiKeySet: false },
  });
}

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (isErrorResponse(admin)) return admin;
  const body = await req.json().catch(() => ({}));

  if (body.weights) {
    const current = await getSetting<ScoringWeights>("weights", DEFAULT_WEIGHTS);
    const next: ScoringWeights = { ...current };
    for (const k of Object.keys(current) as (keyof ScoringWeights)[]) {
      const v = Number(body.weights[k]);
      if (Number.isFinite(v)) next[k] = Math.max(0, Math.min(100, Math.round(v)));
    }
    await setSetting("weights", next);
    await db.insert(systemLogs).values({ level: "info", source: "admin", message: "Scoring weights updated.", meta: next });
  }
  if (body.providers) {
    const next: ProviderFlags = {
      mtproto: !!body.providers.mtproto,
      directory: !!body.providers.directory,
      demo: !!body.providers.demo,
    };
    await setSetting("providers", next);
    await db.insert(systemLogs).values({ level: "info", source: "admin", message: "Discovery providers updated.", meta: { ...next } });
  }
  if (body.defaults) {
    const periodDays = [7, 14, 30, 60, 90].includes(body.defaults.periodDays) ? body.defaults.periodDays : 30;
    await setSetting("defaults", { periodDays });
  }
  if (body.ai) {
    const prev = await getSetting<{ endpoint: string; model: string; apiKeyCipher?: string } | null>("ai", null);
    const next: { endpoint: string; model: string; apiKeyCipher?: string } = {
      endpoint: str(body.ai.endpoint, 300),
      model: str(body.ai.model, 80) || "gpt-4o-mini",
      apiKeyCipher: body.ai.apiKey ? encryptSecret(str(body.ai.apiKey, 300)) : prev?.apiKeyCipher,
    };
    await setSetting("ai", next.endpoint || next.apiKeyCipher ? next : null);
    await db.insert(systemLogs).values({ level: "info", source: "admin", message: "AI integration settings updated." });
  }
  return NextResponse.json({ ok: true });
}
