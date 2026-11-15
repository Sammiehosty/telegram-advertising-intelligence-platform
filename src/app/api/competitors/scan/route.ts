import { NextResponse } from "next/server";
import { desc, ilike, or, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { posts, channels } from "@/db/schema";
import { requireUser, isErrorResponse, str } from "@/lib/api";

/**
 * POST /api/competitors/scan — scan publicly collected channel posts for
 * promotional content (ad markers, links, sponsor tags). Never touches
 * private messages/groups.
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (isErrorResponse(user)) return user;
  const body = await req.json().catch(() => ({}));
  const keyword = str(body.keyword, 80);

  const keywordCond = keyword
    ? or(ilike(posts.text, `%${keyword}%`), ilike(channels.title, `%${keyword}%`))
    : undefined;
  const where = keywordCond ? and(eq(posts.isPromo, true), keywordCond) : eq(posts.isPromo, true);
  const rows = await db
    .select({
      postId: posts.id, text: posts.text, publishedAt: posts.publishedAt,
      views: posts.views, forwards: posts.forwards, url: posts.url,
      channelId: channels.id, channelTitle: channels.title, channelUsername: channels.username,
      isDemo: channels.isDemo,
    })
    .from(posts)
    .innerJoin(channels, eq(posts.channelId, channels.id))
    .where(where)
    .orderBy(desc(posts.publishedAt))
    .limit(60);

  // Group repeated advertisers (same channel)
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(r.channelUsername, (seen.get(r.channelUsername) ?? 0) + 1);

  return NextResponse.json({
    ok: true,
    ads: rows,
    repeatedAdvertisers: [...seen.entries()]
      .filter(([, n]) => n > 1)
      .map(([username, count]) => ({ username, count })),
    note: "Scans only publicly collected posts from channels in your database. Private messages and private groups are never accessed.",
  });
}
