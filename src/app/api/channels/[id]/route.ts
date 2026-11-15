import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { db } from "@/db";
import { channels, posts, scores, statsSnapshots, savedChannels } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError } from "@/lib/api";
import { getSetting, DEFAULT_WEIGHTS, type ScoringWeights } from "@/lib/settings";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/channels/:id — full analytics payload for one channel. */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const { id } = await ctx.params;

  const chRows = await db.select().from(channels).where(eq(channels.id, id)).limit(1);
  const ch = chRows[0];
  if (!ch) return jsonError(404, "Channel not found.");

  const scoreRows = await db.select().from(scores).where(eq(scores.channelId, id)).limit(1);
  const postRows = await db
    .select()
    .from(posts)
    .where(eq(posts.channelId, id))
    .orderBy(desc(posts.publishedAt))
    .limit(120);
  const snapshots = await db
    .select()
    .from(statsSnapshots)
    .where(eq(statsSnapshots.channelId, id))
    .orderBy(desc(statsSnapshots.capturedAt))
    .limit(30);
  const saved = await db
    .select({ id: savedChannels.id })
    .from(savedChannels)
    .where(and(eq(savedChannels.userId, user.id), eq(savedChannels.channelId, id)))
    .limit(1);
  const weights = await getSetting<ScoringWeights>("weights", DEFAULT_WEIGHTS);

  return NextResponse.json({
    ok: true,
    channel: ch,
    score: scoreRows[0] ?? null,
    posts: postRows,
    snapshots: [...snapshots].reverse(),
    isSaved: !!saved[0],
    savedId: saved[0]?.id ?? null,
    weights,
  });
}
