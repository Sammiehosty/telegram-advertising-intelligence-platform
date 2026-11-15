import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { savedChannels, channels, scores, folders } from "@/db/schema";
import { requireUser, isErrorResponse, jsonError, str } from "@/lib/api";

/** GET — the user's saved channel database. */
export async function GET() {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const rows = await db
    .select({
      id: savedChannels.id,
      channelId: savedChannels.channelId,
      folderId: savedChannels.folderId,
      tags: savedChannels.tags,
      notes: savedChannels.notes,
      adPriceCents: savedChannels.adPriceCents,
      currency: savedChannels.currency,
      contactUsername: savedChannels.contactUsername,
      contacted: savedChannels.contacted,
      verified: savedChannels.verified,
      monitorInterval: savedChannels.monitorInterval,
      createdAt: savedChannels.createdAt,
      title: channels.title,
      username: channels.username,
      category: channels.category,
      subscribers: channels.subscribers,
      inviteUrl: channels.inviteUrl,
      isDemo: channels.isDemo,
      avgViews: scores.avgViews,
      engagementRate: scores.engagementRate,
      qualityScore: scores.qualityScore,
      adScore: scores.adScore,
      lastActiveAt: scores.lastActiveAt,
    })
    .from(savedChannels)
    .innerJoin(channels, eq(savedChannels.channelId, channels.id))
    .leftJoin(scores, eq(savedChannels.channelId, scores.channelId))
    .where(eq(savedChannels.userId, user.id))
    .orderBy(desc(savedChannels.createdAt));

  const folderRows = await db.select().from(folders).where(eq(folders.userId, user.id));
  return NextResponse.json({ ok: true, saved: rows, folders: folderRows });
}

/** POST — save a channel (duplicates prevented by unique constraint). */
export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const channelId = str(body.channelId, 64);
  if (!channelId) return jsonError(400, "channelId is required.");
  const ch = await db.select({ id: channels.id }).from(channels).where(eq(channels.id, channelId)).limit(1);
  if (!ch[0]) return jsonError(404, "Channel not found.");
  await db
    .insert(savedChannels)
    .values({ userId: user.id, channelId })
    .onConflictDoNothing();
  return NextResponse.json({ ok: true });
}
