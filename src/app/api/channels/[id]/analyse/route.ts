import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, posts, scores, statsSnapshots, systemLogs } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";
import { generatePosts, pickArchetype, mulberry32, hashString } from "@/lib/demo-data";
import { computeMetrics, computeQuality, computeAdScore } from "@/lib/scoring";
import { getSetting, DEFAULT_WEIGHTS, type ScoringWeights } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/channels/:id/analyse — re-run the analysis engine for one channel. */
export async function POST(req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const periodDays = [7, 14, 30, 60, 90].includes(Number(url.searchParams.get("period")))
    ? Number(url.searchParams.get("period"))
    : 30;

  const chRows = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  const ch = chRows[0];
  if (!ch) return jsonError(404, "Channel not found.");

  if (!ch.isDemo) {
    return jsonError(
      409,
      "Live statistics for this channel require a connected Telegram API session. Configure it in Administration → Telegram API."
    );
  }

  // Demo channels: deterministic regeneration with a small subscriber drift so
  // re-analysis produces a fresh snapshot in the historical series.
  const drift = Math.round(ch.subscribers * (Math.random() * 0.03 - 0.01));
  const subscribers = Math.max(0, ch.subscribers + drift);
  const archetype = pickArchetype(mulberry32(hashString(ch.username))());
  const genPosts = generatePosts(
    {
      username: ch.username, title: ch.title, description: ch.description,
      category: ch.category, language: ch.language, subscribers, archetype, seed: 0,
    },
    periodDays,
    ch.category
  );

  await db.delete(posts).where(eq(posts.channelId, ch.id));
  if (genPosts.length) {
    await db.insert(posts).values(
      genPosts.map((p) => ({
        channelId: ch.id, messageId: p.messageId, text: p.text, publishedAt: p.publishedAt,
        views: p.views, reactions: p.reactions, comments: p.comments, forwards: p.forwards,
        isPromo: p.isPromo, url: p.url,
      }))
    );
  }

  const metrics = computeMetrics(genPosts, subscribers, periodDays);
  const channelLike = { title: ch.title, username: ch.username, description: ch.description, category: ch.category, subscribers };
  const quality = computeQuality(channelLike, metrics, genPosts);
  const weights = await getSetting<ScoringWeights>("weights", DEFAULT_WEIGHTS);
  const ad = computeAdScore(channelLike, metrics, [ch.category], weights);

  const row = {
    channelId: ch.id, updatedAt: new Date(),
    avgViews: metrics.avgViews, medianViews: metrics.medianViews, viewsRate: metrics.viewsRate,
    engagementRate: metrics.engagementRate, avgReactions: metrics.avgReactions,
    avgComments: metrics.avgComments, avgForwards: metrics.avgForwards,
    postingFrequency: metrics.postingFrequency, lastActiveAt: metrics.lastActiveAt,
    qualityScore: quality.score, qualityFlags: quality.flags, adScore: ad.score,
    adBreakdown: ad.breakdown,
    adClass: ad.score >= 90 ? "excellent" : ad.score >= 75 ? "very_good" : ad.score >= 60 ? "good" : ad.score >= 40 ? "average" : "poor",
  };
  await db.insert(scores).values(row).onConflictDoUpdate({ target: scores.channelId, set: row });
  await db.insert(statsSnapshots).values({
    channelId: ch.id, subscribers, avgViews: metrics.avgViews,
    engagementRate: metrics.engagementRate, viewsRate: metrics.viewsRate,
  });
  await db.update(channels).set({ subscribers, lastAnalysedAt: new Date() }).where(eq(channels.id, ch.id));
  await db.insert(systemLogs).values({ level: "info", source: "analyse", message: `Re-analysed @${ch.username} (demo engine).` });

  return NextResponse.json({ ok: true, metrics, quality, adScore: ad.score, periodDays });
}
