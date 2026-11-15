import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { channels, scores } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { decryptSecret } from "@/lib/crypto";

type Row = typeof channels.$inferSelect & { score: typeof scores.$inferSelect | null };

function ruleBasedRecommendation(rows: Row[]): string {
  const analysed = rows.filter((r) => r.score?.adScore != null);
  if (!analysed.length) return "No analysed channels in this selection yet. Run analysis first.";
  const best = [...analysed].sort((a, b) => (b.score!.adScore ?? 0) - (a.score!.adScore ?? 0))[0];
  const s = best.score!;
  const lines: string[] = [];
  lines.push(
    `Best advertising choice: ${best.title} (@${best.username}) with an Advertising Potential Score of ${s.adScore}/100.`
  );
  lines.push(
    `It reaches ~${(s.avgViews ?? 0).toLocaleString()} average views per post across ${best.subscribers.toLocaleString()} subscribers (views rate ${s.viewsRate?.toFixed(2) ?? "—"}%), with ${s.engagementRate?.toFixed(2) ?? "—"}% engagement and ~${s.postingFrequency?.toFixed(1) ?? "0"} posts/day.`
  );
  const q = s.qualityScore ?? 0;
  lines.push(
    q >= 75
      ? `Quality assessment is strong (${q}/100), so audience authenticity risk looks low based on available evidence.`
      : `Quality score is ${q}/100 — review the warning flags on the channel's analytics page before committing budget.`
  );
  const runnersUp = analysed.filter((r) => r.id !== best.id).sort((a, b) => (b.score!.adScore ?? 0) - (a.score!.adScore ?? 0)).slice(0, 2);
  if (runnersUp.length) {
    lines.push(`Runners-up: ${runnersUp.map((r) => `@${r.username} (${r.score!.adScore}/100)`).join(", ")}.`);
  }
  lines.push("Recommendation is based on public channel statistics only; no audience location, age, or demographic data is implied.");
  return lines.join("\n\n");
}

/** POST /api/compare { channelIds: string[] } — side-by-side comparison + recommendation. */
export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.channelIds) ? body.channelIds.slice(0, 10) : [];
  if (ids.length < 2) return jsonError(400, "Select at least 2 channels to compare.");

  const chRows = await db.select().from(channels).where(inArray(channels.id, ids));
  const scoreRows = await db.select().from(scores).where(inArray(scores.channelId, ids));
  const scoreMap = new Map(scoreRows.map((s) => [s.channelId, s]));
  const rows: Row[] = ids
    .map((id) => chRows.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => ({ ...(c as typeof channels.$inferSelect), score: scoreMap.get((c as typeof channels.$inferSelect).id) ?? null }));

  // Optional AI narrative if an OpenAI-compatible endpoint is configured.
  const ai = await getSetting<{ endpoint?: string; model?: string; apiKeyCipher?: string } | null>("ai", null);
  let engine = "rule-based";
  let recommendation = "";
  if (ai?.endpoint && ai.apiKeyCipher) {
    try {
      const key = decryptSecret(ai.apiKeyCipher);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 10000);
      const prompt = rows
        .map((r) => `${r.title} (@${r.username}): ${r.subscribers} subs, avgViews=${r.score?.avgViews ?? "n/a"}, ER=${r.score?.engagementRate ?? "n/a"}%, quality=${r.score?.qualityScore ?? "n/a"}, adScore=${r.score?.adScore ?? "n/a"}`)
        .join("\n");
      const res = await fetch(`${ai.endpoint.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: ai.model || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a Telegram advertising analyst. Recommend the best channel for advertisers using only the metrics provided. Be concise (max 150 words). Never invent demographics." },
            { role: "user", content: prompt },
          ],
          max_tokens: 300,
        }),
      });
      clearTimeout(t);
      if (res.ok) {
        const data = await res.json();
        recommendation = data.choices?.[0]?.message?.content ?? "";
        if (recommendation) engine = "ai";
      }
    } catch {
      /* fall through to rule-based */
    }
  }
  if (!recommendation) recommendation = ruleBasedRecommendation(rows);

  const winnerId = rows
    .filter((r) => r.score?.adScore != null)
    .sort((a, b) => (b.score!.adScore ?? 0) - (a.score!.adScore ?? 0))[0]?.id ?? null;

  return NextResponse.json({ ok: true, channels: rows, recommendation, engine, winnerId });
}
